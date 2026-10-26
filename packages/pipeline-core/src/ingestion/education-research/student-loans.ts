/**
 * Canada Student Loans (CSL) Ingestion — Quill
 *
 * Ingests Canada Student Loans program data from open.canada.ca
 * via CKAN package_show API.
 *
 * Covers:
 *   - Student loan default rates by institution
 *   - Student debt statistics (total debt, average debt, borrowers)
 *   - Repayment rates
 *
 * Sources:
 * - Default rates: https://open.canada.ca/data/dataset/0840231b-5bbf-447f-81ce-3ec0673aefc4
 * - Debt statistics: https://open.canada.ca/data/dataset/8a6a3f7e-dbca-467c-ad55-8ab6ddc7754b
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  EDU_CKAN_PACKAGE_IDS,
  eduCkanPackageUrl,
  eduCkanDownloadUrl,
  eduCkanSearchUrl,
} from './constants.js';
import type { D1Database } from '../committees/db.js';
import type { StudentLoan, EduIngestionResult } from './types.js';

import { parseCsvLine } from '../../utils/csv.js';
/* ------------------------------------------------------------------ */
/*  Error Class                                                        */
/* ------------------------------------------------------------------ */

export class CSLError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'CSLError';
  }
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CkanResource {
  id: string;
  name: string;
  description: string | null;
  format: string;
  url: string;
  created: string;
  last_modified: string;
}

interface CkanPackageResponse {
  id: string;
  title: string;
  notes: string | null;
  resources: CkanResource[];
  organization: { name: string; title: string } | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const DEFAULT_HEADERS = {
  'User-Agent': 'MapleSpike/0.1 (civic-tech; mailto:hello@maplespike.ca)',
  Accept: 'application/json,text/csv,text/plain,*/*',
} as const;

const DEFAULT_TIMEOUT = 30_000;

/**
 * Fetch raw text from a URL.
 */
async function fetchUrl(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<{ statusCode: number; body: string }> {
  const resp = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT,
  });

  if (resp.statusCode >= 400) {
    throw new CSLError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return { statusCode: resp.statusCode, body: resp.body };
}

/* ------------------------------------------------------------------ */
/*  CKAN Metadata Fetching                                             */
/* ------------------------------------------------------------------ */

/**
 * Fetch CKAN package metadata for a given package ID.
 */
export async function fetchCSLCkanMetadata(
  packageId: string,
  options: { timeoutMs?: number } = {},
): Promise<CkanPackageResponse> {
  const url = eduCkanPackageUrl(packageId);
  const result = await fetchUrl(url);

  try {
    const parsed = JSON.parse(result.body);
    if (!parsed.success || !parsed.result) {
      throw new CSLError(
        `CKAN API returned error: ${parsed.error?.message ?? 'unknown error'}`,
        undefined,
        url,
      );
    }
    return parsed.result as CkanPackageResponse;
  } catch (err) {
    if (err instanceof CSLError) throw err;
    throw new CSLError(
      `Failed to parse CKAN metadata: ${err instanceof Error ? err.message : String(err)}`,
      undefined,
      url,
    );
  }
}

/**
 * Search for student loan datasets via CKAN package_search.
 */
export async function searchStudentLoanDatasets(
  options: { rows?: number; timeoutMs?: number } = {},
): Promise<any[]> {
  const { rows = 10 } = options;
  const url = eduCkanSearchUrl('canada student loans default rates debt', rows);
  const result = await fetchUrl(url);

  try {
    const parsed = JSON.parse(result.body);
    if (!parsed.success || !parsed.result?.results) {
      return [];
    }
    return parsed.result.results;
  } catch {
    return [];
  }
}

/**
 * Find the best CSV resource from a CKAN package.
 */
export function findCSLResource(resources: CkanResource[]): CkanResource | null {
  const csvResources = resources.filter(
    (r) => r.format?.toUpperCase() === 'CSV' || r.format?.toUpperCase() === 'CSV/ZIP' || r.format?.toUpperCase() === 'XLSX' || r.format?.toUpperCase() === 'XLS',
  );

  if (csvResources.length === 0) {
    // Fallback: any resource
    return resources.length > 0 ? resources[0] : null;
  }

  // Prefer English
  const enResources = csvResources.filter((r) => {
    const name = (r.name || '').toUpperCase();
    return name.includes('EN') || name.includes('ENG') || name.endsWith('-E.CSV') || name.includes('_E.');
  });

  const candidates = enResources.length > 0 ? enResources : csvResources;

  candidates.sort(
    (a, b) => new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime(),
  );

  return candidates[0];
}

/* ------------------------------------------------------------------ */
/*  CSV Parsing                                                        */


function parseCsvToObjects(csvText: string): Record<string, string>[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.length === 0) continue;

    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length && j < fields.length; j++) {
      row[headers[j]] = fields[j];
    }
    rows.push(row);
  }

  return rows;
}

function normalizeColumn(col: string): string {
  return col
    .replace(/[_\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

function findValue(row: Record<string, string>, patterns: string[]): string {
  const normalizedRow: Record<string, string> = {};
  for (const key of Object.keys(row)) {
    normalizedRow[normalizeColumn(key)] = row[key];
  }

  for (const pattern of patterns) {
    const normalizedPattern = normalizeColumn(pattern);
    for (const key of Object.keys(normalizedRow)) {
      if (key.includes(normalizedPattern)) {
        return normalizedRow[key];
      }
    }
  }

  return '';
}

/**
 * Determine the data type from the resource name/description and row content.
 */
function determineDataType(
  resourceName: string,
  row: Record<string, string>,
): 'default-rate' | 'debt' | 'repayment' | 'other' {
  const combined = `${resourceName} ${Object.values(row).join(' ')}`.toUpperCase();

  if (combined.includes('DEFAULT RATE') || combined.includes('DEFAULT') || combined.includes('RATE')) {
    return 'default-rate';
  }
  if (combined.includes('DEBT') || combined.includes('BORROWER') || combined.includes('BALANCE') || combined.includes('LOAN VALUE')) {
    return 'debt';
  }
  if (combined.includes('REPAYMENT') || combined.includes('REPAY') || combined.includes('PAYMENT')) {
    return 'repayment';
  }

  return 'other';
}

/**
 * Convert a CSV row to a StudentLoan record.
 */
async function csvRowToStudentLoan(
  row: Record<string, string>,
  resourceName: string,
  sourceUrl: string,
): Promise<StudentLoan | null> {
  const institution = findValue(row, [
    'Institution',
    'Institution Name',
    'School Name',
    'University',
    'College',
    'Educational Institution',
    'Post Secondary Institution',
    'PSI Name',
    'PSE Institution',
  ]);

  const province = findValue(row, [
    'Province',
    'Province/Territory',
    'Province/State',
    'Territory',
    'Prov',
    'Jurisdiction',
    'Region',
  ]);

  const programYear = findValue(row, [
    'Program Year',
    'Fiscal Year',
    'Year',
    'Academic Year',
    'Cohort Year',
    'Award Year',
    'Measurement Year',
  ]);

  const defaultRateStr = findValue(row, [
    'Default Rate',
    'DefaultRate',
    'Default Rate %',
    'Rate',
    'Percentage Default',
    'DEFAULT_RATE',
  ]);

  const borrowersStr = findValue(row, [
    'Borrowers',
    'Number of Borrowers',
    'Borrowers Count',
    'Total Borrowers',
    'Borrower Count',
    'Num Borrowers',
    'Borrower Number',
  ]);

  const debtStr = findValue(row, [
    'Total Debt',
    'Total Debt $',
    'Debt Total',
    'Outstanding Debt',
    'Loan Balance',
    'Total Loans',
  ]);

  const averageDebtStr = findValue(row, [
    'Average Debt',
    'Average Debt $',
    'Avg Debt',
    'Average Loan',
    'Mean Debt',
  ]);

  const repaymentStr = findValue(row, [
    'Repayment Rate',
    'RepaymentRate',
    'Repayment Rate %',
    'Percentage Repaying',
    'Repayment %',
  ]);

  if (!institution) return null;

  const dataType = determineDataType(resourceName, row);

  // Parse numeric fields
  const defaultRate = defaultRateStr ? parseFloat(defaultRateStr.replace(/[%$,]/g, '')) : null;
  const borrowersCount = borrowersStr ? parseInt(borrowersStr.replace(/[,$]/g, ''), 10) || null : null;
  const totalDebt = debtStr ? parseFloat(debtStr.replace(/[$,]/g, '')) : null;
  const averageDebt = averageDebtStr ? parseFloat(averageDebtStr.replace(/[$,]/g, '')) : null;
  const repaymentRate = repaymentStr ? parseFloat(repaymentStr.replace(/[%$,]/g, '')) : null;

  const content = `${institution}|${province}|${programYear}|${defaultRate ?? ''}|${dataType}|${sourceUrl}`;
  const id = await computeHash(content, 'sha256');

  return {
    id,
    institution,
    province: province || inferProvince(institution) || 'Unknown',
    programYear: programYear || 'unknown',
    defaultRate,
    borrowersCount,
    totalDebt,
    averageDebt,
    repaymentRate,
    dataType,
    sourceUrl,
    ingestedAt: new Date().toISOString(),
  };
}

/**
 * Simple province inference from institution name.
 */
function inferProvince(institution: string): string | null {
  const provMap: Record<string, string[]> = {
    'AB': ['alberta', 'calgary', 'lethbridge', 'athabasca', 'mount royal', 'sait', 'nait'],
    'BC': ['british columbia', 'ubc', 'victoria', 'simon fraser', 'sfu', 'northern british columbia', 'unbc', 'kpu'],
    'MB': ['manitoba', 'winnipeg', 'brandon', 'red river'],
    'NB': ['new brunswick', 'unb', 'moncton', 'mount allison', 'st. thomas'],
    'NL': ['newfoundland', 'memorial', 'grenfell'],
    'NS': ['nova scotia', 'dalhousie', 'acadia', 'st. francis', 'saint mary', 'cape breton', 'nscad'],
    'NT': ['northwest territories', 'aurora'],
    'NU': ['nunavut'],
    'ON': ['toronto', 'waterloo', 'western', 'mcmaster', 'queen', 'ottawa', 'carleton', 'york', 'guelph', 'laurentian', 'lakehead', 'nipissing', 'trent', 'brock', 'ryerson', 'ontario tech', 'algoma', 'centennial', 'seneca', 'humber', 'sheridan', 'durham', 'conestoga', 'fanshawe'],
    'PE': ['prince edward island', 'upei', 'holland'],
    'QC': ['lava', 'montral', 'montreal', 'mcgill', 'concordia', 'uqam', 'uqac', 'sherbrooke', 'bishops'],
    'SK': ['saskatchewan', 'regina', 'first nations'],
    'YT': ['yukon'],
  };

  const lower = institution.toLowerCase();
  for (const [prov, keywords] of Object.entries(provMap)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return prov;
    }
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Ingestion                                                          */
/* ------------------------------------------------------------------ */

/**
 * Ingest Canada Student Loans data from a specific CKAN package.
 *
 * @param packageId - CKAN package ID for the specific student loan dataset
 * @param db - Database instance or null for dry-run
 * @param options - Optional parameters
 */
export async function ingestStudentLoansPackage(
  packageId: string,
  db: D1Database | null,
  options: { limit?: number; onProgress?: (msg: string) => void } = {},
): Promise<EduIngestionResult> {
  const startTime = Date.now();
  const result: EduIngestionResult = {
    source: `student-loans-${packageId.substring(0, 8)}`,
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    log(`[CSL] Fetching CKAN metadata for package ${packageId}...`);
    const metadata = await fetchCSLCkanMetadata(packageId, { timeoutMs: 30000 });

    const resource = findCSLResource(metadata.resources);
    if (!resource) {
      log('[CSL] No suitable resource found');
      result.errors.push('No resource found for CSL package');
      result.durationMs = Date.now() - startTime;
      return result;
    }

    log(`[CSL] Downloading resource: ${resource.name || resource.id}...`);
    let csvText: string;

    try {
      const downloadUrl = eduCkanDownloadUrl(packageId, resource.id, resource.name || 'data.csv');
      const resp = await fetchUrl(downloadUrl);
      csvText = resp.body;
    } catch {
      log('[CSL] Falling back to direct resource URL...');
      const resp = await fetchUrl(resource.url);
      csvText = resp.body;
    }

    const rows = parseCsvToObjects(csvText);
    log(`[CSL] Parsed ${rows.length} rows from CSV`);

    const limitedRows = options.limit ? rows.slice(0, options.limit) : rows;

    const loans: StudentLoan[] = [];
    for (const row of limitedRows) {
      try {
        const loan = await csvRowToStudentLoan(row, resource.name || '', resource.url);
        if (loan) {
          loans.push(loan);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Row parse error: ${msg}`);
      }
    }

    result.recordsFound = loans.length;
    log(`[CSL] ${loans.length} valid student loan records parsed`);

    const seen = new Set<string>();
    const uniqueLoans = loans.filter((l) => {
      if (seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    });

    log(`[CSL] ${uniqueLoans.length} unique records after dedup`);

    if (db) {
      const ingested = await upsertStudentLoans(db, uniqueLoans);
      result.recordsIngested = ingested;
      log(`[CSL] Persisted ${ingested} student loan records`);
    } else {
      result.recordsIngested = uniqueLoans.length;
      result.records = uniqueLoans;
      log(`[CSL] Dry-run — ${uniqueLoans.length} records available`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[CSL] ERROR: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/**
 * Ingest all Canada Student Loans datasets (default rates + debt statistics).
 */
export async function ingestAllStudentLoans(
  db: D1Database | null,
  options: { limit?: number; onProgress?: (msg: string) => void } = {},
): Promise<Record<string, EduIngestionResult>> {
  const log = options.onProgress ?? (() => {});
  log('=== Canada Student Loans Ingestion ===');

  const results: Record<string, EduIngestionResult> = {};

  // Ingest default rates package
  results['default-rates'] = await ingestStudentLoansPackage(
    EDU_CKAN_PACKAGE_IDS.CSL_DEFAULT_RATES,
    db,
    options,
  );

  // Ingest debt statistics package
  results['debt-statistics'] = await ingestStudentLoansPackage(
    EDU_CKAN_PACKAGE_IDS.CSL_DEBT,
    db,
    options,
  );

  return results;
}

/* ------------------------------------------------------------------ */
/*  Database Persistence                                               */
/* ------------------------------------------------------------------ */

/**
 * Upsert student loan records into the database.
 */
export async function upsertStudentLoans(
  db: D1Database,
  loans: StudentLoan[],
): Promise<number> {
  if (loans.length === 0) return 0;

  let inserted = 0;
  const batchSize = 100;

  for (let i = 0; i < loans.length; i += batchSize) {
    const batch = loans.slice(i, i + batchSize);

    for (const loan of batch) {
      try {
        db.prepare(
          `INSERT OR IGNORE INTO edu_student_loans
            (id, institution, province, program_year, default_rate, borrowers_count,
             total_debt, average_debt, repayment_rate, data_type, source_url, ingested_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(loan.id,
          loan.institution,
          loan.province,
          loan.programYear,
          loan.defaultRate,
          loan.borrowersCount,
          loan.totalDebt,
          loan.averageDebt,
          loan.repaymentRate,
          loan.dataType,
          loan.sourceUrl,
          loan.ingestedAt).run()
        inserted++;
      } catch (err) {
        console.error(`[CSL] DB insert error for loan ${loan.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return inserted;
}
