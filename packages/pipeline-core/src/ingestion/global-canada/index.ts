// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Global Canada (GAC / ECCC / CSIS) Ingestion — Quill
 *
 * Combined lighter-weight module tracking three federal sources:
 *   - Global Affairs Canada: trade agreements, foreign policy, international development projects
 *   - Environment and Climate Change Canada: climate data, weather warnings via MSC GeoMet API
 *   - Canadian Security Intelligence Service: annual reports, public briefings (PDFs)
 *
 * Pipeline:
 *   1. Fetch metadata records from GAC / ECCC / CSIS sources
 *   2. Parse and normalize records into unified GlobalCanadaRecord schema
 *   3. Persist to D1 database with deduplication
 *   4. Enable search and query functions
 *
 * Cross-reference opportunities:
 *   - Committees: parliamentary testimony on trade/climate/security
 *   - Gazette: regulations implementing trade agreements
 *   - Corporate: international development contracts
 *   - Crown Corporations: EDC, CDC climate alignment
 */

import {
  fetchGlobalCanadaBySource,
  fetchAllGlobalCanadaRecords,
  fetchGacTradeAgreements,
  fetchEcccClimateData,
  fetchCsisReports,
} from './fetcher.js';
import {
  parseGlobalCanadaRecord,
  parseGlobalCanadaBatch,
  parseGacRecord,
  parseEcccRecord,
  parseCsisHtml,
  normalizeSource,
  normalizeRecordType,
} from './parser.js';
import {
  GLOBAL_CANADA_DDL,
  GLOBAL_CANADA_SOURCES,
  GLOBAL_CANADA_SOURCE_CONFIG,
  GLOBAL_CANADA_RECORD_TYPE_MAP,
  ALL_GLOBAL_CANADA_SOURCES,
  DEFAULT_MAX_RECORDS,
  GlobalCanadaError,
} from './constants.js';
import type {
  GlobalCanadaRecord,
  GlobalCanadaSource,
  GlobalCanadaRecordType,
  GlobalCanadaIngestionOptions,
  GlobalCanadaIngestionResult,
  RawGlobalCanadaRecord,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Re-exports for barrel                                              */
/* ------------------------------------------------------------------ */

export {
  fetchGlobalCanadaBySource,
  fetchAllGlobalCanadaRecords,
  fetchGacTradeAgreements,
  fetchEcccClimateData,
  fetchCsisReports,
} from './fetcher.js';

export {
  parseGlobalCanadaRecord,
  parseGlobalCanadaBatch,
  parseGacRecord,
  parseEcccRecord,
  parseCsisHtml,
  normalizeSource,
  normalizeRecordType,
} from './parser.js';

export {
  GLOBAL_CANADA_DDL,
  GLOBAL_CANADA_SOURCES,
  GLOBAL_CANADA_SOURCE_CONFIG,
  GLOBAL_CANADA_RECORD_TYPE_MAP,
  ALL_GLOBAL_CANADA_SOURCES,
  DEFAULT_MAX_RECORDS,
  GlobalCanadaError,
} from './constants.js';

export type {
  GlobalCanadaRecord,
  GlobalCanadaSource,
  GlobalCanadaRecordType,
  GlobalCanadaIngestionOptions,
  GlobalCanadaIngestionResult,
  RawGlobalCanadaRecord,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  D1Database Interface                                               */
/* ------------------------------------------------------------------ */

/** Minimal D1Database interface matching Cloudflare D1 API. */
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
/*  Database Operations                                                */
/* ------------------------------------------------------------------ */

/**
 * Initialize the global_canada_records table.
 */
export async function initializeGlobalCanadaTable(db: D1Database): Promise<void> {
  await db.exec(GLOBAL_CANADA_DDL);
}

/**
 * Upsert (insert or ignore) a Global Canada record.
 *
 * @returns true if inserted, false if skipped (duplicate)
 */
async function upsertGlobalCanadaRecord(
  db: D1Database,
  record: GlobalCanadaRecord,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO global_canada_records
      (id, source_system, record_type, title, description,
       date, url, department, topic_area, geographic_focus,
       reference_number, format, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    record.sourceSystem,
    record.recordType,
    record.title,
    record.description,
    record.date,
    record.url,
    record.department,
    record.topicArea,
    record.geographicFocus,
    record.referenceNumber,
    record.format,
    record.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}

/**
 * Check if a record already exists by its content hash.
 */
export async function globalCanadaRecordExists(
  db: D1Database,
  id: string,
): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 FROM global_canada_records WHERE id = ? LIMIT 1`,
  ).bind(id).first();

  return row !== null;
}

/**
 * Check if the global_canada_records table exists.
 */
export async function globalCanadaTableExists(db: D1Database): Promise<boolean> {
  try {
    const row = await db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='global_canada_records'`,
    ).first();
    return row !== null;
  } catch {
    return false;
  }
}

/**
 * Get the latest ingestion date from the global_canada_records table.
 */
export async function getLatestGlobalCanadaIngestionDate(db: D1Database): Promise<string | null> {
  const row = await db.prepare(
    'SELECT ingested_at FROM global_canada_records ORDER BY ingested_at DESC LIMIT 1',
  ).first<{ ingested_at: string }>();
  return row?.ingested_at ?? null;
}

/* ------------------------------------------------------------------ */
/*  Search Functions                                                   */
/* ------------------------------------------------------------------ */

/**
 * Search Global Canada records by keyword across multiple fields.
 */
export async function searchGlobalCanadaRecords(
  db: D1Database,
  query: string,
  options: {
    limit?: number;
    sourceSystem?: GlobalCanadaSource;
    recordType?: GlobalCanadaRecordType;
    department?: string;
    topicArea?: string;
  } = {},
): Promise<GlobalCanadaRecord[]> {
  let sql = `SELECT * FROM global_canada_records WHERE 1=1`;
  const params: unknown[] = [];

  if (query) {
    sql += ` AND (
      title LIKE ? OR
      description LIKE ? OR
      department LIKE ? OR
      topic_area LIKE ? OR
      geographic_focus LIKE ?
    )`;
    const q = `%${query}%`;
    params.push(q, q, q, q, q);
  }

  if (options.sourceSystem) {
    sql += ' AND source_system = ?';
    params.push(options.sourceSystem);
  }

  if (options.recordType) {
    sql += ' AND record_type = ?';
    params.push(options.recordType);
  }

  if (options.department) {
    sql += ' AND department LIKE ?';
    params.push(`%${options.department}%`);
  }

  if (options.topicArea) {
    sql += ' AND topic_area = ?';
    params.push(options.topicArea);
  }

  sql += ' ORDER BY date DESC NULLS LAST, title ASC LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<GlobalCanadaRecord>();
  return result.results ?? [];
}

/**
 * Get Global Canada records by source system.
 */
export async function getGlobalCanadaBySource(
  db: D1Database,
  sourceSystem: GlobalCanadaSource,
  options: {
    limit?: number;
    recordType?: GlobalCanadaRecordType;
  } = {},
): Promise<GlobalCanadaRecord[]> {
  return searchGlobalCanadaRecords(db, '', {
    sourceSystem,
    recordType: options.recordType,
    limit: options.limit ?? 100,
  });
}

/**
 * Get Global Canada records by topic area.
 */
export async function getGlobalCanadaByTopic(
  db: D1Database,
  topicArea: string,
  options: {
    limit?: number;
    sourceSystem?: GlobalCanadaSource;
  } = {},
): Promise<GlobalCanadaRecord[]> {
  return searchGlobalCanadaRecords(db, '', {
    topicArea,
    sourceSystem: options.sourceSystem,
    limit: options.limit ?? 100,
  });
}

/**
 * Get the most recent Global Canada records.
 */
export async function getRecentGlobalCanadaRecords(
  db: D1Database,
  limit: number = 20,
): Promise<GlobalCanadaRecord[]> {
  const stmt = db.prepare(
    `SELECT * FROM global_canada_records
     ORDER BY date DESC NULLS LAST, ingested_at DESC
     LIMIT ?`,
  ).bind(limit);

  const result = await stmt.all<GlobalCanadaRecord>();
  return result.results ?? [];
}

/**
 * Search within a specific source system.
 */
export async function searchGlobalCanadaBySource(
  db: D1Database,
  query: string,
  sourceSystem: GlobalCanadaSource,
  options: {
    limit?: number;
  } = {},
): Promise<GlobalCanadaRecord[]> {
  return searchGlobalCanadaRecords(db, query, {
    sourceSystem,
    limit: options.limit ?? 50,
  });
}

/* ------------------------------------------------------------------ */
/*  Ingestion Orchestrator                                             */
/* ------------------------------------------------------------------ */

/**
 * Ingest Global Canada records into the database.
 *
 * Orchestrates:
 *   1. Initialize table (if requested)
 *   2. Fetch metadata records from GAC / ECCC / CSIS
 *   3. Parse and normalize records into unified schema
 *   4. Deduplicate and persist to D1
 *
 * @param db - D1 database instance (null to dry-run)
 * @param options - Ingestion options
 * @returns Ingestion result with counts and errors
 */
export async function ingestGlobalCanada(
  db: D1Database | null,
  options: GlobalCanadaIngestionOptions = {},
): Promise<GlobalCanadaIngestionResult> {
  const startTime = Date.now();
  const result: GlobalCanadaIngestionResult = {
    recordsFound: 0,
    recordsIngested: 0,
    newRecords: 0,
    errors: [],
    perSource: {},
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  const sources = options.sources ?? ALL_GLOBAL_CANADA_SOURCES;

  // Initialize per-source counters
  for (const src of sources) {
    result.perSource[src] = { recordsFound: 0, recordsIngested: 0 };
  }

  try {
    // Phase 0: Initialize table if requested
    if (db && options.initializeTable) {
      log('[GLOBAL-CA] Initializing global_canada_records table...');
      await initializeGlobalCanadaTable(db);
    }

    // Phase 1: Fetch and process each source system
    for (const source of sources) {
      log(`[GLOBAL-CA] Fetching ${source} records...`);

      try {
        const { records: rawRecords, errors: fetchErrors } = await fetchGlobalCanadaBySource(
          source,
          { limit: maxRecords },
        );

        result.errors.push(...fetchErrors);
        log(`[GLOBAL-CA] Found ${rawRecords.length} raw ${source} records`);

        // Phase 2-4: Parse and persist
        const records = await parseGlobalCanadaBatch(rawRecords, {
          sourceSystem: source,
        });

        for (const record of records) {
          result.recordsFound++;
          result.perSource[source].recordsFound++;

          // Persist to database
          if (db) {
            const inserted = await upsertGlobalCanadaRecord(db, record);
            if (inserted) {
              result.newRecords++;
            }
            result.recordsIngested++;
            result.perSource[source].recordsIngested++;
          }
        }
      } catch (err) {
        const msg = `GLOBAL-CA ${source} fetch/parse failed: ${(err as Error).message}`;
        result.errors.push(msg);
        log(`[GLOBAL-CA] ${msg}`);
      }
    }
  } catch (err) {
    const msg = `GLOBAL-CA ingestion failed: ${(err as Error).message}`;
    result.errors.push(msg);
    log(`[GLOBAL-CA] ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[GLOBAL-CA] Done: ${result.recordsFound} found, ${result.recordsIngested} ingested, ${result.newRecords} new in ${result.durationMs}ms`);

  return result;
}
