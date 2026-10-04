/**
 * Provincial Regulators Fetcher — Quill
 *
 * Multi-source fetcher for provincial regulator data across Canada.
 * Sources:
 *   - Provincial CKAN portals (package_search for regulator datasets)
 *   - Known regulator website scraping (decisions, orders, publications)
 *   - Open Canada CKAN federation
 *
 * Uses the shared httpGet() utility from ../../utils/http.ts (undici-backed).
 */
import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import type { ProvincialRegulatorRecord, ProvincialRegulatorsIngestionResult } from './types.js';
import {
  REGULATOR_UA, REGULATOR_TIMEOUT_MS, MAX_REGULATOR_RECORDS, MAX_SCRAPE_TARGETS,
  PROVINCIAL_CKAN, REGULATORY_KEYWORDS, KNOWN_REGULATORS,
  ALL_REGULATOR_PROVINCES, TOTAL_KNOWN_REGULATORS,
  REGULATOR_CATEGORIES,
} from './constants.js';

/* ------------------------------------------------------------------ */
/*  Shared helpers (wrapping httpGet)                                  */
/* ------------------------------------------------------------------ */

/** Fetch and parse JSON using the project's httpGet() utility. */
async function fetchJson(url: string): Promise<any> {
  try {
    const resp = await httpGet(url, {
      headers: { 'User-Agent': REGULATOR_UA },
      timeoutMs: REGULATOR_TIMEOUT_MS,
    });
    if (!resp.body) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

/** Fetch raw text using the project's httpGet() utility. */
async function fetchText(url: string): Promise<string | null> {
  try {
    const resp = await httpGet(url, {
      headers: { 'User-Agent': REGULATOR_UA },
      timeoutMs: REGULATOR_TIMEOUT_MS,
    });
    return resp.body || null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  CKAN Portal Search                                                 */
/* ------------------------------------------------------------------ */

/**
 * Search a provincial CKAN portal for regulator-related datasets.
 * Queries the CKAN package_search API with a keyword and returns
 * structured ProvincialRegulatorRecord entries.
 */
async function searchProvincialCkan(
  province: string,
  ckanBase: string,
  keyword: string,
): Promise<ProvincialRegulatorRecord[]> {
  const records: ProvincialRegulatorRecord[] = [];
  const now = new Date().toISOString();
  if (!ckanBase) return records;

  // Search for regulator keywords via CKAN package_search
  const url = `${ckanBase}/package_search?q=${encodeURIComponent(keyword)}&rows=20`;
  const data = await fetchJson(url);
  if (!data?.result?.results) return records;

  for (const pkg of data.result.results) {
    const id = await computeHash(`provreg-${province}-ckan-${pkg.id ?? pkg.name}-${keyword}`, 'sha256');
    records.push({
      id,
      province,
      regulator: pkg.organization?.title ?? `${province} Government`,
      decisionType: 'dataset',
      date: pkg.metadata_modified ?? pkg.metadata_created ?? now,
      summary: (pkg.title ?? '') + (pkg.notes ? ` — ${pkg.notes.substring(0, 200)}` : ''),
      sourceUrl: pkg.url ?? `${ckanBase.replace('/api/3/action', '')}/dataset/${pkg.name ?? ''}`,
      ingestedAt: now,
    });
  }
  return records;
}

/* ------------------------------------------------------------------ */
/*  Regulator Website Scraper                                          */
/* ------------------------------------------------------------------ */

/**
 * Scrape a known regulator's website for recent decisions/publications.
 * Attempts to fetch common decision/order/publication page patterns
 * and extract dated links from the HTML.
 */
async function scrapeRegulatorSite(
  province: string,
  regulatorName: string,
  baseUrl: string,
  category: string,
): Promise<ProvincialRegulatorRecord[]> {
  const records: ProvincialRegulatorRecord[] = [];
  const now = new Date().toISOString();

  // Try common decision/order/news page paths
  const paths = ['/decisions', '/orders', '/news', '/publications', '/rulings', '/en/decisions', '/fr/decisions'];
  for (const path of paths) {
    if (records.length >= 10) break;
    const url = `${baseUrl.replace(/\/+$/, '')}${path}`;
    const html = await fetchText(url);
    if (!html) continue;

    // Extract links with dates (common patterns: YYYY-MM-DD or similar in decision listings)
    const datePattern = /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/g;
    const dates = [...html.matchAll(datePattern)].slice(0, 5);
    const linkPattern = /href="([^"]*\.(?:pdf|html?))"[^>]*>([^<]+)</gi;
    let linkMatch: RegExpExecArray | null;

    while ((linkMatch = linkPattern.exec(html)) !== null && records.length < 10) {
      const linkUrl = linkMatch[1].startsWith('http') ? linkMatch[1] : `${baseUrl.replace(/\/+$/, '')}/${linkMatch[1].replace(/^\//, '')}`;
      const title = linkMatch[2]?.trim();
      if (!title || title.length < 5) continue;

      const date = dates[0]?.[1] ?? now.substring(0, 10);
      const id = await computeHash(`provreg-${province}-${regulatorName}-${linkUrl}`, 'sha256');

      records.push({
        id, province, regulator: regulatorName,
        decisionType: path.replace('/', '').replace(/\/$/, '') || 'publication',
        date, summary: title, sourceUrl: linkUrl, ingestedAt: now,
      });
    }
  }
  return records;
}

/* ------------------------------------------------------------------ */
/*  Main Ingestion Entry Point                                         */
/* ------------------------------------------------------------------ */

/**
 * Fetch all provincial regulator data.
 *
 * Two-phase approach:
 *   1. CKAN portal searches — query the 11 provincial CKAN portals for
 *      regulator-related datasets using regulatory keywords.
 *   2. Known regulator website scraping — visit each known regulator's
 *      website and try to find recent decisions/publications.
 *
 * Returns a ProvincialRegulatorsIngestionResult containing all records,
 * any errors encountered, and timing/source metadata.
 */
export async function ingestAllRegulators(): Promise<ProvincialRegulatorsIngestionResult> {
  const startTime = Date.now();
  const records: ProvincialRegulatorRecord[] = [];
  const errors: string[] = [];

  // 1. CKAN portal searches (one keyword round per province with CKAN)
  for (const [province, ckanBase] of Object.entries(PROVINCIAL_CKAN)) {
    // Search a few representative keywords per province
    const keywords = REGULATORY_KEYWORDS.slice(0, 5);
    for (const kw of keywords) {
      try {
        const ckanRecords = await searchProvincialCkan(province, ckanBase, kw);
        records.push(...ckanRecords);
        if (records.length >= MAX_REGULATOR_RECORDS) break;
      } catch (e) {
        errors.push(`${province} CKAN search "${kw}": ${(e as Error).message}`);
      }
    }
    if (records.length >= MAX_REGULATOR_RECORDS) break;
  }

  // 2. Known regulator websites (scrape for decisions/publications, with limit)
  let scrapeCount = 0;
  for (const province of ALL_REGULATOR_PROVINCES) {
    const regulators = KNOWN_REGULATORS[province] ?? [];
    for (const reg of regulators) {
      if (scrapeCount >= MAX_SCRAPE_TARGETS) break;
      try {
        const scrapedRecords = await scrapeRegulatorSite(province, reg.name, reg.url, reg.category);
        records.push(...scrapedRecords);
        scrapeCount++;
        if (records.length >= MAX_REGULATOR_RECORDS) break;
      } catch (e) {
        errors.push(`${province}/${reg.name}: ${(e as Error).message}`);
      }
    }
    if (scrapeCount >= MAX_SCRAPE_TARGETS || records.length >= MAX_REGULATOR_RECORDS) break;
  }

  return {
    records,
    errors,
    durationMs: Date.now() - startTime,
    sourceCount: Object.keys(PROVINCIAL_CKAN).length + TOTAL_KNOWN_REGULATORS,
  };
}

/**
 * Get coverage summary — how many regulators/categories/provinces are tracked.
 */
export function getRegulatorCoverage() {
  return {
    totalRegulators: TOTAL_KNOWN_REGULATORS,
    provinces: ALL_REGULATOR_PROVINCES,
    categories: REGULATOR_CATEGORIES.map(c => c.code),
    ckanPortals: Object.keys(PROVINCIAL_CKAN).length,
  };
}
