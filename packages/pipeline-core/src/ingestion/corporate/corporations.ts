/**
 * Corporations Canada Registry Connector — Frostbite Data Pipeline
 *
 * Searches the Corporations Canada online registry for federal corporate
 * entity information.
 *
 * Corporations Canada is part of Innovation, Science and Economic
 * Development Canada (ISED). The registry provides access to federal
 * corporation data including legal name, status, jurisdiction,
 * incorporation date, and registered office address.
 *
 * Search URL: https://ised-isde.canada.ca/cc/lc/gcrecherche-recherche.html
 *
 * Pipeline:
 *   1. Search by entity name
 *   2. Parse HTML results tables
 *   3. Normalize to CorporateEntity schema
 *   4. Persist to database (or return structured data)
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import { CORPORATE_SOURCES } from './constants.js';
import type { HttpResponse } from '../../utils/http.js';
import type { CorporateEntity, CorporateIngestionResult } from './types.js';
import type { D1Database } from '../committees/db.js';


export class CorporationsCanadaFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'CorporationsCanadaFetchError';
  }
}


const DEFAULT_HEADERS = {
  'User-Agent': 'MapleSpikePipeline/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
} as const;

/** Search path for Corporations Canada */
const SEARCH_PATH = 'https://ised-isde.canada.ca/cc/lc/gcrecherche-recherche.html';


/**
 * Fetch raw HTML from a URL.
 */
async function fetchHtml(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const resp: HttpResponse = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS as Record<string, string> },
    timeoutMs: options.timeoutMs ?? 30_000,
  });

  if (resp.statusCode >= 400) {
    throw new CorporationsCanadaFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.body;
}


/**
 * Raw result from a Corporations Canada search.
 */
export interface RawCorporateSearchResult {
  /** Federal corporation number */
  corporationNumber: string;
  /** Legal name */
  legalName: string;
  /** Operating/business names */
  operatingNames: string[];
  /** Jurisdiction code */
  jurisdiction: string;
  /** Status text (e.g. Active, Dissolved) */
  status: string;
  /** Type of corporation */
  corporationType: string;
  /** Source URL */
  sourceUrl: string;
}


/**
 * Search Corporations Canada by entity name.
 *
 * The registry search page accepts a query parameter and returns
 * HTML results with a table of matching corporations.
 */
export async function searchCorporationsCanada(
  query: string,
): Promise<RawCorporateSearchResult[]> {
  const searchUrl = `${SEARCH_PATH}?q=${encodeURIComponent(query)}`;

  try {
    const html = await fetchHtml(searchUrl);
    return parseCorporationsSearchHtml(html, searchUrl);
  } catch (err) {
    console.warn('[CorporationsCanada] Search failed:', (err as Error).message);
    return [];
  }
}


/**
 * Parse Corporations Canada HTML search results table.
 *
 * The search results typically show:
 *   - Corporation Number
 *   - Legal Name
 *   - Operating Name(s)
 *   - Status (Active/Dissolved)
 *   - Jurisdiction (Federal/Provincial)
 *   - Corporation Type
 */
function parseCorporationsSearchHtml(
  html: string,
  sourceUrl: string,
): RawCorporateSearchResult[] {
  const results: RawCorporateSearchResult[] = [];

  // Try to find the results table
  const tablePattern = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tablePattern.exec(html)) !== null) {
    const tableHtml = tableMatch[1];

    // Check if this table has corporation-related headers
    const isCorpTable = /corporation|corp\.|num[eé]ro|legal name|d[eé]nomination|status|active|dissolved/i.test(tableHtml);
    if (!isCorpTable) continue;

    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;
    let isHeader = true;

    while ((rowMatch = rowPattern.exec(tableHtml)) !== null) {
      const cells = rowMatch[1].match(/<td[^>]*>([\s\S]*?)<\/td>/gi);

      if (!cells || cells.length < 3) {
        isHeader = true;
        continue;
      }

      if (isHeader) {
        isHeader = false;
        continue;
      }

      const extractCell = (idx: number): string => {
        const cell = cells[idx];
        if (!cell) return '';
        return cell.replace(/<[^>]+>/g, '').trim();
      };

      const extractLink = (idx: number): string => {
        const cell = cells[idx];
        if (!cell) return '';
        const linkMatch = cell.match(/<a[^>]*href="([^"]*)"[^>]*>/i);
        return linkMatch ? linkMatch[1] : '';
      };

      const corporationNumber = extractCell(0);
      const legalName = extractCell(1);
      const operatingName = extractCell(2);
      const status = extractCell(3);
      const jurisdiction = extractCell(4);

      if (!corporationNumber || !legalName) continue;

      results.push({
        corporationNumber,
        legalName,
        operatingNames: operatingName ? operatingName.split(/[;,]/).map(s => s.trim()).filter(Boolean) : [],
        jurisdiction: jurisdiction || 'Federal',
        status: status || 'Unknown',
        corporationType: extractCell(5) || '',
        sourceUrl: extractLink(0) ? `${SEARCH_PATH}${extractLink(0).startsWith('/') ? '' : '/'}${extractLink(0)}` : sourceUrl,
      });
    }

    // If we found results, break after processing the first matching table
    if (results.length > 0) break;
  }

  // Deduplicate by corporation number
  const seen = new Set<string>();
  return results.filter(r => {
    if (seen.has(r.corporationNumber)) return false;
    seen.add(r.corporationNumber);
    return true;
  });
}


/**
 * Normalize a raw corporate search result into a CorporateEntity.
 */
async function normalizeCorporateEntity(
  raw: RawCorporateSearchResult,
): Promise<CorporateEntity> {
  const contentForHash = JSON.stringify({
    corporationNumber: raw.corporationNumber,
    legalName: raw.legalName,
    jurisdiction: raw.jurisdiction,
    status: raw.status,
    sourceUrl: raw.sourceUrl,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    corporationNumber: raw.corporationNumber,
    legalName: raw.legalName,
    operatingNames: raw.operatingNames,
    jurisdiction: raw.jurisdiction,
    status: raw.status,
    incorporationDate: null,
    officeAddress: null,
    directors: [],
    lastAnnualReturn: null,
    sourceUrl: raw.sourceUrl,
    ingestedAt: new Date().toISOString(),
  };
}


/**
 * Ingest corporate entity data from Corporations Canada.
 */
export async function ingestCorporationsCanada(
  db: D1Database | null,
  options: {
    /** Search query */
    query?: string;
    /** Limit results */
    limit?: number;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<CorporateIngestionResult> {
  const startTime = Date.now();
  const result: CorporateIngestionResult = {
    source: 'corporations-canada',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    const searchQuery = options.query ?? 'Canada';
    log(`[CorporationsCanada] Searching for: "${searchQuery}"...`);

    const searchResults = await searchCorporationsCanada(searchQuery);
    result.recordsFound = searchResults.length;
    log(`[CorporationsCanada] Found ${searchResults.length} corporate entities`);

    if (searchResults.length === 0) {
      log('[CorporationsCanada] No results found.');
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Normalize records
    const entities: CorporateEntity[] = [];
    for (const raw of searchResults) {
      try {
        const entity = await normalizeCorporateEntity(raw);
        entities.push(entity);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Normalize ${raw.corporationNumber}: ${msg}`);
      }
    }

    log(`[CorporationsCanada] Normalized ${entities.length} entities`);

    // Apply limit
    const limited = options.limit ? entities.slice(0, options.limit) : entities;
    result.recordsFound = limited.length;

    // Persist or return
    if (db) {
      let ingested = 0;
      for (const entity of limited) {
        try {
          await db.prepare(`
            INSERT OR REPLACE INTO corporate_entities
              (corporation_number, legal_name, operating_names, jurisdiction,
               status, incorporation_date, office_address, directors,
               last_annual_return, source_url, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            entity.corporationNumber,
            entity.legalName,
            Array.isArray(entity.operatingNames) ? entity.operatingNames.join('; ') : entity.operatingNames,
            entity.jurisdiction,
            entity.status,
            entity.incorporationDate,
            entity.officeAddress,
            Array.isArray(entity.directors) ? entity.directors.join('; ') : entity.directors,
            entity.lastAnnualReturn,
            entity.sourceUrl,
            entity.ingestedAt,
          ).run();
          ingested++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Insert ${entity.corporationNumber}: ${msg}`);
        }
      }
      result.recordsIngested = ingested;
      log(`[CorporationsCanada] Persisted ${ingested} entities`);
    } else {
      result.recordsIngested = limited.length;
      result.records = limited;
      log(`[CorporationsCanada] Dry-run — ${limited.length} entities available`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[CorporationsCanada] ERROR: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}
