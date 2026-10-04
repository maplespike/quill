/**
 * Poverty Statistics Ingestion — Quill
 *
 * Fetches Canadian poverty statistics from open.canada.ca CKAN datasets
 * covering three measures:
 *   - LICO (Low Income Cut-offs): After-tax income thresholds by community size
 *   - LIM (Low Income Measure): Percentage of population below 50% of median
 *   - MBM (Market Basket Measure): Cost of a basket of goods by region
 *
 * Data Sources:
 *   - LICO: open.canada.ca CKAN (package_search?q=low+income+measure+canada+lico)
 *   - LIM: open.canada.ca CKAN (package_search?q=low+income+measure+after+tax+lim)
 *   - MBM: open.canada.ca CKAN (package_search?q=market+basket+measure+poverty)
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  SOCIAL_CKAN_PACKAGE_IDS,
  SOCIAL_CKAN_QUERIES,
  ckanPackageShowUrl,
  ckanSearchUrl,
} from './constants.js';
import type { PovertyRecord, PovertyMeasure, MbmThreshold } from './types.js';

import { parseCsvLine } from '../../utils/csv.js';
const SOCIAL_UA = 'MapleSpike/0.1 (social-programs; mailto:j_kroeker@reverb256.ca)';

interface CkanResource {
  id: string;
  name: string;
  format: string;
  url: string;
  created: string;
  last_modified: string;
}

interface CkanPackageResult {
  id: string;
  title: string;
  notes: string | null;
  resources: CkanResource[];
}

// ─── CKAN Discovery ─────────────────────────────────────────────────────

/**
 * Search CKAN for poverty datasets by query string.
 */
export async function searchPovertyDatasets(
  query: string = 'low+income+measure+poverty+canada',
): Promise<CkanPackageResult[]> {
  try {
    const url = ckanSearchUrl(query);
    const resp = await httpGet(url, {
      headers: { 'User-Agent': SOCIAL_UA },
      timeoutMs: 20_000,
    });

    const parsed = JSON.parse(resp.body);
    if (!parsed.success || !parsed.result?.results) return [];
    return parsed.result.results as CkanPackageResult[];
  } catch {
    return [];
  }
}

/**
 * Fetch a CKAN package by its known ID.
 */
async function fetchPovertyCkanPackage(
  packageId: string,
): Promise<CkanPackageResult | null> {
  try {
    const url = ckanPackageShowUrl(packageId);
    const resp = await httpGet(url, {
      headers: { 'User-Agent': SOCIAL_UA },
      timeoutMs: 20_000,
    });

    const parsed = JSON.parse(resp.body);
    if (!parsed.success || !parsed.result) return null;
    return parsed.result as CkanPackageResult;
  } catch {
    return null;
  }
}

// ─── Population Group Detection ─────────────────────────────────────────

const POPULATION_KEYWORDS: Record<string, string> = {
  'children': 'children',
  'under 18': 'children',
  '0 to 17': 'children',
  'seniors': 'seniors',
  '65 and over': 'seniors',
  '65+': 'seniors',
  'working age': 'working_age',
  '18 to 64': 'working_age',
  'adults': 'working_age',
  'families': 'families',
  'economic families': 'families',
  'couple families': 'families',
  'lone parent': 'families',
  'unattached': 'unattached',
  'persons not in families': 'unattached',
  'single': 'unattached',
  'total': 'all',
  'all persons': 'all',
  'population': 'all',
};

function detectPopulationGroup(text: string): string {
  const lower = text.toLowerCase();
  for (const [keyword, group] of Object.entries(POPULATION_KEYWORDS)) {
    if (lower.includes(keyword)) return group;
  }
  return 'all';
}

// ─── CSV Parser ─────────────────────────────────────────────────────────

async function parsePovertyCsv(
  csv: string,
  sourceUrl: string,
  measure: PovertyMeasure,
): Promise<PovertyRecord[]> {
  const records: PovertyRecord[] = [];
  const lines = csv.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return records;

  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/["\s]/g, ''));
  const now = new Date().toISOString();

  for (let i = 1; i < lines.length; i++) {
    try {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < 3) continue;

      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = (cols[idx] || '').trim(); });

      const year = row['ref_date'] || row['year'] || row['fiscal_year'] || '';
      const province = row['geo'] || row['province'] || row['province_territory'] || 'CA';
      const groupText = row['population_group'] || row['group'] || row['characteristics'] || row['demographic'] || 'all';
      const populationGroup = detectPopulationGroup(groupText);
      const rate = parseFloat((row['rate'] || row['poverty_rate'] || row['value'] || row['pct'] || '').replace(/[%,\s]/g, ''));
      const count = parseInt((row['count'] || row['persons'] || row['number'] || '').replace(/,/g, ''), 10);
      const medianIncome = parseFloat((row['median_income'] || row['median_after_tax_income'] || row['income'] || '').replace(/[$,]/g, ''));

      const id = await computeHash(
        `poverty:${measure}:${year}:${province}:${populationGroup}`,
        'sha256',
      );

      records.push({
        id,
        year: year || 'unknown',
        measure,
        province: province || 'CA',
        populationGroup,
        rate: isNaN(rate) ? null : rate,
        count: isNaN(count) ? null : count,
        medianIncome: isNaN(medianIncome) ? null : medianIncome,
        sourceUrl,
        ingestedAt: now,
      });
    } catch {
      // skip
    }
  }

  return records;
}

// ─── MBM Thresholds Parser ──────────────────────────────────────────────

function parseMbmThresholdsCsv(
  csv: string,
  sourceUrl: string,
): MbmThreshold[] {
  const records: MbmThreshold[] = [];
  const lines = csv.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return records;

  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/["\s]/g, ''));
  const now = new Date().toISOString();

  for (let i = 1; i < lines.length; i++) {
    try {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < 3) continue;

      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = (cols[idx] || '').trim(); });

      const year = row['ref_date'] || row['year'] || '';
      const province = row['geo'] || row['province'] || '';
      const communitySize = row['community_size'] || row['size_of_area'] || row['area'] || '';
      const t2a2c = parseFloat((row['two_adult_two_child'] || row['threshold_2a2c'] || row['value_2adult_2child'] || '').replace(/[$,]/g, ''));
      const tSingle = parseFloat((row['single_adult'] || row['threshold_single'] || row['value_single'] || '').replace(/[$,]/g, ''));

      const id = `mbm:${year}:${province}:${communitySize}`;

      records.push({
        id,
        year: year || 'unknown',
        province: province || 'CA',
        communitySize: communitySize || 'unknown',
        threshold2adult2child: isNaN(t2a2c) ? null : t2a2c,
        thresholdSingle: isNaN(tSingle) ? null : tSingle,
        sourceUrl,
        ingestedAt: now,
      });
    } catch {
      // skip
    }
  }

  return records;
}

// ─── Fetch → Parse pipeline ─────────────────────────────────────────────

/**
 * Fetch poverty data for a given measure from CKAN.
 */
async function fetchPovertyByMeasure(
  measure: PovertyMeasure,
  packageId: string,
): Promise<{ records: PovertyRecord[]; thresholds: MbmThreshold[]; errors: string[] }> {
  const errors: string[] = [];
  const records: PovertyRecord[] = [];
  const thresholds: MbmThreshold[] = [];

  try {
    const pkg = await fetchPovertyCkanPackage(packageId);
    if (!pkg) {
      errors.push(`Failed to fetch ${measure.toUpperCase()} CKAN package`);
      return { records, thresholds, errors };
    }

    for (const resource of pkg.resources) {
      if (resource.format?.toUpperCase() !== 'CSV') continue;
      try {
        const resp = await httpGet(resource.url, {
          headers: { 'User-Agent': SOCIAL_UA },
          timeoutMs: 30_000,
        });
        if (resp.statusCode !== 200 || resp.body.length === 0) continue;

        // Parse poverty rates
        const parsed = await parsePovertyCsv(resp.body, resource.url, measure);
        records.push(...parsed);

        // For MBM, also parse threshold data
        if (measure === 'mbm') {
          const thresholdsParsed = await parseMbmThresholdsCsv(resp.body, resource.url);
          thresholds.push(...thresholdsParsed);
        }
      } catch (err) {
        errors.push(`${measure.toUpperCase()} resource ${resource.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    errors.push(`${measure.toUpperCase()} fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { records, thresholds, errors };
}

// ─── Combined Ingest ────────────────────────────────────────────────────

/**
 * Fetch all poverty measures (LICO, LIM, MBM) from CKAN.
 */
export async function fetchAllPovertyData(): Promise<{
  records: PovertyRecord[];
  thresholds: MbmThreshold[];
  errors: string[];
}> {
  const [lico, lim, mbm] = await Promise.all([
    fetchPovertyByMeasure('lico', SOCIAL_CKAN_PACKAGE_IDS.LICO),
    fetchPovertyByMeasure('lim', SOCIAL_CKAN_PACKAGE_IDS.LIM),
    fetchPovertyByMeasure('mbm', SOCIAL_CKAN_PACKAGE_IDS.MBM),
  ]);

  return {
    records: [...lico.records, ...lim.records, ...mbm.records],
    thresholds: mbm.thresholds,
    errors: [...lico.errors, ...lim.errors, ...mbm.errors],
  };
}

export async function ingestPoverty(): Promise<{
  records: PovertyRecord[];
  thresholds: MbmThreshold[];
  errors: string[];
}> {
  return fetchAllPovertyData();
}

// ─── CSV Utility ────────────────────────────────────────────────────────


