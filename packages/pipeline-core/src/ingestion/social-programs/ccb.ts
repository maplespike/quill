/**
 * Canada Child Benefit (CCB) Ingestion — Quill
 *
 * Fetches Canada Child Benefit payment data by federal riding from
 * open.canada.ca CKAN datasets.
 *
 * Data Source: open.canada.ca CKAN
 *   (package_search?q=canada+child+benefit+payments)
 *
 * The CCB dataset includes monthly/annual payments broken down by
 * federal electoral district (riding), with family counts, children
 * covered, and total payments.
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  SOCIAL_SOURCES,
  SOCIAL_CKAN_PACKAGE_IDS,
  ckanPackageShowUrl,
  ckanSearchUrl,
} from './constants.js';
import type { CcbRecord } from './types.js';

import { parseCsvLine } from '../../utils/csv.js';
const SOCIAL_UA = 'MapleSpike/0.1 (social-programs; mailto:hello@maplespike.ca)';

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
 * Search CKAN for CCB datasets.
 */
export async function searchCcbDatasets(
  query: string = 'canada+child+benefit+payments',
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
 * Fetch the CCB CKAN package metadata.
 */
export async function fetchCcbCkanPackage(
  packageId: string = SOCIAL_CKAN_PACKAGE_IDS.CCB_BY_RIDING,
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

// ─── CSV Parser ─────────────────────────────────────────────────────────

async function parseCcbCsv(csv: string, sourceUrl: string): Promise<CcbRecord[]> {
  const records: CcbRecord[] = [];
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

      const period = row['benefit_year'] || row['year'] || row['payment_year'] || row['ref_date'] || '';
      const region = row['riding'] || row['electoral_district'] || row['constituency']
        || row['province'] || row['geo'] || 'Canada';
      const regionTypeRaw = (row['geo_level'] || row['region_type'] || '').toLowerCase();

      let regionType: CcbRecord['regionType'] = 'riding';
      if (regionTypeRaw.includes('province') || regionTypeRaw.includes('provincial') || region === 'Canada') {
        regionType = regionTypeRaw.includes('province') ? 'province' : 'national';
      }
      if (region.toLowerCase() === 'canada') regionType = 'national';

      const families = parseInt((row['families'] || row['number_of_families'] || row['recipients'] || '0').replace(/,/g, ''), 10);
      const children = parseInt((row['children'] || row['number_of_children'] || '').replace(/,/g, ''), 10);
      const totalPayments = parseFloat((row['total_payments'] || row['total_amount'] || row['amount'] || row['value'] || '').replace(/[$,]/g, ''));
      const averagePerFamily = parseFloat((row['average'] || row['average_per_family'] || row['avg_payment'] || '').replace(/[$,]/g, ''));

      const id = await computeHash(
        `ccb:${period}:${region}:${regionType}`,
        'sha256',
      );

      records.push({
        id,
        period: period || 'unknown',
        region,
        regionType,
        families: isNaN(families) ? 0 : families,
        children: isNaN(children) ? null : children,
        totalPayments: isNaN(totalPayments) ? null : totalPayments,
        averagePerFamily: isNaN(averagePerFamily) ? null : averagePerFamily,
        sourceUrl,
        ingestedAt: now,
      });
    } catch {
      // skip
    }
  }

  return records;
}

// ─── Fetch & Parse ──────────────────────────────────────────────────────

/**
 * Fetch and parse CCB data from CKAN.
 */
export async function fetchCcbData(): Promise<{
  records: CcbRecord[];
  errors: string[];
}> {
  const errors: string[] = [];
  const allRecords: CcbRecord[] = [];

  try {
    const pkg = await fetchCcbCkanPackage();
    if (!pkg) {
      errors.push('Failed to fetch CCB CKAN package metadata');
      return { records: [], errors };
    }

    for (const resource of pkg.resources) {
      if (resource.format?.toUpperCase() !== 'CSV') continue;
      try {
        const resp = await httpGet(resource.url, {
          headers: { 'User-Agent': SOCIAL_UA },
          timeoutMs: 30_000,
        });
        if (resp.statusCode === 200 && resp.body.length > 0) {
const parsed = await parseCcbCsv(resp.body, resource.url)
          allRecords.push(...parsed);
        }
      } catch (err) {
        errors.push(`CCB resource ${resource.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    errors.push(`CCB fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { records: allRecords, errors };
}

// ─── Combined Ingest ────────────────────────────────────────────────────

export async function ingestCcb(): Promise<{
  records: CcbRecord[];
  errors: string[];
}> {
  return fetchCcbData();
}

// ─── CSV Utility ────────────────────────────────────────────────────────


