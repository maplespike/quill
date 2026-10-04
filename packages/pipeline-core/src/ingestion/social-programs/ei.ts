/**
 * EI Ingestion — Quill
 *
 * Fetches Employment Insurance (EI) statistics from open.canada.ca CKAN
 * including claims received, claims established, beneficiaries, benefits paid,
 * disqualifications, average duration, and average weekly benefits.
 *
 * Data Source: open.canada.ca CKAN dataset on EI statistics
 *   (package_search?q=employment+insurance+claims+benefits)
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  SOCIAL_SOURCES,
  SOCIAL_CKAN_PACKAGE_IDS,
  ckanPackageShowUrl,
  ckanSearchUrl,
} from './constants.js';
import type { EiRecord, EiCategory } from './types.js';

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
 * Search CKAN for EI datasets.
 */
export async function searchEiDatasets(
  query: string = 'employment+insurance+claims+benefits',
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
 * Fetch the EI statistics CKAN package metadata.
 */
export async function fetchEiCkanPackage(
  packageId: string = SOCIAL_CKAN_PACKAGE_IDS.EI_STATISTICS,
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

// ─── EI Category Detection ──────────────────────────────────────────────

const EI_CATEGORY_KEYWORDS: Record<string, EiCategory> = {
  'claims received': 'claims_received',
  'claims received monthly': 'claims_received',
  'initial claims': 'claims_received',
  'claims established': 'claims_established',
  'number of beneficiaries': 'beneficiaries',
  'total beneficiaries': 'beneficiaries',
  'beneficiaries receiving': 'beneficiaries',
  'benefits paid': 'benefits_paid',
  'total benefits': 'benefits_paid',
  'regular benefits': 'benefits_paid',
  'disqualifications': 'disqualifications',
  'disqualified': 'disqualifications',
  'disqualification rate': 'disqualification_rate',
  'average duration': 'average_duration',
  'weeks of benefits': 'average_duration',
  'average weekly benefit': 'average_weekly_benefit',
  'weekly benefit amount': 'average_weekly_benefit',
};

function detectEiCategory(name: string, description: string): EiCategory {
  const text = `${name} ${description}`.toLowerCase();
  for (const [keyword, category] of Object.entries(EI_CATEGORY_KEYWORDS)) {
    if (text.includes(keyword)) return category;
  }
  return 'claims_received'; // default
}

// ─── CSV Parser ─────────────────────────────────────────────────────────

async function parseEiCsv(csv: string, sourceUrl: string): Promise<EiRecord[]> {
  const records: EiRecord[] = [];
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

      const period = row['ref_date'] || row['period'] || row['month'] || row['year'] || '';
      const province = row['geo'] || row['province'] || row['province_territory'] || 'CA';
      const categoryRaw = row['category'] || row['indicator'] || row['type'] || row['characteristic'] || '';
      const valueStr = row['value'] || row['count'] || row['number'] || row['amount'] || '0';
      const rateStr = row['rate'] || row['pct'] || row['percentage'] || '';
      const sex = row['sex'] || row['gender'] || null;
      const ageGroup = row['age_group'] || row['age'] || null;

      const category = detectEiCategory(categoryRaw, '');
      const value = parseInt(valueStr.replace(/,/g, ''), 10);
      const rate = parseFloat(rateStr.replace(/[%,\s]/g, ''));

      const id = await computeHash(
        `ei:${period}:${province}:${category}:${sex ?? 'na'}:${ageGroup ?? 'na'}`,
        'sha256',
      );

      records.push({
        id,
        period: period || 'unknown',
        province: province || 'CA',
        category,
        value: isNaN(value) ? 0 : value,
        rate: isNaN(rate) ? null : rate,
        sex: sex || null,
        ageGroup: ageGroup || null,
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
 * Fetch and parse EI statistics from CKAN.
 */
export async function fetchEiData(): Promise<{
  records: EiRecord[];
  errors: string[];
}> {
  const errors: string[] = [];
  const allRecords: EiRecord[] = [];

  try {
    const pkg = await fetchEiCkanPackage();
    if (!pkg) {
      errors.push('Failed to fetch EI CKAN package metadata');
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
const parsed = await parseEiCsv(resp.body, resource.url)
          allRecords.push(...parsed);
        }
      } catch (err) {
        errors.push(`EI resource ${resource.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    errors.push(`EI fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { records: allRecords, errors };
}

// ─── Combined Ingest ────────────────────────────────────────────────────

export async function ingestEi(): Promise<{
  records: EiRecord[];
  errors: string[];
}> {
  return fetchEiData();
}

// ─── CSV Utility ────────────────────────────────────────────────────────


