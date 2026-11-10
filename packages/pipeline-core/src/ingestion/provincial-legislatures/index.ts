// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Provincial Legislatures Ingestion — Quill
 *
 * Orchestrates the ingestion pipeline for provincial legislative data
 * across all 10 Canadian provinces:
 *   1. Fetch raw legislative data (Hansard, committees, bills)
 *   2. Parse and normalize per-province formats into unified schema
 *   3. Persist to D1 database with deduplication
 *   4. Provide query/search functions
 *
 * Cross-referencing opportunities:
 *   - Provincial lobbying: match speakers/lobbyists to lobbying records
 *   - Federal committees: connect provincial legislative activity to federal
 *   - Legislative agenda tracking: monitor bill progress across provinces
 */

import { fetchProvincialHansard, fetchAllProvincialHansard } from './fetcher.js';
import { parseProvincialRecords } from './parser.js';
import { PROVINCE_CONFIGS, IMPLEMENTED_PROVINCES, ProvincialLegislatureError } from './constants.js';
import type {
  ProvincialLegislatureRecord,
  ProvinceCode,
  LegislativeRecordType,
  ProvincialLegislatureIngestionOptions,
  ProvincialLegislatureIngestionResult,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Re-exports for barrel                                              */
/* ------------------------------------------------------------------ */

export {
  fetchProvincialHansard,
  fetchAllProvincialHansard,
} from './fetcher.js';
export {
  fetchOntarioHansard,
  fetchOntarioCommitteeHearings,
  fetchOntarioBills,
  fetchBCHansard,
  fetchBCCommitteeHearings,
  fetchBCBills,
  fetchAlbertaHansard,
  fetchAlbertaCommitteeHearings,
  fetchAlbertaBills,
} from './fetcher.js';

export {
  parseProvincialRecord,
  parseProvincialRecords,
  parseOntarioHansardXml,
  parseBCHansardXml,
  parseAlbertaHansardHtml,
  parseBillEntry,
  extractBillReferences,
  normalizeProvince,
  detectRecordType,
} from './parser.js';

export {
  PROVINCE_CONFIGS,
  ALL_PROVINCES,
  IMPLEMENTED_PROVINCES,
  XML_HANSARD_PROVINCES,
  ONTARIO_CONFIG,
  BC_CONFIG,
  ALBERTA_CONFIG,
  QUEBEC_CONFIG,
  ONTARIO,
  BC,
  ALBERTA,
  DEFAULT_MAX_RECORDS,
  ProvincialLegislatureError,
} from './constants.js';

export type {
  ProvincialLegislatureRecord,
  ProvinceCode,
  LegislativeRecordType,
  ProvinceChamber,
  ProvinceLegislatureConfig,
  ProvincialLegislatureIngestionOptions,
  ProvincialLegislatureIngestionResult,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  D1Database Interface                                              */
/* ------------------------------------------------------------------ */

/**
 * Minimal D1Database interface matching Cloudflare D1 API.
 */
export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  exec(sql: string): Promise<{ success: boolean; error?: string }>;
  batch(stmts: D1PreparedStatement[]): Promise<{ results?: unknown[]; success: boolean }[]>;
}

export interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results: T[]; success: boolean }>;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<{ success: boolean; meta?: { changes: number } }>;
}

/* ------------------------------------------------------------------ */
/*  DDL — Database Schema Definition                                  */
/* ------------------------------------------------------------------ */

/**
 * DDL for the provincial_legislatures table.
 *
 * This table stores normalized legislative records from all 10 Canadian
 * provinces covering Hansard transcripts, committee hearings, and bills.
 *
 * The primary key is a SHA-256 hash of the record content for
 * deduplication. Indexes support the key query patterns:
 *   - By province (find all records for a province)
 *   - By date (chronological queries)
 *   - By speaker (politician activity tracking)
 *   - By bill number (legislation tracking)
 *   - By record type (Hansard vs committee vs bill)
 *   - By topic/subject (issue-based queries)
 */
export const PROVINCIAL_LEGISLATURES_DDL = `
-- Provincial legislative records across all 10 Canadian provinces
CREATE TABLE IF NOT EXISTS provincial_legislatures (
  id TEXT PRIMARY KEY,

  -- Jurisdiction
  province TEXT NOT NULL CHECK(province IN ('ON','BC','AB','QC','SK','MB','NS','NB','NL','PE','NT','YT','NU')),
  record_type TEXT NOT NULL CHECK(record_type IN ('hansard','committee','bill')),
  chamber TEXT NOT NULL DEFAULT 'legislative-assembly',

  -- Date
  sitting_date TEXT,

  -- Hansard / transcript
  hansard_url TEXT,
  topic TEXT,
  speaker TEXT,
  party TEXT,
  riding TEXT,
  text_excerpt TEXT,

  -- Bill reference
  bill_reference TEXT,
  bill_number TEXT,
  bill_title TEXT,
  bill_status TEXT,
  bill_date TEXT,

  -- Committee info
  committee_name TEXT,
  meeting_number INTEGER,
  meeting_start_time TEXT,
  meeting_end_time TEXT,
  intervention_count INTEGER,

  -- Language
  language TEXT DEFAULT 'en',

  -- Provenance
  source_url TEXT NOT NULL,
  source_record_id TEXT,
  source_system TEXT NOT NULL,

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  -- Deduplication constraint
  UNIQUE(province, source_url, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_pl_province ON provincial_legislatures(province);
CREATE INDEX IF NOT EXISTS idx_pl_record_type ON provincial_legislatures(record_type);
CREATE INDEX IF NOT EXISTS idx_pl_sitting_date ON provincial_legislatures(sitting_date DESC);
CREATE INDEX IF NOT EXISTS idx_pl_speaker ON provincial_legislatures(speaker);
CREATE INDEX IF NOT EXISTS idx_pl_party ON provincial_legislatures(party);
CREATE INDEX IF NOT EXISTS idx_pl_bill_number ON provincial_legislatures(bill_number);
CREATE INDEX IF NOT EXISTS idx_pl_committee ON provincial_legislatures(committee_name);
CREATE INDEX IF NOT EXISTS idx_pl_topic ON provincial_legislatures(topic);
CREATE INDEX IF NOT EXISTS idx_pl_language ON provincial_legislatures(language);
CREATE INDEX IF NOT EXISTS idx_pl_source_system ON provincial_legislatures(source_system);
CREATE INDEX IF NOT EXISTS idx_pl_province_type ON provincial_legislatures(province, record_type);
CREATE INDEX IF NOT EXISTS idx_pl_province_date ON provincial_legislatures(province, sitting_date DESC);
CREATE INDEX IF NOT EXISTS idx_pl_speaker_party ON provincial_legislatures(speaker, party);
CREATE INDEX IF NOT EXISTS idx_pl_bill_status ON provincial_legislatures(bill_status);
CREATE INDEX IF NOT EXISTS idx_pl_ingested ON provincial_legislatures(ingested_at DESC);
`;

/* ------------------------------------------------------------------ */
/*  Database Operations                                                */
/* ------------------------------------------------------------------ */

/**
 * Initialize the provincial_legislatures table.
 */
export async function initializeProvincialLegislaturesTable(db: D1Database): Promise<void> {
  await db.exec(PROVINCIAL_LEGISLATURES_DDL);
}

/**
 * Insert (or ignore) a provincial legislature record.
 *
 * @returns true if inserted, false if skipped (duplicate)
 */
async function upsertRecord(
  db: D1Database,
  record: ProvincialLegislatureRecord,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO provincial_legislatures
      (id, province, record_type, chamber, sitting_date,
       hansard_url, topic, speaker, party, riding,
       text_excerpt, bill_reference, bill_number, bill_title, bill_status,
       bill_date, committee_name, meeting_number, meeting_start_time, meeting_end_time,
       intervention_count, language, source_url, source_record_id, source_system,
       ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    record.province,
    record.recordType,
    record.chamber,
    record.sittingDate,
    record.hansardUrl,
    record.topic,
    record.speaker,
    record.party,
    record.riding,
    record.textExcerpt,
    record.billReference,
    record.billNumber,
    record.billTitle,
    record.billStatus,
    record.billDate,
    record.committeeName,
    record.meetingNumber,
    record.meetingStartTime,
    record.meetingEndTime,
    record.interventionCount,
    record.language,
    record.sourceUrl,
    record.sourceRecordId,
    record.sourceSystem,
    record.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}

/**
 * Check if a record already exists by province, source URL, and record ID.
 */
async function recordExists(
  db: D1Database,
  record: ProvincialLegislatureRecord,
): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 FROM provincial_legislatures
     WHERE province = ? AND source_url = ? AND source_record_id = ?
     LIMIT 1`,
  ).bind(
    record.province,
    record.sourceUrl,
    record.sourceRecordId,
  ).first();

  return row !== null;
}

/**
 * Get the latest sitting date in the database for a province.
 */
async function getLatestSittingDate(
  db: D1Database,
  province?: ProvinceCode,
): Promise<string | null> {
  let sql = 'SELECT sitting_date FROM provincial_legislatures';
  const params: unknown[] = [];

  if (province) {
    sql += ' WHERE province = ?';
    params.push(province);
  }

  sql += ' ORDER BY sitting_date DESC LIMIT 1';

  const row = await db.prepare(sql).bind(...params).first<{ sitting_date: string }>();
  return row?.sitting_date ?? null;
}

/* ------------------------------------------------------------------ */
/*  Ingestion Orchestrator                                             */
/* ------------------------------------------------------------------ */

/**
 * Ingest provincial legislature records into the database.
 *
 * Orchestrates:
 *   1. Initialize table (if requested)
 *   2. Fetch raw data from each province
 *   3. Parse and normalize records
 *   4. Deduplicate and persist to D1
 *
 * @param db - D1 database instance (null to dry-run)
 * @param options - Ingestion options
 * @returns Ingestion result with counts and errors
 */
export async function ingestProvincialLegislatures(
  db: D1Database | null,
  options: ProvincialLegislatureIngestionOptions = {},
): Promise<ProvincialLegislatureIngestionResult> {
  const startTime = Date.now();
  const result: ProvincialLegislatureIngestionResult = {
    recordsFound: 0,
    recordsIngested: 0,
    newRecords: 0,
    errors: [],
    perProvince: {},
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});
  const maxRecordsPerProvince = options.maxRecordsPerProvince ?? 500;
  const provinces = options.provinces ?? IMPLEMENTED_PROVINCES.map((p) => p.province);

  try {
    // Phase 0: Initialize table if requested
    if (db && options.initializeTable) {
      log('[ProvLeg] Initializing table...');
      await initializeProvincialLegislaturesTable(db);
    }

    // Phase 1-3: For each province, fetch, parse, persist
    for (const province of provinces) {
      const provinceStart = Date.now();
      const provinceResult = {
        recordsFound: 0,
        recordsIngested: 0,
        newRecords: 0,
        errors: [] as string[],
      };

      log(`[ProvLeg] Processing ${province}...`);

      try {
        // Phase 1: Fetch raw records
        const rawRecords = await fetchProvincialHansard(province, {
          recordTypes: options.recordTypes,
          dateFrom: options.dateFrom,
          dateTo: options.dateTo,
          maxRecords: maxRecordsPerProvince,
        });

        provinceResult.recordsFound = rawRecords.length;
        log(`[ProvLeg] ${province}: Found ${rawRecords.length} records`);

        if (rawRecords.length === 0) {
          result.perProvince[province] = provinceResult;
          continue;
        }

        // Phase 2: Parse (records from fetcher are already normalized)
        // The fetcher already returns ProvincialLegislatureRecord objects,
        // but we run through the parser for any additional normalization
        const parsedRecords = await parseProvincialRecords(
          rawRecords as unknown as Record<string, unknown>[],
          province,
        );

        log(`[ProvLeg] ${province}: Parsed ${parsedRecords.length} unique records`);

        // Phase 3: Persist to database
        if (db) {
          for (const record of parsedRecords) {
            try {
              if (!options.force) {
                const exists = await recordExists(db, record);
                if (exists) continue;
              }

              const inserted = await upsertRecord(db, record);
              if (inserted) {
                provinceResult.newRecords++;
              }
              provinceResult.recordsIngested++;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              provinceResult.errors.push(`Record ${record.id?.substring(0, 12) ?? 'unknown'}: ${msg}`);
            }
          }
        } else {
          // Dry run — count all as ingested
          provinceResult.recordsIngested = parsedRecords.length;
          provinceResult.newRecords = parsedRecords.length;
        }

        log(`[ProvLeg] ${province}: ${provinceResult.recordsIngested}/${provinceResult.recordsFound} records` +
          (provinceResult.newRecords > 0 ? ` (${provinceResult.newRecords} new)` : '') +
          (provinceResult.errors.length > 0 ? `, ${provinceResult.errors.length} errors` : ''));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        provinceResult.errors.push(`FATAL: ${msg}`);
        log(`[ProvLeg] ${province}: FATAL — ${msg}`);
      }

      result.perProvince[province] = provinceResult;

      // Accumulate totals
      result.recordsFound += provinceResult.recordsFound;
      result.recordsIngested += provinceResult.recordsIngested;
      result.newRecords += provinceResult.newRecords;
      result.errors.push(...provinceResult.errors.map((e) => `[${province}] ${e}`));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`GLOBAL FATAL: ${msg}`);
    log(`[ProvLeg] GLOBAL FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(
    `[ProvLeg] Done in ${result.durationMs}ms: ${result.recordsIngested}/${result.recordsFound} records` +
    (result.newRecords > 0 ? ` (${result.newRecords} new)` : '') +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''),
  );

  return result;
}

/**
 * Ingest all implemented provinces at once.
 * Convenience wrapper for ingestProvincialLegislatures with all provinces.
 */
export async function ingestAllProvincialLegislatures(
  db: D1Database | null,
  options: ProvincialLegislatureIngestionOptions = {},
): Promise<ProvincialLegislatureIngestionResult> {
  return ingestProvincialLegislatures(db, {
    ...options,
    provinces: options.provinces ?? IMPLEMENTED_PROVINCES.map((p) => p.province),
  });
}

/* ------------------------------------------------------------------ */
/*  Query Functions                                                    */
/* ------------------------------------------------------------------ */

/**
 * Search provincial legislature records by keyword across multiple fields.
 *
 * @param db - D1 database instance
 * @param query - Search terms
 * @param limit - Maximum results (default: 50)
 */
export async function searchProvincialLegislatures(
  db: D1Database,
  query: string,
  limit: number = 50,
): Promise<ProvincialLegislatureRecord[]> {
  const searchTerm = `%${query.toLowerCase()}%`;

  const stmt = db.prepare(`
    SELECT * FROM provincial_legislatures
    WHERE LOWER(speaker) LIKE ?
       OR LOWER(topic) LIKE ?
       OR LOWER(text_excerpt) LIKE ?
       OR LOWER(bill_title) LIKE ?
       OR LOWER(bill_number) LIKE ?
       OR LOWER(committee_name) LIKE ?
       OR LOWER(riding) LIKE ?
    ORDER BY sitting_date DESC, province
    LIMIT ?
  `).bind(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, limit);

  const result = await stmt.all<ProvincialLegislatureRecord>();
  return result.results ?? [];
}

/**
 * Get records by province.
 *
 * @param db - D1 database instance
 * @param province - Province code
 * @param recordType - Optional record type filter
 * @param limit - Maximum results (default: 50)
 */
export async function getByProvince(
  db: D1Database,
  province: ProvinceCode,
  recordType?: LegislativeRecordType,
  limit: number = 50,
): Promise<ProvincialLegislatureRecord[]> {
  const conditions: string[] = ['province = ?'];
  const params: unknown[] = [province];

  if (recordType) {
    conditions.push('record_type = ?');
    params.push(recordType);
  }

  const stmt = db.prepare(`
    SELECT * FROM provincial_legislatures
    WHERE ${conditions.join(' AND ')}
    ORDER BY sitting_date DESC
    LIMIT ?
  `).bind(...params, limit);

  const result = await stmt.all<ProvincialLegislatureRecord>();
  return result.results ?? [];
}

/**
 * Get records by speaker (politician).
 *
 * @param db - D1 database instance
 * @param speakerName - Speaker name (case-insensitive partial match)
 * @param province - Optional province filter
 * @param limit - Maximum results (default: 50)
 */
export async function getBySpeaker(
  db: D1Database,
  speakerName: string,
  province?: ProvinceCode,
  limit: number = 50,
): Promise<ProvincialLegislatureRecord[]> {
  const conditions: string[] = ['LOWER(speaker) LIKE ?'];
  const params: unknown[] = [`%${speakerName.toLowerCase()}%`];

  if (province) {
    conditions.push('province = ?');
    params.push(province);
  }

  const stmt = db.prepare(`
    SELECT * FROM provincial_legislatures
    WHERE ${conditions.join(' AND ')}
    ORDER BY sitting_date DESC
    LIMIT ?
  `).bind(...params, limit);

  const result = await stmt.all<ProvincialLegislatureRecord>();
  return result.results ?? [];
}

/**
 * Get records by bill number.
 *
 * @param db - D1 database instance
 * @param billNumber - Bill number (e.g. "Bill 124")
 * @param province - Optional province filter
 * @param limit - Maximum results (default: 50)
 */
export async function getByBillNumber(
  db: D1Database,
  billNumber: string,
  province?: ProvinceCode,
  limit: number = 50,
): Promise<ProvincialLegislatureRecord[]> {
  const conditions: string[] = ['LOWER(bill_number) LIKE ?'];
  const params: unknown[] = [`%${billNumber.toLowerCase()}%`];

  if (province) {
    conditions.push('province = ?');
    params.push(province);
  }

  const stmt = db.prepare(`
    SELECT * FROM provincial_legislatures
    WHERE ${conditions.join(' AND ')}
    ORDER BY sitting_date DESC
    LIMIT ?
  `).bind(...params, limit);

  const result = await stmt.all<ProvincialLegislatureRecord>();
  return result.results ?? [];
}

/**
 * Get recent records across all provinces.
 *
 * @param db - D1 database instance
 * @param limit - Maximum results (default: 20)
 */
export async function getRecentProvincialRecords(
  db: D1Database,
  limit: number = 20,
): Promise<ProvincialLegislatureRecord[]> {
  const stmt = db.prepare(`
    SELECT * FROM provincial_legislatures
    ORDER BY sitting_date DESC, province
    LIMIT ?
  `).bind(limit);

  const result = await stmt.all<ProvincialLegislatureRecord>();
  return result.results ?? [];
}

/**
 * Get all bills currently in progress (not yet passed/defeated).
 *
 * @param db - D1 database instance
 * @param province - Optional province filter
 * @param limit - Maximum results (default: 50)
 */
export async function getActiveBills(
  db: D1Database,
  province?: ProvinceCode,
  limit: number = 50,
): Promise<ProvincialLegislatureRecord[]> {
  const conditions: string[] = [
    "record_type = 'bill'",
    "(bill_status IS NULL OR (LOWER(bill_status) NOT LIKE '%passed%' AND LOWER(bill_status) NOT LIKE '%defeated%' AND LOWER(bill_status) NOT LIKE '%royal assent%'))",
  ];
  const params: unknown[] = [];

  if (province) {
    conditions.push('province = ?');
    params.push(province);
  }

  const stmt = db.prepare(`
    SELECT * FROM provincial_legislatures
    WHERE ${conditions.join(' AND ')}
    ORDER BY bill_date DESC, province
    LIMIT ?
  `).bind(...params, limit);

  const result = await stmt.all<ProvincialLegislatureRecord>();
  return result.results ?? [];
}

/**
 * Get legislative statistics by province.
 *
 * @param db - D1 database instance
 */
export async function getProvincialStats(
  db: D1Database,
): Promise<Record<string, { total: number; hansard: number; committee: number; bill: number; lastUpdated: string | null }>> {
  const stmt = db.prepare(`
    SELECT
      province,
      record_type,
      COUNT(*) as count,
      MAX(ingested_at) as last_ingested
    FROM provincial_legislatures
    GROUP BY province, record_type
    ORDER BY province, record_type
  `);

  const rows = await stmt.all<{
    province: string;
    record_type: string;
    count: number;
    last_ingested: string;
  }>();

  const stats: Record<string, {
    total: number;
    hansard: number;
    committee: number;
    bill: number;
    lastUpdated: string | null;
  }> = {};

  for (const row of rows.results ?? []) {
    if (!stats[row.province]) {
      stats[row.province] = { total: 0, hansard: 0, committee: 0, bill: 0, lastUpdated: null };
    }

    stats[row.province].total += row.count;
    stats[row.province][row.record_type as keyof typeof stats[string]];
    if (row.record_type === 'hansard') stats[row.province].hansard = row.count;
    if (row.record_type === 'committee') stats[row.province].committee = row.count;
    if (row.record_type === 'bill') stats[row.province].bill = row.count;

    if (!stats[row.province].lastUpdated || row.last_ingested > stats[row.province].lastUpdated!) {
      stats[row.province].lastUpdated = row.last_ingested;
    }
  }

  return stats;
}
