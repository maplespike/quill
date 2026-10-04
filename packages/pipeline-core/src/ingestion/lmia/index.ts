/**
 * LMIA Ingestion — Quill
 *
 * Orchestrates the LMIA data ingestion pipeline:
 *   1. Discover latest quarter from CKAN metadata (or use specified quarter)
 *   2. Fetch CSV data for positive and/or negative LMIA outcomes
 *   3. Parse CSV into LmiaRecord objects
 *   4. Persist to D1 database (when available)
 *
 * Cross-referencing opportunities:
 *   - Corporate module: companies using TFW program with known lobbying/contracts
 *   - Procurement: companies with government contracts who also use TFWs
 *
 * Designed to run as a cron job (quarterly) or ad-hoc.
 */

import type { D1Database } from '../committees/db.js';
import {
  fetchLatestLmiaRecords,
  fetchLmiaByQuarter,
  fetchLmiaCkanMetadata,
  discoverLatestQuarter,
  listAvailableQuarters,
  LmiaFetchError,
} from './fetcher.js';
import { parseLmiaCsv } from './parser.js';
import { LMIA_DDL } from './constants.js';
import { LmiaOutcome, type LmiaRecord, type LmiaIngestionResult } from './types.js';
import { upsertOrganization } from '../../shared-db.js';


/**
 * Ingest LMIA records for a given outcome and quarter.
 *
 * If quarter is not specified, discovers the latest available quarter
 * from CKAN metadata.
 */
export async function ingestLmia(
  db: D1Database | null,
  outcome: LmiaOutcome,
  options: {
    /** Specific quarter to ingest (e.g. "2025Q4"). Auto-discovers if omitted */
    quarter?: string;
    /** Re-fetch and re-parse already-ingested records */
    force?: boolean;
    /** Progress callback */
    onProgress?: (msg: string) => void;
  } = {},
): Promise<LmiaIngestionResult> {
  const startTime = Date.now();
  const result: LmiaIngestionResult = {
    outcome,
    quarter: '',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    // Phase 1: Determine quarter
    const quarter = options.quarter ?? (await discoverLatestQuarter(outcome));
    result.quarter = quarter;
    log(`[LMIA ${outcome}] Quarter: ${quarter}`);

    // Phase 2: Fetch CSV data
    log(`[LMIA ${outcome}] Fetching CSV data for ${quarter}...`);
    const csvText = await fetchLmiaByQuarter(outcome, quarter);
    log(`[LMIA ${outcome}] Downloaded ${(csvText.length / 1024).toFixed(0)} KB`);

    // Phase 3: Parse CSV
    const allRecords = await parseLmiaCsv(csvText, outcome, quarter);
    result.recordsFound = allRecords.length;
    log(`[LMIA ${outcome}] Parsed ${allRecords.length} records`);

    if (allRecords.length === 0) {
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Phase 4: Persist to database
     if (db) {
       log(`[LMIA ${outcome}] Persisting to database...`);
       const employerSeen = new Set<string>();
       for (const record of allRecords) {
         try {
           await upsertLmiaRecord(db, record);
           result.recordsIngested++;

           // Also upsert employer to shared organizations table
           if (record.employer && !employerSeen.has(record.employer)) {
             employerSeen.add(record.employer);
             try {
               upsertOrganization(record.employer, {
                 type: "other",
                 province: record.province ?? undefined,
                 source: "lmia",
                 rawData: { noc: record.noc, nocTitle: record.nocTitle, stream: record.stream },
               });
             } catch { /* non-fatal */ }
           }
         } catch (err) {
           const msg = err instanceof Error ? err.message : String(err);
           result.errors.push(`${record.employer}: ${msg}`);
         }
       }
      log(`[LMIA ${outcome}] Persisted ${result.recordsIngested}/${result.recordsFound} records`);
    } else {
      // No database — count all as ingested
      result.recordsIngested = allRecords.length;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`LMIA ${outcome}: ${msg}`);
    log(`[LMIA ${outcome}] FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(
    `[LMIA ${outcome}] Done in ${result.durationMs}ms: ${result.recordsIngested}/${result.recordsFound} records` +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''),
  );

  return result;
}


/**
 * Ingest both positive and negative LMIA datasets.
 */
export async function ingestAllLmia(
  db: D1Database | null,
  options: {
    quarter?: string;
    force?: boolean;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<Record<LmiaOutcome, LmiaIngestionResult>> {
  const log = options.onProgress ?? (() => {});
  log('=== LMIA Ingestion: All Outcomes ===');

  const results: Record<LmiaOutcome, LmiaIngestionResult> = {} as Record<LmiaOutcome, LmiaIngestionResult>;

  for (const outcome of [LmiaOutcome.Positive, LmiaOutcome.Negative]) {
    const outcomeResult = await ingestLmia(db, outcome, options);
    results[outcome] = outcomeResult;
  }

  const totalFound = Object.values(results).reduce((s, r) => s + r.recordsFound, 0);
  const totalIngested = Object.values(results).reduce((s, r) => s + r.recordsIngested, 0);
  const totalErrors = Object.values(results).reduce((s, r) => s + r.errors.length, 0);
  log(`=== LMIA Summary: ${totalIngested}/${totalFound} records, ${totalErrors} errors ===`);

  return results;
}


/**
 * Insert or replace a LMIA record in the D1 database.
 */
async function upsertLmiaRecord(
  db: D1Database,
  record: LmiaRecord,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO lmia_records
      (id, employer, city, province, outcome, stream, stream_raw,
       noc, noc_title, positions, wage_min, wage_max, wage_rate,
       quarter, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    record.employer,
    record.city,
    record.province,
    record.outcome,
    record.stream,
    record.streamRaw,
    record.noc,
    record.nocTitle,
    record.positions,
    record.wageMin,
    record.wageMax,
    record.wageRate,
    record.quarter,
    record.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}

/**
 * Initialize the lmia_records table.
 */
export async function initializeLmiaTable(db: D1Database): Promise<void> {
  await db.exec(LMIA_DDL);
}


/**
 * Get the top employers by total positions or record count for a given year.
 *
 * @param db - D1 database instance
 * @param limit - Number of employers to return (default: 20)
 * @param year - Filter by year (e.g. "2025"). Omit for all years
 * @param outcome - Filter by outcome (positive/negative). Omit for both
 */
export async function getTopEmployers(
  db: D1Database,
  limit: number = 20,
  year?: string,
  outcome?: LmiaOutcome,
): Promise<Array<{
  employer: string;
  totalPositions: number;
  recordCount: number;
  outcomes: string;
  streams: string;
  provinces: string;
}>> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (year) {
    conditions.push('quarter LIKE ?');
    params.push(`${year}%`);
  }

  if (outcome) {
    conditions.push('outcome = ?');
    params.push(outcome);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT
      employer,
      SUM(COALESCE(positions, 0)) as total_positions,
      COUNT(*) as record_count,
      GROUP_CONCAT(DISTINCT outcome) as outcomes,
      GROUP_CONCAT(DISTINCT stream) as streams,
      GROUP_CONCAT(DISTINCT province) as provinces
    FROM lmia_records
    ${where}
    GROUP BY employer
    ORDER BY total_positions DESC
    LIMIT ?
  `;
  params.push(limit);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<{
    employer: string;
    total_positions: number;
    record_count: number;
    outcomes: string;
    streams: string;
    provinces: string;
  }>();

  return (result.results ?? []).map((r) => ({
    employer: r.employer,
    totalPositions: r.total_positions,
    recordCount: r.record_count,
    outcomes: r.outcomes,
    streams: r.streams,
    provinces: r.provinces,
  }));
}

/**
 * Search LMIA records by employer name (case-insensitive, partial match).
 *
 * @param db - D1 database instance
 * @param name - Employer name to search for
 * @param limit - Maximum results (default: 50)
 */
export async function searchByEmployer(
  db: D1Database,
  name: string,
  limit: number = 50,
): Promise<LmiaRecord[]> {
  const stmt = db.prepare(`
    SELECT * FROM lmia_records
    WHERE LOWER(employer) LIKE ?
    ORDER BY quarter DESC, employer ASC
    LIMIT ?
  `).bind(`%${name.toLowerCase()}%`, limit);

  const result = await stmt.all<LmiaRecord>();
  return result.results ?? [];
}

/**
 * Search LMIA records by NOC code (exact or prefix match).
 *
 * @param db - D1 database instance
 * @param noc - NOC code to search (e.g. "21231" for exact, "21" for prefix)
 * @param limit - Maximum results (default: 50)
 */
export async function searchByOccupation(
  db: D1Database,
  noc: string,
  limit: number = 50,
): Promise<LmiaRecord[]> {
  const stmt = db.prepare(`
    SELECT * FROM lmia_records
    WHERE noc LIKE ? OR noc LIKE ?
    ORDER BY quarter DESC, employer ASC
    LIMIT ?
  `).bind(`${noc}%`, `%${noc}%`, limit);

  const result = await stmt.all<LmiaRecord>();
  return result.results ?? [];
}

/**
 * Get LMIA records by province.
 *
 * @param db - D1 database instance
 * @param province - 2-letter province code (e.g. "ON", "BC")
 * @param limit - Maximum results (default: 50)
 */
export async function getByProvince(
  db: D1Database,
  province: string,
  limit: number = 50,
): Promise<LmiaRecord[]> {
  const stmt = db.prepare(`
    SELECT * FROM lmia_records
    WHERE province = ?
    ORDER BY quarter DESC, employer ASC
    LIMIT ?
  `).bind(province.toUpperCase(), limit);

  const result = await stmt.all<LmiaRecord>();
  return result.results ?? [];
}

/**
 * Get LMIA statistics aggregated by stream and province.
 *
 * @param db - D1 database instance
 * @param year - Filter by year (e.g. "2025"). Omit for all
 */
export async function getLmiaStats(
  db: D1Database,
  year?: string,
): Promise<{
  byStream: Array<{ stream: string; totalPositions: number; recordCount: number }>;
  byProvince: Array<{ province: string; totalPositions: number; recordCount: number }>;
  totalRecords: number;
  totalPositions: number;
}> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (year) {
    conditions.push('quarter LIKE ?');
    params.push(`${year}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // By stream
  const streamSql = `
    SELECT stream, SUM(COALESCE(positions, 0)) as total_positions, COUNT(*) as record_count
    FROM lmia_records ${where}
    GROUP BY stream
    ORDER BY total_positions DESC
  `;
  const streamResult = await db.prepare(streamSql).bind(...params).all<{
    stream: string;
    total_positions: number;
    record_count: number;
  }>();

  // By province
  const provinceSql = `
    SELECT province, SUM(COALESCE(positions, 0)) as total_positions, COUNT(*) as record_count
    FROM lmia_records ${where}
    GROUP BY province
    ORDER BY total_positions DESC
  `;
  const provinceResult = await db.prepare(provinceSql).bind(...params).all<{
    province: string;
    total_positions: number;
    record_count: number;
  }>();

  // Totals
  const totalSql = `
    SELECT COUNT(*) as total_records, SUM(COALESCE(positions, 0)) as total_positions
    FROM lmia_records ${where}
  `;
  const totalResult = await db.prepare(totalSql).bind(...params).first<{
    total_records: number;
    total_positions: number;
  }>();

  return {
    byStream: (streamResult.results ?? []).map((r) => ({
      stream: r.stream,
      totalPositions: r.total_positions,
      recordCount: r.record_count,
    })),
    byProvince: (provinceResult.results ?? []).map((r) => ({
      province: r.province,
      totalPositions: r.total_positions,
      recordCount: r.record_count,
    })),
    totalRecords: totalResult?.total_records ?? 0,
    totalPositions: totalResult?.total_positions ?? 0,
  };
}

export {
  fetchLatestLmiaRecords,
  fetchLmiaByQuarter,
  fetchLmiaCkanMetadata,
  discoverLatestQuarter,
  listAvailableQuarters,
  LmiaFetchError,
} from './fetcher.js';
