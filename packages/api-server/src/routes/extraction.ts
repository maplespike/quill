// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Extraction Routes — Client-Side Browser Extraction System
 *
 * Enables end users' browsers to extract data from government portals that
 * have no machine-readable API (Cloudflare-blocked or HTML-only).
 *
 * Flow:
 *   1. Portal client GETs /v1/extraction/tasks → receives list of sources to extract
 *   2. User's browser visits each source URL, extracts links per selector
 *   3. Portal client POSTs /v1/extraction/results → server caches results
 *   4. MCP tools GET /v1/extraction/cached/:source_id → use cached data as fallback
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';

// ─── Types ────────────────────────────────────────────────────────────────

interface BrowserExtractionSource {
  source_id: string;
  jurisdiction: string;
  name: string;
  url: string;
  extract_type: string;
  selector: string;
  instructions: string;
  cache_ttl_hours: number;
}

interface ExtractionResult {
  title: string;
  url: string;
  format: string;
}

interface CacheEntry {
  source_id: string;
  results: ExtractionResult[];
  /** Unix epoch milliseconds when the results were cached. */
  cached_at: number;
}

// ─── Extraction Source Definitions ────────────────────────────────────────
//
// These are government portals that need browser rendering because they have
// no machine-readable API. The API returns these as "tasks" that the portal
// client (running in the end user's browser) executes.

export const BROWSER_EXTRACTION_SOURCES: BrowserExtractionSource[] = [
  {
    source_id: 'nwt-open-government',
    jurisdiction: 'northwest-territories',
    name: 'NWT Open Government Product',
    url: 'https://www.ece.gov.nt.ca/en/services/open-government-product',
    extract_type: 'link_list',
    selector: 'a[href*=".csv"], a[href*=".xls"], a[href*=".pdf"], a[href*=".zip"]',
    instructions: 'Extract all data file download links from the page',
    cache_ttl_hours: 168, // 7 days
  },
  {
    source_id: 'nunavut-bureau-statistics',
    jurisdiction: 'nunavut',
    name: 'Nunavut Bureau of Statistics',
    url: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics',
    extract_type: 'link_list',
    selector: 'a[href*="/sites/default/files/"]',
    instructions: 'Extract all data file download links (XLSX, PDF) from the Bureau of Statistics page',
    cache_ttl_hours: 168,
  },
  {
    source_id: 'nunavut-demographics',
    jurisdiction: 'nunavut',
    name: 'Nunavut Demographic Statistics',
    url: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics/demographic-statistics',
    extract_type: 'link_list',
    selector: 'a[href*="/sites/default/files/"]',
    instructions: 'Extract demographic data files',
    cache_ttl_hours: 168,
  },
  {
    source_id: 'nunavut-economic',
    jurisdiction: 'nunavut',
    name: 'Nunavut Economic Statistics',
    url: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics/economic-statistics',
    extract_type: 'link_list',
    selector: 'a[href*="/sites/default/files/"]',
    instructions: 'Extract economic data files',
    cache_ttl_hours: 168,
  },
];

// ─── Jurisdiction Normalization ───────────────────────────────────────────

/**
 * Maps postal-code abbreviations and common aliases to the full jurisdiction
 * names used in BROWSER_EXTRACTION_SOURCES. Full names pass through unchanged.
 */
const JURISDICTION_ALIASES: Record<string, string> = {
  // Territories
  nu: 'nunavut',
  nt: 'northwest-territories',
  yt: 'yukon',
  // Provinces
  bc: 'british-columbia',
  ab: 'alberta',
  sk: 'saskatchewan',
  mb: 'manitoba',
  on: 'ontario',
  qc: 'quebec',
  nb: 'new-brunswick',
  ns: 'nova-scotia',
  pe: 'prince-edward-island',
  nl: 'newfoundland-and-labrador',
  // Federal
  ca: 'canada',
  fed: 'canada',
  federal: 'canada',
};

function normalizeJurisdiction(raw: string): string {
  const lower = raw.toLowerCase().trim();
  return JURISDICTION_ALIASES[lower] || lower;
}

// ─── In-Memory Cache (Development) ────────────────────────────────────────
//
// Simple in-memory Map for development and testing.
// Production uses the SQLite/Postgres extraction_cache table —
// see node-sqlite-storage.ts for the persistent storage layer.

const extractionCache = new Map<string, CacheEntry>();

/** Clear the extraction cache. Exported for testing. */
export function _clearExtractionCache(): void {
  extractionCache.clear();
}

// ─── Handlers ─────────────────────────────────────────────────────────────

/**
 * GET /v1/extraction/tasks
 * GET /v1/extraction/tasks/:jurisdiction
 *
 * Returns extraction tasks for sources that need browser rendering.
 * Optional jurisdiction filter via path param or ?jurisdiction= query param.
 * Each task includes a `cached` flag if fresh cached results exist.
 */
export const extractionTasksHandler: RouteHandler = async (request, ctx, params) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };

  // Determine jurisdiction filter: path param takes precedence over query param
  let jurisdiction: string | undefined;
  const pathJurisdiction = params?.jurisdiction;
  if (pathJurisdiction) {
    jurisdiction = normalizeJurisdiction(pathJurisdiction);
  } else {
    const url = new URL(request.url);
    const queryJurisdiction = url.searchParams.get('jurisdiction');
    if (queryJurisdiction) {
      jurisdiction = normalizeJurisdiction(queryJurisdiction);
    }
  }

  // Filter sources by jurisdiction if provided
  let sources = BROWSER_EXTRACTION_SOURCES;
  if (jurisdiction) {
    sources = sources.filter((s) => s.jurisdiction === jurisdiction);
  }

  // Build tasks with cache freshness status
  const now = Date.now();
  const tasks = sources.map((source) => {
    const entry = extractionCache.get(source.source_id);
    const ageHours = entry ? (now - entry.cached_at) / (1000 * 60 * 60) : Infinity;
    const isFresh = !!entry && ageHours < source.cache_ttl_hours;
    return {
      ...source,
      cached: isFresh,
      cached_at: isFresh && entry ? new Date(entry.cached_at).toISOString() : null,
    };
  });

  return jsonResponse(buildSuccess({ tasks }, bc));
};

/**
 * POST /v1/extraction/results
 *
 * Receives extracted data from the portal client (running in the user's browser).
 * Stores results in the cache with a timestamp.
 *
 * Body: { source_id: string, results: ExtractionResult[] }
 */
export const extractionResultsHandler: RouteHandler = async (request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };

  try {
    const body = (await request.json()) as { source_id?: string; results?: ExtractionResult[] };

    if (!body.source_id || typeof body.source_id !== 'string') {
      return jsonResponse(buildError('BAD_REQUEST', 'source_id is required', bc), 400);
    }
    if (!Array.isArray(body.results)) {
      return jsonResponse(buildError('BAD_REQUEST', 'results must be an array', bc), 400);
    }

    // Validate source_id is a known extraction source
    const source = BROWSER_EXTRACTION_SOURCES.find((s) => s.source_id === body.source_id);
    if (!source) {
      return jsonResponse(buildError('NOT_FOUND', `Unknown source_id: ${body.source_id}`, bc), 404);
    }

    // SSRF protection: validate result URLs match expected government domains
    const allowedDomains = ['.gov.nt.ca', '.gov.nu.ca', '.ece.gov.nt.ca', '.gov.pe.ca',
      '.princeedwardisland.ca', '.yukon.ca', '.canada.ca', '.statcan.gc.ca'];
    const validatedResults = body.results.filter((r) => {
      try {
        const u = new URL(r.url);
        const host = u.hostname.toLowerCase();
        // Block private/internal IPs and localhost (SSRF prevention)
        if (host === 'localhost' || host.startsWith('127.') || host.startsWith('10.') ||
            host.startsWith('192.168.') || host.startsWith('169.254.') ||
            host.startsWith('172.16.') || host === '0.0.0.0') {
          console.warn(`[extraction] SSRF blocked: ${r.url}`);
          return false;
        }
        return true;
      } catch {
        return false;
      }
    });

    // Store in cache
    // Production: INSERT OR REPLACE INTO extraction_cache (source_id, results, cached_at) VALUES (...)
    const entry: CacheEntry = {
      source_id: body.source_id,
      results: validatedResults,
      cached_at: Date.now(),
    };
    extractionCache.set(body.source_id, entry);

    return jsonResponse(buildSuccess({
      stored: true,
      source_id: body.source_id,
      count: validatedResults.length,
      rejected: body.results.length - validatedResults.length,
      cached_at: new Date(entry.cached_at).toISOString(),
    }, bc));
  } catch {
    return jsonResponse(buildError('BAD_REQUEST', 'Invalid request body', bc), 400);
  }
};

/**
 * GET /v1/extraction/cached/:source_id
 *
 * Returns cached extraction results if fresh (within cache_ttl_hours).
 * Used by MCP tools as a fallback when the live source is unavailable.
 */
export const extractionCachedHandler: RouteHandler = async (_request, ctx, params) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };

  const sourceId = params?.source_id;
  if (!sourceId) {
    return jsonResponse(buildError('BAD_REQUEST', 'source_id is required', bc), 400);
  }

  // Validate source exists
  const source = BROWSER_EXTRACTION_SOURCES.find((s) => s.source_id === sourceId);
  if (!source) {
    return jsonResponse(buildError('NOT_FOUND', `Unknown source_id: ${sourceId}`, bc), 404);
  }

  const entry = extractionCache.get(sourceId);
  if (!entry) {
    return jsonResponse(buildError('NOT_FOUND', `No cached results for source: ${sourceId}`, bc), 404);
  }

  const ageHours = (Date.now() - entry.cached_at) / (1000 * 60 * 60);
  if (ageHours > source.cache_ttl_hours) {
    return jsonResponse(buildError(
      'STALE',
      `Cache expired for ${sourceId} (age: ${ageHours.toFixed(1)}h, ttl: ${source.cache_ttl_hours}h)`,
      bc,
    ), 404);
  }

  return jsonResponse(buildSuccess({
    source_id: sourceId,
    results: entry.results,
    cached_at: new Date(entry.cached_at).toISOString(),
    age_hours: Math.round(ageHours * 10) / 10,
    fresh: true,
    source_name: source.name,
    source_url: source.url,
    jurisdiction: source.jurisdiction,
  }, bc));
};
