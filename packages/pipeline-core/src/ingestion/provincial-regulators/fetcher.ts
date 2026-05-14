/**
 * Provincial Regulators Fetcher — MapleSpike Pipeline
 *
 * Multi-source fetcher for provincial regulator data across Canada.
 * Sources:
 *   - Provincial CKAN portals (package_search for regulator datasets)
 *   - Known regulator website scraping (decisions, orders, publications)
 *   - Open Canada CKAN federation
 */
import { computeHash } from '../../verification/hashing.js';
import type { ProvincialRegulatorRecord, ProvincialRegulatorsIngestionResult } from './types.js';
import {
  REGULATOR_UA, REGULATOR_TIMEOUT_MS, MAX_REGULATOR_RECORDS,
  PROVINCIAL_CKAN, REGULATORY_KEYWORDS, KNOWN_REGULATORS,
  ALL_REGULATOR_PROVINCES, TOTAL_KNOWN_REGULATORS,
  REGULATOR_CATEGORIES,
} from './constants.js';

async function fetchJson(url: string): Promise<any> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), REGULATOR_TIMEOUT_MS);
    const r = await fetch(url, { headers: { 'User-Agent': REGULATOR_UA }, signal: c.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), REGULATOR_TIMEOUT_MS);
    const r = await fetch(url, { headers: { 'User-Agent': REGULATOR_UA }, signal: c.signal });
    clearTimeout(t);
    return r.ok ? await r.text() : null;
  } catch { return null; }
}

/**
 * Search a provincial CKAN portal for regulator-related datasets.
 */
async function searchProvincialCkan(
  province: string,
  ckanBase: string,
  keyword: string,
): Promise<ProvincialRegulatorRecord[]> {
  const records: ProvincialRegulatorRecord[] = [];
  const now = new Date().toISOString();
  if (!ckanBase) return records;

  // Search for regulator keywords
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

/**
 * Scrape a known regulator's website for recent decisions/publications.
 * Attempts to fetch common decision/order/publication page patterns.
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

/**
 * Fetch all provincial regulator data.
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

  // 2. Known regulator websites (scrape for decisions/publications)
  for (const province of ALL_REGULATOR_PROVINCES) {
    const regulators = KNOWN_REGULATORS[province] ?? [];
    for (const reg of regulators) {
      try {
        const scrapedRecords = await scrapeRegulatorSite(province, reg.name, reg.url, reg.category);
        records.push(...scrapedRecords);
        if (records.length >= MAX_REGULATOR_RECORDS) break;
      } catch (e) {
        errors.push(`${province}/${reg.name}: ${(e as Error).message}`);
      }
    }
    if (records.length >= MAX_REGULATOR_RECORDS) break;
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
