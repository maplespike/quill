// SPDX-License-Identifier: AGPL-3.0-or-later

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { httpGet } from '../../utils/http.js';
import { MUNICIPAL_PORTALS, MUNICIPAL_TIMEOUT_MS, MUNICIPAL_USER_AGENT } from './constants.js';
import type { PortalType } from './constants.js';

/* -------------------------------------------------------------------------- */
/*  Hydration from git-tracked build-time registry                            */
/* -------------------------------------------------------------------------- */

/**
 * Resolve the build-time registry path. The file lives at
 * `packages/pipeline-core/data/municipal-discovered-ids.json` and is
 * regenerated weekly by `.github/workflows/discover-municipal-ids.yml`.
 *
 * The fetcher.js compiled output sits at
 *   packages/pipeline-core/dist/ingestion/municipal/fetcher.js
 * so the registry is THREE levels up — not two. Earlier revisions used
 * `../../data/...` which silently resolved to `dist/data/...` (a non-existent
 * path the try/catch swallowed). The `path.resolve(here, '..', '..', '..',
 * 'data', 'municipal-discovered-ids.json')` form is explicit so future
 * refactors can't get the dot-count wrong without a TS error.
 *
 * Both monorepo-local (`packages/pipeline-core/`) and npm-installed
 * (`node_modules/@maplespike/pipeline-core/`) layouts share the same
 * depth-after-dist, so the same `../../../data/...` math works in both.
 *
 * Falls back to a cwd-guess when `import.meta.url` is unavailable
 * (tsx watch mode, jest, ad-hoc REPL).
 */
function resolveRegistryPath(): string | null {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(here, '..', '..', '..', 'data', 'municipal-discovered-ids.json');
  } catch {
    const cwdGuess = path.resolve(
      process.cwd(),
      'packages/pipeline-core/data/municipal-discovered-ids.json',
    );
    return fs.existsSync(cwdGuess) ? cwdGuess : null;
  }
}

/**
 * Idempotent cache seeder. Reads the build-time registry on first import
 * and primes the in-process `idResultCache` with every previously-discovered
 * `(baseUrl, slug) → id` mapping.
 *
 * NEVER throws — missing or malformed registry files are silent no-ops so a
 * fresh clone (with no checked-in discoveries yet) boots cleanly. The
 * runtime self-healing resolvers will still discover every key on first
 * cold request; the prebaked layer is purely a latency optimization.
 */
function hydrateFromRegistry(): void {
  const registryPath = resolveRegistryPath();
  if (!registryPath) return;
  let raw: string;
  try {
    raw = fs.readFileSync(registryPath, 'utf8');
  } catch {
    return;
  }
  let parsed: { entries?: Record<string, { id?: string; portalType?: string }> };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  const entries = parsed.entries;
  if (!entries || typeof entries !== 'object') return;
  let hydrated = 0;
  for (const [compositeKey, value] of Object.entries(entries)) {
    if (typeof value?.id !== 'string' || value.id.length === 0) continue;
    // Trust the registry — a stale entry that 404s will be evicted by the
    // existing stale-404 detection in fetchMunicipalDataset, then live-
    // re-discovered and re-cached.
    idResultCache.set(compositeKey, value.id);
    hydrated++;
  }
  if (hydrated > 0) {
    // stderr, not stdout: this runs while the module is imported, and stdout
    // is the wire for the MCP stdio transport (see quill-mcp/src/stdio-guard.ts)
    // — a stray line there is a malformed JSON-RPC frame to the host.
    console.error(`[Municipal] hydrated ${hydrated} pre-discovered IDs from build-time registry`);
  }
}

// Run the seeding exactly once per process. The two-tier resolvers
// consult `idResultCache` synchronously on every fast-path lookup, so
// hydration must complete BEFORE module consumers (`fetchMunicipalDataset`)
// are called — which is guaranteed by this top-of-module execution order.
const idResultCache = new Map<string, string>();
const idInflightCache = new Map<string, Promise<string | null>>();
hydrateFromRegistry();

/* -------------------------------------------------------------------------- */
/*  Re-export the registry hydrate function so test fixtures / admin tools    */
/*  can re-seed the cache after `clearMunicipalIdCache()`.                    */
/* -------------------------------------------------------------------------- */

/**
 * Re-read the build-time registry and seed `idResultCache`. Useful when tests
 * have cleared the cache but want to simulate "process just started with
 * registry present" state. Defensive — same no-throw guarantees as the
 * internal hydrator.
 */
export function hydrateMunicipalIdCacheFromRegistry(): number {
  hydrateFromRegistry();
  return idResultCache.size;
}

/* -------------------------------------------------------------------------- */
/*  CKAN package-ID resolution: two-tier memoization                          */
/* -------------------------------------------------------------------------- */

/**
 * Two-tier cache semantics — `idResultCache` and `idInflightCache` are
 * declared above this comment (and seeded by `hydrateFromRegistry()` before
 * any resolver can run). They are the single source of truth for resolved
 * CKAN package IDs across the entire process.
 *
 *   `idResultCache` — successful discoveries (slug → real UUID). Survives until
 *                     evicted by stale-404 detection. Eliminated the round-trip
 *                     for every subsequent request. Hydrated from
 *                     `data/municipal-discovered-ids.json` on module load.
 *
 *   `idInflightCache` — in-flight Promise<string | null>. Concurrent callers
 *                       all await the same discovery, eliminating duplicate
 *                       package_search traffic when 4 jobs target the same
 *                       `{baseUrl, slug}` simultaneously.
 *
 * Failed discoveries (resolved to `null`) are NOT persisted in `idResultCache`
 * so the next sequential request retries — but they ARE deduplicated during
 * the in-flight window via `idInflightCache`. This means a CKAN portal that
 * returns empty search results will be re-probed on the next call rather than
 * permanently stale-bucketed.
 */

/**
 * Drop the cache entry for `{baseUrl, slug}`. Called when a stored UUID
 * 404s on the fast path so the next request re-discovers.
 */
export function evictMunicipalIdCache(baseUrl: string, slug: string): void {
  idResultCache.delete(`${baseUrl}|${slug}`);
}

/**
 * Clear both caches. Useful for cron-driven cache re-validation jobs or
 * test fixtures that need a fresh slate.
 */
export function clearMunicipalIdCache(): void {
  idResultCache.clear();
  idInflightCache.clear();
}

/**
 * Self-healing dataset ID discovery for CKAN portals.
 *
 * Resolves a friendly slug (`'budget'`, `'permits'`) to the actual CKAN
 * `id` via `package_search?q=<slug>&rows=1`. Results are memoized across
 * the process so subsequent calls are instant.
 *
 * Cache key format: `${baseUrl}|${slug}` — strict keying avoids collisions
 * when multiple cities happen to share a slug like `budget`.
 */
export async function resolveCkanPackageId(
  baseUrl: string,
  slug: string,
  timeoutMs: number = MUNICIPAL_TIMEOUT_MS,
): Promise<string | null> {
  const cacheKey = `${baseUrl}|${slug}`;

  // Fast path: previously-discovered result.
  const cached = idResultCache.get(cacheKey);
  if (cached) return cached;

  // In-flight dedup: concurrent callers all await the same discovery.
  const inflight = idInflightCache.get(cacheKey);
  if (inflight) return inflight;

  // Cold path: kick off discovery.
  const searchUrl = `${baseUrl}/api/3/action/package_search?q=${encodeURIComponent(slug)}&rows=1`;
  const promise = (async (): Promise<string | null> => {
    try {
      const resp = await httpGet(searchUrl, {
        timeoutMs,
        headers: { 'User-Agent': MUNICIPAL_USER_AGENT },
      });
      if (resp.statusCode >= 400) return null;
      const body = JSON.parse(resp.body) as {
        result?: { results?: Array<{ id?: string; name?: string }> };
      };
      const top = body?.result?.results?.[0];
      return top?.id ?? top?.name ?? null;
    } catch {
      return null;
    }
  })();

  idInflightCache.set(cacheKey, promise);
  // Promise self-cleans from inflight cache once settled — failed
  // discoveries (null) remove themselves so the next caller retries.
  promise.finally(() => {
    if (idInflightCache.get(cacheKey) === promise) {
      idInflightCache.delete(cacheKey);
    }
  });

  const result = await promise;
  if (result) idResultCache.set(cacheKey, result);
  return result;
}

/**
 * Self-healing dataset ID discovery for Socrata portals.
 *
 * Socrata portals (Vancouver, Calgary, Edmonton, Ottawa, Winnipeg, etc.)
 * register datasets by friendly name (`'budget'`, `'permits'`, `'311-calls'`)
 * but the actual asset IDs are 4×4-hex codes only available via the catalog:
 * `GET <baseUrl>/api/views.json?search=<slug>&limit=1` returns a flat array
 * — we just take the first match's `id`.
 *
 * Shares the same two-tier memoization as `resolveCkanPackageId`. Results
 * stay cached process-wide; concurrent callers ride one in-flight request.
 */
export async function resolveSocrataDatasetId(
  baseUrl: string,
  slug: string,
  timeoutMs: number = MUNICIPAL_TIMEOUT_MS,
): Promise<string | null> {
  const cacheKey = `${baseUrl}|${slug}`;

  // Fast path: previously-discovered result.
  const cached = idResultCache.get(cacheKey);
  if (cached) return cached;

  // In-flight dedup: concurrent callers all await the same discovery.
  const inflight = idInflightCache.get(cacheKey);
  if (inflight) return inflight;

  const searchUrl = `${baseUrl}/api/views.json?search=${encodeURIComponent(slug)}&limit=1`;
  const promise = (async (): Promise<string | null> => {
    try {
      const resp = await httpGet(searchUrl, {
        timeoutMs,
        headers: { 'User-Agent': MUNICIPAL_USER_AGENT, 'Accept': 'application/json' },
      });
      if (resp.statusCode >= 400) return null;
      const body = JSON.parse(resp.body);
      // Socrata catalog shape varies across portal deployments:
      //   - Classic Socrata (Vancouver, Calgary, Edmonton): flat [viewobj, ...]
      //   - Newer / OData portals: { results: [viewobj, ...] }
      //   - Some instances: { views: [...] } or { datasets: [...] }
      const flat = Array.isArray(body)
        ? body
        : Array.isArray((body as { results?: unknown[] })?.results)
          ? (body as { results: unknown[] }).results
          : Array.isArray((body as { views?: unknown[] })?.views)
            ? (body as { views: unknown[] }).views
            : Array.isArray((body as { datasets?: unknown[] })?.datasets)
              ? (body as { datasets: unknown[] }).datasets
              : [];
      const top = flat[0] as { id?: string; name?: string } | undefined;
      if (!top) return null;
      return top.id ?? top.name ?? null;
    } catch {
      return null;
    }
  })();

  idInflightCache.set(cacheKey, promise);
  promise.finally(() => {
    if (idInflightCache.get(cacheKey) === promise) {
      idInflightCache.delete(cacheKey);
    }
  });

  const result = await promise;
  if (result) idResultCache.set(cacheKey, result);
  return result;
}

/* -------------------------------------------------------------------------- */
/*  Portal type detection                                                     */
/* -------------------------------------------------------------------------- */

export async function detectPortalType(municipalityId: string): Promise<PortalType> {
  const portal = MUNICIPAL_PORTALS[municipalityId];
  if (!portal) return 'none';

  try {
    const resp = await httpGet(`${portal.baseUrl}/api/3/action/package_list`, {
      timeoutMs: MUNICIPAL_TIMEOUT_MS,
      headers: { 'User-Agent': MUNICIPAL_USER_AGENT },
    });
    if (resp.statusCode < 400) return 'ckan';
  } catch (err) {
    console.warn(`[Municipal] CKAN probe failed for ${municipalityId}: ${(err as Error).message}`);
  }

  try {
    const resp = await httpGet(`${portal.baseUrl}/api/views.json`, {
      timeoutMs: MUNICIPAL_TIMEOUT_MS,
      headers: { 'User-Agent': MUNICIPAL_USER_AGENT },
    });
    if (resp.statusCode < 400) return 'socrata';
  } catch (err) {
    console.warn(`[Municipal] Socrata probe failed for ${municipalityId}: ${(err as Error).message}`);
  }

  try {
    // Detect ArcGIS Hub by checking the OGC API Records endpoint
    const resp = await httpGet(`${portal.baseUrl}/api/search/v1/collections/all/items?limit=1`, {
      timeoutMs: MUNICIPAL_TIMEOUT_MS,
      headers: { 'User-Agent': MUNICIPAL_USER_AGENT, 'Accept': 'application/json' },
    });
    if (resp.statusCode < 400) {
      try {
        const body = JSON.parse(resp.body);
        if (body?.type === 'FeatureCollection') return 'arcgis';
      } catch (err) {
        console.warn(`[Municipal] ArcGIS body parse failed for ${municipalityId}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    console.warn(`[Municipal] ArcGIS probe failed for ${municipalityId}: ${(err as Error).message}`);
  }

  return 'custom';
}

/* -------------------------------------------------------------------------- */
/*  Single-dataset fetch — cache-aware, slug-or-UUID-tolerant                 */
/* -------------------------------------------------------------------------- */

/**
 * Common HTTP GET against a CKAN package_show URL. Returns:
 *   { ok: true, body }    — status < 400 and JSON parses
 *   { ok: false, status } — non-2xx (status preserved for retry decisions)
 */
async function ckanPackageShow(
  baseUrl: string,
  idOrSlug: string,
): Promise<{ ok: true; body: unknown } | { ok: false; status: number }> {
  const url = `${baseUrl}/api/3/action/package_show?id=${encodeURIComponent(idOrSlug)}`;
  try {
    const resp = await httpGet(url, {
      timeoutMs: MUNICIPAL_TIMEOUT_MS,
      headers: { 'User-Agent': MUNICIPAL_USER_AGENT },
    });
    if (resp.statusCode < 400) return { ok: true, body: JSON.parse(resp.body) };
    return { ok: false, status: resp.statusCode };
  } catch {
    return { ok: false, status: -1 };
  }
}

/**
 * Attach the original friendly slug to a CKAN payload so downstream
 * parsers/audit-trail can record what was actually requested vs fetched.
 */
function annotateResolved(payload: unknown, slug: string): unknown {
  if (payload && typeof payload === 'object' && 'result' in payload) {
    (payload as Record<string, unknown>).__resolvedFrom = slug;
  }
  return payload;
}

/**
 * Fetch the metadata for a single (municipality, dataset) pair.
 *
 * CKAN branch strategy (cache-aware):
 *   1. Try `package_show?id=<slug>` directly (works for registries using slugs).
 *   2. On 404 → call resolveCkanPackageId() which checks the cached UUID and
 *      triggers a `package_search?q=<slug>&rows=1` discovery if needed.
 *   3. With the discovered UUID, retry `package_show?id=<realId>`.
 *   4. If the cached UUID returns 404 (stale), evict it and re-discover once.
 *
 * The Socrata / ArcGIS / custom branches are unchanged from before.
 */
export async function fetchMunicipalDataset(
  municipalityId: string,
  dataset: string,
): Promise<unknown> {
  const portal = MUNICIPAL_PORTALS[municipalityId];
  if (!portal) throw new Error(`Unknown municipality: ${municipalityId}`);

  if (portal.portalType === 'ckan') {
    // Phase 1: try the friendly slug directly — free if registry uses slugs.
    const direct = await ckanPackageShow(portal.baseUrl, dataset);
    if (direct.ok) return direct.body;

    // Phase 2: self-heal via cached discovery.
    if (direct.status === 404) {
      const realId = await resolveCkanPackageId(portal.baseUrl, dataset);
      if (realId && realId !== dataset) {
        const realResp = await ckanPackageShow(portal.baseUrl, realId);
        if (realResp.ok) return annotateResolved(realResp.body, dataset);

        // Stale cached UUID — evict and try the slug one more time as
        // a last resort before re-discovering (which we already did).
        evictMunicipalIdCache(portal.baseUrl, dataset);
        const slugRetry = await ckanPackageShow(portal.baseUrl, dataset);
        if (slugRetry.ok) return slugRetry.body;
      }
      throw new Error(
        `HTTP 404 fetching ${portal.baseUrl}/api/3/action/package_show?id=${dataset} ` +
          `(no matching package discovered via package_search)`,
      );
    }
    throw new Error(`HTTP ${direct.status} fetching dataset "${dataset}" from ${portal.baseUrl}`);
  }

  if (portal.portalType === 'socrata') {
    // Try the friendly name directly — works when it's already a 4×4 ID.
    const directUrl = `${portal.baseUrl}/resource/${dataset}.json`;
    const direct = await httpGet(directUrl, {
      timeoutMs: MUNICIPAL_TIMEOUT_MS,
      headers: { 'User-Agent': MUNICIPAL_USER_AGENT, 'Accept': 'application/json' },
    });
    if (direct.statusCode < 400) {
      return JSON.parse(direct.body);
    }

    // Phase 2: friendly-name didn't resolve — discover the real 4×4 ID.
    if (direct.statusCode === 404) {
      const realId = await resolveSocrataDatasetId(portal.baseUrl, dataset);
      if (realId && realId !== dataset) {
        const realUrl = `${portal.baseUrl}/resource/${realId}.json`;
        const realResp = await httpGet(realUrl, {
          timeoutMs: MUNICIPAL_TIMEOUT_MS,
          headers: { 'User-Agent': MUNICIPAL_USER_AGENT, 'Accept': 'application/json' },
        });
        if (realResp.statusCode < 400) {
          const payload = JSON.parse(realResp.body);
          if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
            (payload as Record<string, unknown>).__resolvedFrom = dataset;
          }
          return payload;
        }
        // Stale cached ID — evict and retry the slug once before giving up.
        evictMunicipalIdCache(portal.baseUrl, dataset);
        const slugRetry = await httpGet(directUrl, {
          timeoutMs: MUNICIPAL_TIMEOUT_MS,
          headers: { 'User-Agent': MUNICIPAL_USER_AGENT, 'Accept': 'application/json' },
        });
        if (slugRetry.statusCode < 400) return JSON.parse(slugRetry.body);
      }
      throw new Error(
        `HTTP 404 fetching ${directUrl} (no matching view discovered via /api/views.json)`,
      );
    }
    throw new Error(`HTTP ${direct.statusCode} fetching dataset "${dataset}" from ${portal.baseUrl}`);
  }

  // ArcGIS and custom portals keep their original behaviour.
  let url: string;
  if (portal.portalType === 'arcgis') {
    url = `${portal.baseUrl}/api/search/v1/collections/all/items?limit=100`;
  } else if (portal.portalType === 'custom') {
    url = `${portal.baseUrl}/api/${dataset}`;
  } else {
    throw new Error(`Unsupported portal type: ${portal.portalType}`);
  }

  const resp = await httpGet(url, {
    timeoutMs: MUNICIPAL_TIMEOUT_MS,
    headers: { 'User-Agent': MUNICIPAL_USER_AGENT },
  });

  if (resp.statusCode >= 400) {
    throw new Error(`HTTP ${resp.statusCode} fetching ${url}`);
  }

  return JSON.parse(resp.body);
}

/* -------------------------------------------------------------------------- */
/*  Bulk enumeration — used by ingestAllMunicipal / cron sweeps               */
/* -------------------------------------------------------------------------- */

export async function fetchAllMunicipalities(): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];
  for (const [id, portal] of Object.entries(MUNICIPAL_PORTALS)) {
    for (const dataset of portal.datasets) {
      try {
        const data = await fetchMunicipalDataset(id, dataset);
        results.push({ municipalityId: id, dataset, data });
      } catch (err) {
        console.warn(`[Municipal] Fetch failed for ${id}/${dataset}: ${(err as Error).message}`);
      }
    }
  }
  return results;
}
