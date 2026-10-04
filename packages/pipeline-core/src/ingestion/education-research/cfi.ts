/**
 * Canada Foundation for Innovation (CFI) Ingestion — Quill
 *
 * Ingests CFI infrastructure grant award data from open.canada.ca
 * via CKAN package_show API.
 *
 * CFI awards fund research infrastructure at Canadian universities,
 * colleges, research hospitals, and non-profit research institutions.
 *
 * Source: https://open.canada.ca/data/dataset/4112e654-b080-4ce0-a4e4-d739e8f274f7
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  EDU_CKAN_PACKAGE_IDS,
  eduCkanPackageUrl,
  eduCkanDownloadUrl,
} from './constants.js';
import type { D1Database } from '../committees/db.js';
import type { CFIInfrastructure, EduIngestionResult } from './types.js';

import { parseCsvLine } from '../../utils/csv.js';
/* ------------------------------------------------------------------ */
/*  Error Class                                                        */
/* ------------------------------------------------------------------ */

export class CFIError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'CFIError';
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
  'User-Agent': 'MapleSpike/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
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
    throw new CFIError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return { statusCode: resp.statusCode, body: resp.body };
}

/**
 * Infer province from institution name.
 */
function inferProvince(institution: string): string | null {
  const provMap: Record<string, string[]> = {
    'AB': ['alberta', 'university of alberta', 'university of calgary', 'university of lethbridge', 'mount royal university', 'athabasca university', 'southern alberta institute of technology', 'sait', 'northern alberta institute of technology', 'nait', 'lakh'],
    'BC': ['british columbia', 'university of british columbia', 'ubc', 'simon fraser', 'sfu', 'university of victoria', 'uvic', 'university of northern british columbia', 'unbc', 'royal roads', 'kpu', 'capilano', 'vancouver island', 'justin', 'langara', 'bc institute of technology', 'bcit'],
    'MB': ['manitoba', 'university of manitoba', 'university of winnipeg', 'brandon university', 'college', 'red river'],
    'NB': ['new brunswick', 'university of new brunswick', 'unb', 'st. thomas', 'mount allison', 'moncton', 'universite de moncton'],
    'NL': ['newfoundland', 'memorial university', 'mun', 'grenfell', 'marine institut', 'college of the north atlantic'],
    'NS': ['nova scotia', 'dalhousie', 'st. francis xavier', 'stfx', 'saint mary', 'acadia', 'cape breton', 'cbu', 'nscad', 'university of kings college', 'nscc', 'agriculture'],
    'NT': ['northwest territories', 'aurora college'],
    'NU': ['nunavut', 'nunavut arctic college'],
    'ON': ['toronto', 'uoft', 'waterloo', 'western', 'uwo', 'mcmaster', 'queen', 'ottawa', 'carleton', 'york', 'guelph', 'laurentian', 'lakehead', 'nipissing', 'ocad', 'algoma', 'trent', 'wilfrid laurier', 'brock', 'ryerson', 'toronto metropolitan', 'tmu', 'centennial', 'seneca', 'humber', 'george brown', 'sheridan', 'durham', 'fleming', 'fanshawe', 'conestoga', 'mohawk', 'niagara', 'loyalist', 'st. lawrence', 'canadore', 'northern', 'sault', 'cambrian', 'boreal', 'collge nord', 'la cite', 'algoma', 'ontario tech', 'uoin'],
    'PE': ['prince edward island', 'upei', 'holland college'],
    'QC': ['lava', 'montral', 'montreal', 'mcgill', 'concordia', 'uqam', 'uqac', 'uqar', 'uqo', 'uqat', 'uquebec', 'sherbrooke', 'ets', 'hec', 'polytechnique', 'bishops', 'dawson', 'vanier', 'cegep', 'college la', 'champlain'],
    'SK': ['saskatchewan', 'usask', 'university of saskatchewan', 'university of regina', 'uregina', 'first nations university', 'saskatchewan polytech'],
    'YT': ['yukon', 'yukon university'],
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
/*  CKAN Metadata Fetching                                             */
/* ------------------------------------------------------------------ */

/**
 * Fetch CFI CKAN package metadata via package_show.
 */
export async function fetchCFICkanMetadata(
  options: { timeoutMs?: number } = {},
): Promise<CkanPackageResponse> {
  const url = eduCkanPackageUrl(EDU_CKAN_PACKAGE_IDS.CFI_GRANTS);
  const result = await fetchUrl(url);

  try {
    const parsed = JSON.parse(result.body);
    if (!parsed.success || !parsed.result) {
      throw new CFIError(
        `CKAN API returned error: ${parsed.error?.message ?? 'unknown error'}`,
        undefined,
        url,
      );
    }
    return parsed.result as CkanPackageResponse;
  } catch (err) {
    if (err instanceof CFIError) throw err;
    throw new CFIError(
      `Failed to parse CKAN metadata: ${err instanceof Error ? err.message : String(err)}`,
      undefined,
      url,
    );
  }
}

/**
 * Find the best CSV resource for CFI data.
 */
export function findCFIResource(resources: CkanResource[]): CkanResource | null {
  const csvResources = resources.filter(
    (r) => r.format?.toUpperCase() === 'CSV' || r.format?.toUpperCase() === 'CSV/ZIP',
  );

  if (csvResources.length === 0) return null;

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
 * Convert a CSV row to a CFIInfrastructure record.
 */
async function csvRowToCFI(
  row: Record<string, string>,
  sourceUrl: string,
): Promise<CFIInfrastructure | null> {
  const institution = findValue(row, [
    'Institution',
    'Organization',
    'University',
    'Administering Institution',
    'Recipient Institution',
    'Recipient Organization',
    'Institution Name',
  ]);

  const projectTitle = findValue(row, [
    'Project Title',
    'Title',
    'Project Name',
    'Infrastructure Project',
    'Project',
    'Proposal Title',
    'Research Project',
  ]);

  const programName = findValue(row, [
    'Program Name',
    'Program',
    'Funding Program',
    'CFI Program',
    'Competition',
    'Funding Opportunity',
    'Award Program',
  ]);

  const amountStr = findValue(row, [
    'Funding Amount',
    'Amount',
    'Award Amount',
    'Total Amount',
    'CFI Contribution',
    'Awarded Amount',
    'Value',
    'Grant Amount',
  ]);

  const sector = findValue(row, [
    'Infrastructure Sector',
    'Sector',
    'Research Area',
    'Discipline',
    'Field',
    'Research Sector',
    'Infrastructure Area',
  ]);

  if (!institution || !projectTitle || !programName) {
    return null;
  }

  const fundingAmount = parseFloat(amountStr.replace(/[$,]/g, '')) || 0;
  const province = inferProvince(institution);

  const awardDate = findValue(row, [
    'Award Date',
    'Announcement Date',
    'Date',
    'Fiscal Year',
    'AwardYear',
    'Competition Year',
  ]) || null;

  const content = `${institution}|${projectTitle}|${programName}|${fundingAmount}|${sourceUrl}`;
  const id = await computeHash(content, 'sha256');

  return {
    id,
    institution,
    projectTitle: projectTitle || 'Untitled Project',
    programName: programName || 'Unknown Program',
    fundingAmount,
    currency: 'CAD',
    infrastructureSector: sector || null,
    province,
    awardDate,
    sourceUrl,
    ingestedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/*  Ingestion                                                          */
/* ------------------------------------------------------------------ */

/**
 * Ingest Canada Foundation for Innovation infrastructure grant data.
 *
 * When db is provided: persists parsed records to the database.
 * When db is null: returns parsed records as structured data (dry-run).
 */
export async function ingestCFI(
  db: D1Database | null,
  options: { limit?: number; onProgress?: (msg: string) => void } = {},
): Promise<EduIngestionResult> {
  const startTime = Date.now();
  const result: EduIngestionResult = {
    source: 'cfi-infrastructure',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    log('[CFI] Fetching CKAN metadata...');
    const metadata = await fetchCFICkanMetadata({ timeoutMs: 30000 });

    const resource = findCFIResource(metadata.resources);
    if (!resource) {
      log('[CFI] No suitable CSV resource found');
      result.errors.push('No CSV resource found for CFI');
      result.durationMs = Date.now() - startTime;
      return result;
    }

    log(`[CFI] Downloading CSV resource: ${resource.name || resource.id}...`);
    let csvText: string;

    try {
      const downloadUrl = eduCkanDownloadUrl(
        EDU_CKAN_PACKAGE_IDS.CFI_GRANTS,
        resource.id,
        resource.name || 'data.csv',
      );
      const resp = await fetchUrl(downloadUrl);
      csvText = resp.body;
    } catch {
      log('[CFI] Falling back to direct resource URL...');
      const resp = await fetchUrl(resource.url);
      csvText = resp.body;
    }

    const rows = parseCsvToObjects(csvText);
    log(`[CFI] Parsed ${rows.length} rows from CSV`);

    const limitedRows = options.limit ? rows.slice(0, options.limit) : rows;

    const awards: CFIInfrastructure[] = [];
    for (const row of limitedRows) {
      try {
        const award = await csvRowToCFI(row, resource.url);
        if (award) {
          awards.push(award);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Row parse error: ${msg}`);
      }
    }

    result.recordsFound = awards.length;
    log(`[CFI] ${awards.length} valid infrastructure award records parsed`);

    const seen = new Set<string>();
    const uniqueAwards = awards.filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });

    log(`[CFI] ${uniqueAwards.length} unique records after dedup`);

    if (db) {
      const ingested = await upsertCFIRecords(db, uniqueAwards);
      result.recordsIngested = ingested;
      log(`[CFI] Persisted ${ingested} infrastructure award records`);
    } else {
      result.recordsIngested = uniqueAwards.length;
      result.records = uniqueAwards;
      log(`[CFI] Dry-run — ${uniqueAwards.length} records available`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[CFI] ERROR: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/* ------------------------------------------------------------------ */
/*  Database Persistence                                               */
/* ------------------------------------------------------------------ */

/**
 * Upsert CFI infrastructure records into the database.
 */
export async function upsertCFIRecords(
  db: D1Database,
  awards: CFIInfrastructure[],
): Promise<number> {
  if (awards.length === 0) return 0;

  let inserted = 0;
  const batchSize = 100;

  for (let i = 0; i < awards.length; i += batchSize) {
    const batch = awards.slice(i, i + batchSize);

    for (const award of batch) {
      try {
        const stmt = db.prepare(
          `INSERT OR IGNORE INTO edu_cfi_infrastructure
            (id, institution, project_title, program_name, funding_amount, currency,
             infrastructure_sector, province, award_date, source_url, ingested_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        stmt.bind(
          award.id,
          award.institution,
          award.projectTitle,
          award.programName,
          award.fundingAmount,
          award.currency,
          award.infrastructureSector,
          award.province,
          award.awardDate,
          award.sourceUrl,
          award.ingestedAt,
        ).run();
        inserted++;
      } catch (err) {
        console.error(`[CFI] DB insert error for award ${award.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return inserted;
}
