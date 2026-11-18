// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Food Security Ingestion — Quill
 *
 * Fetches data on food banks (HungerCount by Food Banks Canada),
 * homelessness (Reaching Home point-in-time counts from CKAN),
 * and the Canada Disability Benefit (HTML reports).
 *
 * Data Sources:
 *   - Food Banks Canada HungerCount: https://foodbankscanada.ca/ (HTML annual report)
 *   - Homelessness: open.canada.ca CKAN (point-in-time counts)
 *   - Canada Disability Benefit: canada.ca HTML reports
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  SOCIAL_SOURCES,
  SOCIAL_CKAN_PACKAGE_IDS,
  ckanPackageShowUrl,
  ckanSearchUrl,
} from './constants.js';
import type { FoodBankRecord, HomelessnessRecord, DisabilityBenefitRecord } from './types.js';

import { parseCsvLine } from '../../utils/csv.js';
const SOCIAL_UA = 'MapleSpike/0.1 (social-programs; mailto:hello@maplespike.ca)';

// ─── Food Banks ─────────────────────────────────────────────────────────

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

/**
 * Scrape Food Banks Canada HungerCount report for latest data.
 */
export async function fetchFoodBankData(): Promise<{
  records: FoodBankRecord[];
  errors: string[];
}> {
  const errors: string[] = [];
  const records: FoodBankRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(SOCIAL_SOURCES.FOOD_BANKS.HUNGER_COUNT, {
      headers: {
        'User-Agent': SOCIAL_UA,
        Accept: 'text/html',
      },
      timeoutMs: 30_000,
    });

    if (resp.statusCode === 200) {
      const body = resp.body;

      // Try to find structured JSON-LD data
      const jsonLdMatches = body.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
      if (jsonLdMatches) {
        for (const match of jsonLdMatches) {
          try {
            const jsonStr = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
            const data = JSON.parse(jsonStr);
            if (data && typeof data === 'object') {
              const year = new Date().getFullYear().toString();
              const individuals = extractNumber(data, ['individuals', 'totalVisits', 'peopleServed']);
              if (individuals) {
                records.push({
                  id: await computeHash(`foodbank:${year}:CA`, 'sha256'),
                  year,
                  province: 'CA',
                  visits: null,
                  individuals,
                  pctChildren: extractNumber(data, ['pctChildren', 'childrenPercent']),
                  pctSeniors: extractNumber(data, ['pctSeniors', 'seniorsPercent']),
                  pctEmployed: extractNumber(data, ['pctEmployed', 'employedPercent']),
                  sourceUrl: SOCIAL_SOURCES.FOOD_BANKS.HUNGER_COUNT,
                  ingestedAt: now,
                });
              }
            }
          } catch {
            // skip
          }
        }
      }

      // Try to extract numbers from text patterns
      if (records.length === 0) {
        const numberMatches = body.match(/(\d[\d,]*)\s*(?:people|individuals|Canadians)\s+(?:visited|used|relied|accessed)/gi);
        if (numberMatches) {
          const year = new Date().getFullYear().toString();
          for (const match of numberMatches) {
            const numStr = match.match(/(\d[\d,]*)/);
            if (numStr) {
              const num = parseInt(numStr[1].replace(/,/g, ''), 10);
              if (num > 10000) {
                records.push({
                  id: await computeHash(`foodbank:${year}:CA:scraped`, 'sha256'),
                  year,
                  province: 'CA',
                  visits: null,
                  individuals: num,
                  pctChildren: null,
                  pctSeniors: null,
                  pctEmployed: null,
                  sourceUrl: SOCIAL_SOURCES.FOOD_BANKS.HUNGER_COUNT,
                  ingestedAt: now,
                });
                break;
              }
            }
          }
        }
      }
    }
  } catch (err) {
    errors.push(`Food bank scrape failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { records, errors };
}

// ─── Homelessness ───────────────────────────────────────────────────────

/**
 * Search CKAN for homelessness point-in-time count datasets.
 */
export async function searchHomelessnessDatasets(
  query: string = 'homelessness+point+in+time+counts',
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
 * Fetch homelessness CKAN package.
 */
async function fetchHomelessnessCkanPackage(
  packageId: string = SOCIAL_CKAN_PACKAGE_IDS.HOMELESSNESS_COUNTS,
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

async function parseHomelessnessCsv(csv: string, sourceUrl: string): Promise<HomelessnessRecord[]> {
  const records: HomelessnessRecord[] = [];
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

      const year = row['year'] || row['survey_year'] || row['ref_date'] || '';
      const community = row['community'] || row['community_name'] || row['region'] || '';
      const province = row['province'] || row['province_territory'] || row['geo'] || '';

      const total = parseInt((row['total_homeless'] || row['total'] || row['count'] || '0').replace(/,/g, ''), 10);
      const sheltered = parseInt((row['sheltered'] || row['sheltered_count'] || '').replace(/,/g, ''), 10);
      const unsheltered = parseInt((row['unsheltered'] || row['unsheltered_count'] || '').replace(/,/g, ''), 10);
      const pctIndigenous = parseFloat((row['pct_indigenous'] || row['indigenous_pct'] || row['indigenous_percentage'] || '').replace(/[%,\s]/g, ''));
      const youthCount = parseInt((row['youth'] || row['youth_count'] || row['under_25'] || '').replace(/,/g, ''), 10);
      const veteranCount = parseInt((row['veterans'] || row['veteran_count'] || '').replace(/,/g, ''), 10);

      const id = await computeHash(
        `homelessness:${year}:${community}:${province}`,
        'sha256',
      );

      records.push({
        id,
        year: year || 'unknown',
        community: community || 'unknown',
        province: province || 'CA',
        totalHomeless: isNaN(total) ? null : total,
        sheltered: isNaN(sheltered) ? null : sheltered,
        unsheltered: isNaN(unsheltered) ? null : unsheltered,
        pctIndigenous: isNaN(pctIndigenous) ? null : pctIndigenous,
        youthCount: isNaN(youthCount) ? null : youthCount,
        veteranCount: isNaN(veteranCount) ? null : veteranCount,
        sourceUrl,
        ingestedAt: now,
      });
    } catch {
      // skip
    }
  }

  return records;
}

export async function fetchHomelessnessData(): Promise<{
  records: HomelessnessRecord[];
  errors: string[];
}> {
  const errors: string[] = [];
  const allRecords: HomelessnessRecord[] = [];

  try {
    const pkg = await fetchHomelessnessCkanPackage();
    if (!pkg) {
      errors.push('Failed to fetch homelessness CKAN package');
      return { records: allRecords, errors };
    }

    for (const resource of pkg.resources) {
      if (resource.format?.toUpperCase() !== 'CSV') continue;
      try {
        const resp = await httpGet(resource.url, {
          headers: { 'User-Agent': SOCIAL_UA },
          timeoutMs: 30_000,
        });
        if (resp.statusCode === 200 && resp.body.length > 0) {
const parsed = await parseHomelessnessCsv(resp.body, resource.url)
          allRecords.push(...parsed);
        }
      } catch (err) {
        errors.push(`Homelessness resource ${resource.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    errors.push(`Homelessness fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { records: allRecords, errors };
}

// ─── Canada Disability Benefit ──────────────────────────────────────────

async function fetchDisabilityBenefit(): Promise<{
  records: DisabilityBenefitRecord[];
  errors: string[];
}> {
  const errors: string[] = [];
  const records: DisabilityBenefitRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(SOCIAL_SOURCES.DISABILITY_BENEFIT.BASE, {
      headers: {
        'User-Agent': SOCIAL_UA,
        Accept: 'text/html',
      },
      timeoutMs: 20_000,
    });

    if (resp.statusCode === 200) {
      const body = resp.body;
      // Try to find benefit amounts in the HTML
      const dollarMatches = body.match(/\$[\d,]+\s*(?:\/|per)\s*(?:month|year)/gi);
      if (dollarMatches) {
        const year = new Date().getFullYear().toString();
        for (const match of dollarMatches) {
          const amount = parseFloat(match.replace(/[$,]/g, ''));
          if (amount > 0 && amount < 5000) {
            records.push({
              id: await computeHash(`disability:${year}:federal:cdb`, 'sha256'),
              year,
              program: 'Canada Disability Benefit (CDB)',
              jurisdiction: 'federal',
              monthlyBenefit: amount,
              recipients: null,
              sourceUrl: SOCIAL_SOURCES.DISABILITY_BENEFIT.BASE,
              ingestedAt: now,
            });
            break;
          }
        }
      }
    }
  } catch (err) {
    errors.push(`Disability benefit scrape: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { records, errors };
}

// ─── Combined Ingest ────────────────────────────────────────────────────

export async function ingestFoodSecurity(): Promise<{
  foodBanks: FoodBankRecord[];
  homelessness: HomelessnessRecord[];
  disabilityBenefits: DisabilityBenefitRecord[];
  errors: string[];
}> {
  const [foodBankResult, homelessnessResult, disabilityResult] = await Promise.all([
    fetchFoodBankData(),
    fetchHomelessnessData(),
    fetchDisabilityBenefit(),
  ]);

  return {
    foodBanks: foodBankResult.records,
    homelessness: homelessnessResult.records,
    disabilityBenefits: disabilityResult.records,
    errors: [
      ...foodBankResult.errors,
      ...homelessnessResult.errors,
      ...disabilityResult.errors,
    ],
  };
}

// ─── Utility ────────────────────────────────────────────────────────────

function extractNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const cleaned = val.replace(/[$,%]/g, '').trim();
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) return parsed;
    }
  }
  return null;
}


