/**
 * CPP/OAS Ingestion — Quill
 *
 * Fetches Canada Pension Plan (CPP) and Old Age Security (OAS) beneficiary
 * data from open.canada.ca CKAN, plus CPPIB investment data from
 * cppinvestments.com annual reports.
 *
 * Data Sources:
 *   - CPP/OAS beneficiaries: open.canada.ca CKAN datasets
 *   - CPPIB investments: https://www.cppinvestments.com/ annual report
 *     (HTML scraping — public financial reports)
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  SOCIAL_SOURCES,
  SOCIAL_CKAN_PACKAGE_IDS,
  ckanPackageShowUrl,
  ckanSearchUrl,
} from './constants.js';
import type { CppOasBeneficiary, CppibInvestment, CppOasProgram } from './types.js';

import { parseCsvLine } from '../../utils/csv.js';
const SOCIAL_UA = 'MapleSpike/0.1 (social-programs; mailto:hello@maplespike.ca)';

// ─── CKAN Fetcher ───────────────────────────────────────────────────────

interface CkanPackageResult {
  id: string;
  title: string;
  notes: string | null;
  resources: Array<{
    id: string;
    name: string;
    format: string;
    url: string;
    created: string;
    last_modified: string;
  }>;
}

/**
 * Search CKAN for CPP/OAS datasets.
 */
export async function searchCppOasDatasets(
  query: string = 'canada+pension+plan+old+age+security+beneficiaries',
): Promise<CkanPackageResult[]> {
  const url = ckanSearchUrl(query);
  const resp = await httpGet(url, {
    headers: { 'User-Agent': SOCIAL_UA },
    timeoutMs: 20_000,
  });

  const parsed = JSON.parse(resp.body);
  if (!parsed.success || !parsed.result?.results) {
    return [];
  }
  return parsed.result.results as CkanPackageResult[];
}

/**
 * Fetch CKAN package metadata for a known package ID.
 */
export async function fetchCppOasCkanPackage(
  packageId: string = SOCIAL_CKAN_PACKAGE_IDS.CPP_OAS_BENEFICIARIES,
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

// ─── CPP/OAS Beneficiaries ──────────────────────────────────────────────

/**
 * Parse CPP/OAS beneficiary data from CKAN CSV resources.
 *
 * The CSV typically contains columns: year, province, program, beneficiaries, gender, age_group
 */
async function parseCppOasCsv(
  csv: string,
  sourceUrl: string,
): Promise<CppOasBeneficiary[]> {
  const records: CppOasBeneficiary[] = [];
  const lines = csv.split('\n').filter(line => line.trim().length > 0);
  if (lines.length < 2) return records;

  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/["\s]/g, ''));
  const now = new Date().toISOString();

  for (let i = 1; i < lines.length; i++) {
    try {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < 3) continue;

      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = (cols[idx] || '').trim(); });

      const year = row['year'] || row['ref_date'] || row['fiscal_year'] || '';
      const province = row['province'] || row['geo'] || 'CA';
      const programRaw = (row['program'] || row['benefit_type'] || row['pension_type'] || '').toLowerCase();
      const beneficiaries = parseInt(row['beneficiaries'] || row['value'] || row['count'] || '0', 10);
      const gender = row['gender'] || row['sex'] || null;
      const ageGroup = row['age_group'] || row['age'] || null;
      const benefitsPaid = parseFloat(row['benefits_paid'] || row['amount'] || row['benefits'] || '');

      // Map program to canonical type
      let program: CppOasProgram = 'cpp';
      if (programRaw.includes('oas') || programRaw.includes('old age')) program = 'oas';
      else if (programRaw.includes('gis') || programRaw.includes('guaranteed')) program = 'gis';
      else if (programRaw.includes('allowance')) program = 'allowance';

      const id = await computeHash(
        `cpp_oas:${year}:${province}:${program}:${gender ?? 'na'}:${ageGroup ?? 'na'}`,
        'sha256',
      );

      records.push({
        id,
        program,
        year,
        beneficiaries: isNaN(beneficiaries) ? 0 : beneficiaries,
        province: province || 'CA',
        gender: gender || null,
        ageGroup: ageGroup || null,
        benefitsPaid: isNaN(benefitsPaid) ? null : benefitsPaid,
        sourceUrl,
        ingestedAt: now,
      });
    } catch {
      // Skip malformed rows
    }
  }

  return records;
}

/**
 * Fetch CPP/OAS beneficiary data from CKAN.
 */
export async function fetchCppOasBeneficiaries(): Promise<{
  records: CppOasBeneficiary[];
  errors: string[];
}> {
  const errors: string[] = [];
  const allRecords: CppOasBeneficiary[] = [];

  try {
    const pkg = await fetchCppOasCkanPackage();
    if (!pkg) {
      errors.push('Failed to fetch CPP/OAS CKAN package metadata');
      return { records: [], errors };
    }

    // Try each CSV resource
    for (const resource of pkg.resources) {
      if (resource.format?.toUpperCase() !== 'CSV') continue;
      try {
        const resp = await httpGet(resource.url, {
          headers: { 'User-Agent': SOCIAL_UA },
          timeoutMs: 30_000,
        });
        if (resp.statusCode === 200 && resp.body.length > 0) {
const parsed = await parseCppOasCsv(resp.body, resource.url)
          allRecords.push(...parsed);
        }
      } catch (err) {
        errors.push(`Failed to fetch resource ${resource.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    errors.push(`CPP/OAS fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { records: allRecords, errors };
}

// ─── CPPIB Investments ──────────────────────────────────────────────────

/**
 * Fetch CPPIB investment data from the annual report page.
 * Uses HTML scraping as CPPIB does not provide a CKAN API.
 */
export async function fetchCppibInvestments(): Promise<{
  records: CppibInvestment[];
  errors: string[];
}> {
  const errors: string[] = [];
  const records: CppibInvestment[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(SOCIAL_SOURCES.CPPIB.ANNUAL_REPORT, {
      headers: {
        'User-Agent': SOCIAL_UA,
        Accept: 'text/html,application/json',
      },
      timeoutMs: 30_000,
    });

    if (resp.statusCode !== 200) {
      errors.push(`CPPIB annual report fetch returned ${resp.statusCode}`);
      return { records, errors };
    }

    // Try to parse structured data (JSON-LD or inline JSON)
    // CPPIB reports often embed data in script tags or tables
    const body = resp.body;

    // Look for JSON-LD structured data
    const jsonLdMatches = body.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatches) {
      for (const match of jsonLdMatches) {
        try {
          const jsonStr = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
          const data = JSON.parse(jsonStr);
          if (data && typeof data === 'object') {
            // Extract any financial data we can find
            const year = new Date().getFullYear().toString();
            const totalAssets = extractNumericValue(data, ['totalAssets', 'assetsUnderManagement', 'aum', 'netAssets']);
            if (totalAssets) {
              records.push({
                id: await computeHash(`cppib:${year}`, 'sha256'),
                year,
                totalAssets,
                netReturn: extractNumericValue(data, ['netReturn', 'annualReturn', 'return']),
                return5yr: extractNumericValue(data, ['fiveYearReturn', 'return5yr']),
                return10yr: extractNumericValue(data, ['tenYearReturn', 'return10yr']),
                assetAllocation: data['assetAllocation'] ? JSON.stringify(data['assetAllocation']) : null,
                sourceUrl: SOCIAL_SOURCES.CPPIB.ANNUAL_REPORT,
                ingestedAt: now,
              });
            }
          }
        } catch {
          // Skip unparseable JSON-LD blocks
        }
      }
    }

    // Fallback: try to find data in tables
    if (records.length === 0) {
      const tableMatches = body.match(/<table[^>]*>([\s\S]*?)<\/table>/gi);
      if (tableMatches) {
        for (const table of tableMatches) {
          const tableText = table.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          const assetMatch = tableText.match(/(\d[\d,]*)\s*(?:billion|trillion|million)?\s*(?:in\s+)?(?:assets|AUM|under\s+management)/i);
          if (assetMatch) {
            const totalAssets = parseFloat(assetMatch[1].replace(/,/g, ''));
            if (totalAssets > 0) {
              const year = new Date().getFullYear().toString();
              records.push({
                id: await computeHash(`cppib:${year}:table`, 'sha256'),
                year,
                totalAssets,
                netReturn: null,
                return5yr: null,
                return10yr: null,
                assetAllocation: null,
                sourceUrl: SOCIAL_SOURCES.CPPIB.ANNUAL_REPORT,
                ingestedAt: now,
              });
            }
          }
        }
      }
    }
  } catch (err) {
    errors.push(`CPPIB fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { records, errors };
}

/**
 * Extract a numeric value from a nested object by trying multiple keys.
 */
function extractNumericValue(obj: Record<string, unknown>, keys: string[]): number | null {
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

// ─── Combined Ingest ────────────────────────────────────────────────────

export async function ingestCppOas(): Promise<{
  beneficiaries: CppOasBeneficiary[];
  investments: CppibInvestment[];
  errors: string[];
}> {
  const [beneficiariesResult, investmentsResult] = await Promise.all([
    fetchCppOasBeneficiaries(),
    fetchCppibInvestments(),
  ]);

  return {
    beneficiaries: beneficiariesResult.records,
    investments: investmentsResult.records,
    errors: [...beneficiariesResult.errors, ...investmentsResult.errors],
  };
}

// ─── CSV Parsing Utility ────────────────────────────────────────────────


