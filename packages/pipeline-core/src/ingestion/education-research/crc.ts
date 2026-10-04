/**
 * Canada Research Chairs (CRC) Ingestion — Quill
 *
 * Ingests Canada Research Chairs holder data from open.canada.ca
 * via CKAN package_show API.
 *
 * The CRC program awards Tier 1 (senior, 7-year) and Tier 2 (emerging, 5-year)
 * chairs to outstanding researchers at Canadian universities.
 *
 * Source: https://open.canada.ca/data/dataset/9606b8cd-0c80-4b3b-a771-e8872b9d6616
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  EDU_CKAN_PACKAGE_IDS,
  eduCkanPackageUrl,
  eduCkanDownloadUrl,
} from './constants.js';
import type { D1Database } from '../committees/db.js';
import type { ResearchChair, EduIngestionResult } from './types.js';

import { parseCsvLine } from '../../utils/csv.js';
/* ------------------------------------------------------------------ */
/*  Error Class                                                        */
/* ------------------------------------------------------------------ */

export class CRCError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'CRCError';
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
    throw new CRCError(
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
 * Fetch CRC CKAN package metadata via package_show.
 */
export async function fetchCRCCkanMetadata(
  options: { timeoutMs?: number } = {},
): Promise<CkanPackageResponse> {
  const url = eduCkanPackageUrl(EDU_CKAN_PACKAGE_IDS.CRC_HOLDERS);
  const result = await fetchUrl(url);

  try {
    const parsed = JSON.parse(result.body);
    if (!parsed.success || !parsed.result) {
      throw new CRCError(
        `CKAN API returned error: ${parsed.error?.message ?? 'unknown error'}`,
        undefined,
        url,
      );
    }
    return parsed.result as CkanPackageResponse;
  } catch (err) {
    if (err instanceof CRCError) throw err;
    throw new CRCError(
      `Failed to parse CKAN metadata: ${err instanceof Error ? err.message : String(err)}`,
      undefined,
      url,
    );
  }
}

/**
 * Find the best CSV resource for CRC data.
 */
export function findCRCResource(resources: CkanResource[]): CkanResource | null {
  const csvResources = resources.filter(
    (r) => r.format?.toUpperCase() === 'CSV' || r.format?.toUpperCase() === 'CSV/ZIP',
  );

  if (csvResources.length === 0) return null;

  // Prefer English resources
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
/* ------------------------------------------------------------------ */



/**
 * Parse CSV text into row objects.
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
 * Normalize column name for fuzzy matching.
 */
function normalizeColumn(col: string): string {
  return col
    .replace(/[_\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

/**
 * Find a value by fuzzy matching column name patterns.
 */
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
 * Extract the prov&/territory from an institution name.
 */
function inferProvince(institution: string): string | null {
  const provMap: Record<string, string[]> = {
    'AB': ['alberta', 'university of alberta', 'university of calgary', 'university of lethbridge', 'mount royal university', 'athabasca university'],
    'BC': ['british columbia', 'university of british columbia', 'simon fraser', 'university of victoria', 'university of northern british columbia', 'royal roads', 'kpu', 'capilano'],
    'MB': ['manitoba', 'university of manitoba', 'university of winnipeg', 'brandon university'],
    'NB': ['new brunswick', 'university of new brunswick', 'st. thomas', 'mount allison'],
    'NL': ['newfoundland', 'memorial university', 'grenfell'],
    'NS': ['nova scotia', 'dalhousie', 'st. francis xavier', 'saint mary\'s', 'acadia', 'cape breton', 'nscad', 'university of kings college'],
    'NT': ['northwest territories', 'aurora college'],
    'NU': ['nunavut', 'nunavut arctic college'],
    'ON': ['toronto', 'waterloo', 'western', 'mcmaster', 'queen\'s', 'ottawa', 'carleton', 'york', 'guelph', 'laurentian', 'northern ontario', 'nipissing', 'ocad', 'algoma', 'lakehead', 'trent', 'wilfrid laurier', 'brock', 'ryerson', 'toronto metropolitan'],
    'PE': ['prince edward island', 'upei'],
    'QC': ['lava', 'montreal', 'mcgill', 'concordia', 'uqam', 'uqac', 'uqar', 'uqo', 'uqat', 'uquebec', 'sherbrooke', 'ets', 'hec', 'polytechnique', 'bishops'],
    'SK': ['saskatchewan', 'university of saskatchewan', 'university of regina', 'first nations university'],
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

/**
 * Convert a CSV row to a ResearchChair record.
 */
async function csvRowToChair(
  row: Record<string, string>,
  sourceUrl: string,
): Promise<ResearchChair | null> {
  const chairholderName = findValue(row, [
    'Chairholder Name',
    'Name',
    'Researcher Name',
    'Full Name',
    'Nominee Name',
    'Holder Name',
  ]);

  const institution = findValue(row, [
    'Institution',
    'University',
    'Organization',
    'Administering Institution',
    'Host University',
    'University Name',
  ]);

  const tierStr = findValue(row, [
    'Tier',
    'Chair Tier',
    'Tier Type',
    'Level',
  ]);

  const discipline = findValue(row, [
    'Discipline',
    'Field',
    'Research Discipline',
    'Area',
    'Research Area',
    'Field of Research',
  ]);

  if (!chairholderName || !institution) {
    return null;
  }

  // Normalize tier
  const tierUpper = tierStr.toUpperCase();
  const tier: 'Tier 1' | 'Tier 2' = tierUpper.includes('TIER 1') || tierUpper.includes('TIER I')
    ? 'Tier 1'
    : 'Tier 2';

  const program = findValue(row, ['Program', 'Chair Program', 'Funding Program']) || null;

  const startDate = findValue(row, [
    'Start Date',
    'Start Date of Chair',
    'Appointment Date',
    'Effective Date',
  ]) || null;

  const awardDate = findValue(row, [
    'Award Date',
    'Announcement Date',
    'Date of Award',
    'AwardAnnouncementDate',
  ]) || null;

  const content = `${chairholderName}|${institution}|${tier}|${discipline}|${sourceUrl}`;
  const id = await computeHash(content, 'sha256');

  return {
    id,
    chairholderName,
    institution,
    tier,
    discipline: discipline || 'Not specified',
    program,
    startDate,
    awardDate,
    sourceUrl,
    ingestedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/*  Ingestion                                                          */
/* ------------------------------------------------------------------ */

/**
 * Ingest Canada Research Chairs data.
 *
 * When db is provided: persists parsed records to the database.
 * When db is null: returns parsed records as structured data (dry-run).
 */
export async function ingestCRC(
  db: D1Database | null,
  options: { limit?: number; onProgress?: (msg: string) => void } = {},
): Promise<EduIngestionResult> {
  const startTime = Date.now();
  const result: EduIngestionResult = {
    source: 'research-chairs',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    log('[CRC] Fetching CKAN metadata...');
const metadata = await fetchCRCCkanMetadata({ timeoutMs: 30000 });

    const resource = findCRCResource(metadata.resources);
    if (!resource) {
      log('[CRC] No suitable CSV resource found');
      result.errors.push('No CSV resource found for CRC');
      result.durationMs = Date.now() - startTime;
      return result;
    }

    log(`[CRC] Downloading CSV resource: ${resource.name || resource.id}...`);
    let csvText: string;

    try {
      const downloadUrl = eduCkanDownloadUrl(
        EDU_CKAN_PACKAGE_IDS.CRC_HOLDERS,
        resource.id,
        resource.name || 'data.csv',
      );
      const resp = await fetchUrl(downloadUrl);
      csvText = resp.body;
    } catch {
      log('[CRC] Falling back to direct resource URL...');
      const resp = await fetchUrl(resource.url);
      csvText = resp.body;
    }

    const rows = parseCsvToObjects(csvText);
    log(`[CRC] Parsed ${rows.length} rows from CSV`);

    const limitedRows = options.limit ? rows.slice(0, options.limit) : rows;

    const chairs: ResearchChair[] = [];
    for (const row of limitedRows) {
      try {
        const chair = await csvRowToChair(row, resource.url);
        if (chair) {
          chairs.push(chair);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Row parse error: ${msg}`);
      }
    }

    result.recordsFound = chairs.length;
    log(`[CRC] ${chairs.length} valid chair records parsed`);

    // Deduplicate
    const seen = new Set<string>();
    const uniqueChairs = chairs.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    log(`[CRC] ${uniqueChairs.length} unique records after dedup`);

    if (db) {
      const ingested = await upsertResearchChairs(db, uniqueChairs);
      result.recordsIngested = ingested;
      log(`[CRC] Persisted ${ingested} research chair records`);
    } else {
      result.recordsIngested = uniqueChairs.length;
      result.records = uniqueChairs;
      log(`[CRC] Dry-run — ${uniqueChairs.length} records available`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[CRC] ERROR: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/* ------------------------------------------------------------------ */
/*  Database Persistence                                               */
/* ------------------------------------------------------------------ */

/**
 * Upsert research chair records into the database.
 */
export async function upsertResearchChairs(
  db: D1Database,
  chairs: ResearchChair[],
): Promise<number> {
  if (chairs.length === 0) return 0;

  let inserted = 0;
  const batchSize = 100;

  for (let i = 0; i < chairs.length; i += batchSize) {
    const batch = chairs.slice(i, i + batchSize);

    for (const chair of batch) {
      try {
        db.prepare(
          `INSERT OR IGNORE INTO edu_research_chairs
            (id, chairholder_name, institution, tier, discipline, program,
             start_date, award_date, source_url, ingested_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(chair.id,
          chair.chairholderName,
          chair.institution,
          chair.tier,
          chair.discipline,
          chair.program,
          chair.startDate,
          chair.awardDate,
          chair.sourceUrl,
          chair.ingestedAt).run()
        inserted++;
      } catch (err) {
        console.error(`[CRC] DB insert error for chair ${chair.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return inserted;
}
