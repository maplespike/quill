/**
 * Tri-Council Grants Ingestion — Quill
 *
 * Ingests CIHR, NSERC, and SSHRC grant award data from open.canada.ca
 * via CKAN package_search and package_show APIs.
 *
 * Each agency publishes its awarded grants as CKAN datasets with CSV
 * resources containing recipient, amount, program, and project details.
 *
 * Sources:
 * - CIHR: https://open.canada.ca/data/dataset/49edb1d7-5cb4-4fa7-897c-515d1aad5da3
 * - NSERC: https://open.canada.ca/data/dataset/c1b0f627-8c29-427c-ab73-33968ad9176e
 * - SSHRC: https://open.canada.ca/data/dataset/b4e2b302-9bc6-4b33-b880-6496f8cef0f1
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  EDU_CKAN_PACKAGE_IDS,
  EDU_CKAN_QUERIES,
  eduCkanSearchUrl,
  eduCkanPackageUrl,
  eduCkanDownloadUrl,
} from './constants.js';
import type { D1Database } from '../committees/db.js';
import type { TriCouncilAgency, TriCouncilGrant, EduIngestionResult } from './types.js';

import { parseCsvLine } from '../../utils/csv.js';
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
/*  Error Class                                                        */
/* ------------------------------------------------------------------ */

export class TriCouncilFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'TriCouncilFetchError';
  }
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
 * Fetch raw text from a URL using the shared HTTP utility.
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
    throw new TriCouncilFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return { statusCode: resp.statusCode, body: resp.body };
}

/**
 * Agency configuration mapping.
 */
interface AgencyConfig {
  packageId: string;
  query: string;
}

const AGENCY_CONFIG: Record<TriCouncilAgency, AgencyConfig> = {
  CIHR: {
    packageId: EDU_CKAN_PACKAGE_IDS.CIHR_GRANTS,
    query: EDU_CKAN_QUERIES.CIHR_GRANTS,
  },
  NSERC: {
    packageId: EDU_CKAN_PACKAGE_IDS.NSERC_GRANTS,
    query: EDU_CKAN_QUERIES.NSERC_GRANTS,
  },
  SSHRC: {
    packageId: EDU_CKAN_PACKAGE_IDS.SSHRC_GRANTS,
    query: EDU_CKAN_QUERIES.SSHRC_GRANTS,
  },
};

/* ------------------------------------------------------------------ */
/*  CKAN Metadata Fetching                                             */
/* ------------------------------------------------------------------ */

/**
 * Fetch CKAN package metadata via the package_show API.
 * Returns the full package metadata including all resources.
 */
export async function fetchTriCouncilCkanMetadata(
  agency: TriCouncilAgency,
  options: { timeoutMs?: number } = {},
): Promise<CkanPackageResponse> {
  const config = AGENCY_CONFIG[agency];
  const url = eduCkanPackageUrl(config.packageId);
  const result = await fetchUrl(url);

  try {
    const parsed = JSON.parse(result.body);
    if (!parsed.success || !parsed.result) {
      throw new TriCouncilFetchError(
        `CKAN API returned error for ${agency}: ${parsed.error?.message ?? 'unknown error'}`,
        undefined,
        url,
      );
    }
    return parsed.result as CkanPackageResponse;
  } catch (err) {
    if (err instanceof TriCouncilFetchError) throw err;
    throw new TriCouncilFetchError(
      `Failed to parse CKAN metadata for ${agency}: ${err instanceof Error ? err.message : String(err)}`,
      undefined,
      url,
    );
  }
}

/**
 * Search for Tri-Council grant datasets via package_search.
 */
export async function searchTriCouncilGrants(
  agency: TriCouncilAgency,
  options: { rows?: number; timeoutMs?: number } = {},
): Promise<any[]> {
  const config = AGENCY_CONFIG[agency];
  const { rows = 10 } = options;
  const url = eduCkanSearchUrl(config.query, rows);
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
 * Find the best matching CSV resource for a given agency.
 * Prefers English CSV, then any CSV, then the most recently modified resource.
 */
export function findBestResource(resources: CkanResource[]): CkanResource | null {
  // Filter to CSV resources
  const csvResources = resources.filter(
    (r) => r.format?.toUpperCase() === 'CSV' || r.format?.toUpperCase() === 'CSV/ZIP',
  );

  if (csvResources.length === 0) return null;

  // Prefer English-named resources
  const enResources = csvResources.filter((r) => {
    const name = (r.name || '').toUpperCase();
    return name.includes('EN') || name.includes('ENG') || name.endsWith('-E.CSV') || name.includes('_E.');
  });

  const candidates = enResources.length > 0 ? enResources : csvResources;

  // Sort by last_modified descending, take most recent
  candidates.sort(
    (a, b) => new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime(),
  );

  return candidates[0];
}

/* ------------------------------------------------------------------ */
/*  CSV Parsing                                                        */
/* ------------------------------------------------------------------ */



/**
 * Parse CSV text into an array of row objects using the header row.
 */
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

/**
 * Normalize a CSV row column name by stripping common variations.
 */
function normalizeColumn(col: string): string {
  return col
    .replace(/[_\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

/**
 * Find a value in a CSV row by matching against possible column name patterns.
 */
function findValue(row: Record<string, string>, patterns: string[]): string {
  const normalizedRow: Record<string, string> = {};
  for (const key of Object.keys(row)) {
    normalizedRow[normalizeColumn(key)] = row[key];
  }

  for (const pattern of patterns) {
    const normalizedPattern = normalizeColumn(pattern);
    const keys = Object.keys(normalizedRow);
    for (const key of keys) {
      if (key.includes(normalizedPattern)) {
        return normalizedRow[key];
      }
    }
  }

  return '';
}

/**
 * Convert a CSV row to a TriCouncilGrant record for the given agency.
 */
async function csvRowToGrant(
  row: Record<string, string>,
  agency: TriCouncilAgency,
  sourceUrl: string,
): Promise<TriCouncilGrant | null> {
  const recipientName = findValue(row, [
    'Recipient Name',
    'Applicant Name',
    'PI Name',
    'Principal Investigator',
    'Researcher Name',
    'Name',
    'Last Name',
  ]);

  const institution = findValue(row, [
    'Recipient Institution',
    'Organization',
    'Institution',
    'University',
    'Applicant Institution',
    'Organization Name',
    'Administering Organization',
  ]);

  const programName = findValue(row, [
    'Program Name',
    'Funding Program',
    'Program',
    'Grant Program',
    'Competition',
    'Funding Opportunity',
  ]);

  const projectTitle = findValue(row, [
    'Project Title',
    'Title',
    'Research Title',
    'Project',
    'Proposal Title',
    'Application Title',
  ]);

  const fiscalYear = findValue(row, [
    'Fiscal Year',
    'Year',
    'Award Year',
    'Fiscal',
    'FiscalYear',
    'Competition Year',
  ]);

  const amountStr = findValue(row, [
    'Grant Amount',
    'Amount',
    'Funding Amount',
    'Award Amount',
    'Funded Amount',
    'Total Amount',
    'Value',
  ]);

  const summary = findValue(row, [
    'Project Summary',
    'Abstract',
    'Summary',
    'Description',
    'Research Summary',
    'Lay Summary',
  ]);

  if (!recipientName || !institution || !programName) {
    return null;
  }

  const grantAmount = parseFloat(amountStr.replace(/[$,]/g, '')) || 0;

  const content = `${agency}|${programName}|${fiscalYear}|${recipientName}|${institution}|${grantAmount}|${projectTitle}|${sourceUrl}`;
  const id = await computeHash(content, 'sha256');

  return {
    id,
    agency,
    programName: programName || programName,
    fiscalYear: fiscalYear || 'unknown',
    recipientName,
    recipientInstitution: institution,
    grantAmount,
    currency: 'CAD',
    projectTitle: projectTitle || 'Untitled Project',
    projectSummary: summary || null,
    sourceUrl,
    ingestedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/*  Ingestion                                                          */
/* ------------------------------------------------------------------ */

/**
 * Ingest Tri-Council grant data for a specific agency (CIHR/NSERC/SSHRC).
 *
 * When db is provided: persists parsed records to the database.
 * When db is null: returns parsed records as structured data (dry-run).
 */
export async function ingestAgencyGrants(
  agency: TriCouncilAgency,
  db: D1Database | null,
  options: { limit?: number; onProgress?: (msg: string) => void } = {},
): Promise<EduIngestionResult> {
  const startTime = Date.now();
  const result: EduIngestionResult = {
    source: `tri-council-${agency.toLowerCase()}`,
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});
  const config = AGENCY_CONFIG[agency];

  try {
    log(`[${agency}] Fetching CKAN metadata for package ${config.packageId}...`);
    const metadata = await fetchTriCouncilCkanMetadata(agency, { timeoutMs: 30000 });

    const resource = findBestResource(metadata.resources);
    if (!resource) {
      log(`[${agency}] No suitable CSV resource found in CKAN package`);
      result.errors.push(`No CSV resource found for ${agency}`);
      result.durationMs = Date.now() - startTime;
      return result;
    }

    log(`[${agency}] Downloading CSV resource: ${resource.name || resource.id}...`);
    let csvText: string;

    try {
      const downloadUrl = eduCkanDownloadUrl(config.packageId, resource.id, resource.name || 'data.csv');
      const resp = await fetchUrl(downloadUrl);
      csvText = resp.body;
    } catch {
      // Fallback: use the resource's direct URL from CKAN
      log(`[${agency}] Falling back to direct resource URL...`);
      const resp = await fetchUrl(resource.url);
      csvText = resp.body;
    }

    const rows = parseCsvToObjects(csvText);
    log(`[${agency}] Parsed ${rows.length} rows from CSV`);

    // Apply limit
    const limitedRows = options.limit ? rows.slice(0, options.limit) : rows;

    const grants: TriCouncilGrant[] = [];
    for (const row of limitedRows) {
      try {
        const grant = await csvRowToGrant(row, agency, resource.url);
        if (grant) {
          grants.push(grant);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Row parse error: ${msg}`);
      }
    }

    result.recordsFound = grants.length;
    log(`[${agency}] ${grants.length} valid grant records parsed`);

    // Deduplicate by ID
    const seen = new Set<string>();
    const uniqueGrants = grants.filter((g) => {
      if (seen.has(g.id)) return false;
      seen.add(g.id);
      return true;
    });

    log(`[${agency}] ${uniqueGrants.length} unique records after dedup`);

    // Persist or return
    if (db) {
      const ingested = await upsertTriCouncilGrants(db, uniqueGrants);
      result.recordsIngested = ingested;
      log(`[${agency}] Persisted ${ingested} grant records`);
    } else {
      result.recordsIngested = uniqueGrants.length;
      result.records = uniqueGrants;
      log(`[${agency}] Dry-run — ${uniqueGrants.length} records available`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[${agency}] ERROR: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/**
 * Ingest all three Tri-Council grant sources.
 * Returns a map of agency to ingestion result.
 */
export async function ingestAllTriCouncilGrants(
  db: D1Database | null,
  options: { limit?: number; onProgress?: (msg: string) => void } = {},
): Promise<Record<string, EduIngestionResult>> {
  const log = options.onProgress ?? (() => {});
  log('=== Tri-Council Grants Ingestion ===');

  const agencies: TriCouncilAgency[] = ['CIHR', 'NSERC', 'SSHRC'];
  const results: Record<string, EduIngestionResult> = {};

  for (const agency of agencies) {
    results[agency.toLowerCase()] = await ingestAgencyGrants(agency, db, options);
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  Database Persistence                                               */
/* ------------------------------------------------------------------ */

/**
 * Upsert Tri-Council grant records into the database.
 * Uses INSERT OR IGNORE to handle duplicates by primary key.
 * Returns the number of rows inserted.
 */
export async function upsertTriCouncilGrants(
  db: D1Database,
  grants: TriCouncilGrant[],
): Promise<number> {
  if (grants.length === 0) return 0;

  let inserted = 0;
  const batchSize = 100;

  for (let i = 0; i < grants.length; i += batchSize) {
    const batch = grants.slice(i, i + batchSize);

    for (const grant of batch) {
      try {
        db.prepare(
          `INSERT OR IGNORE INTO edu_tri_council_grants
            (id, agency, program_name, fiscal_year, recipient_name, recipient_institution,
             grant_amount, currency, project_title, project_summary, source_url, ingested_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(grant.id,
          grant.agency,
          grant.programName,
          grant.fiscalYear,
          grant.recipientName,
          grant.recipientInstitution,
          grant.grantAmount,
          grant.currency,
          grant.projectTitle,
          grant.projectSummary,
          grant.sourceUrl,
          grant.ingestedAt).run()
        inserted++;
      } catch (err) {
        console.error(`[TriCouncil] DB insert error for grant ${grant.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return inserted;
}
