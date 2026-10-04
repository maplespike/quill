/**
 * CIPO (Canadian Intellectual Property Office) Ingestion — Quill
 *
 * Orchestrates the ingestion pipeline for Canadian IP rights records:
 *   - Patents — Canadian Patent Database
 *   - Trademarks — Canadian Trademarks Database
 *   - Industrial Designs — Industrial Design Database
 *
 * Pipeline:
 *   1. Fetch IP records from CIPO APIs / open data
 *   2. Parse and normalize records into unified CipoRecord schema
 *   3. Persist to D1 database with deduplication
 *   4. Enable search and query functions
 *
 * Cross-reference opportunities:
 *   - Corporate: patent/trademark owners linked to lobbying/procurement
 *   - Health Canada: pharmaceutical patents linked to DPD drug records
 *   - Influence: IP portfolio concentration by foreign entities
 */

import {
  fetchCipoRecords,
  fetchAllCipoRecords,
} from './fetcher.js';
import {
  parseCipoRecord,
  parseCipoBatch,
  normalizeCipoStatus,
  normalizeCipoType,
} from './parser.js';
import {
  CIPO_DDL,
  CIPO_SOURCES,
  CIPO_IP_TYPE_CONFIG,
  CIPO_STATUS_MAP,
  ALL_CIPO_IP_TYPES,
  DEFAULT_MAX_RECORDS,
  CipoError,
} from './constants.js';
import type {
  CipoRecord,
  CipoIpType,
  CipoStatus,
  CipoIngestionOptions,
  CipoIngestionResult,
  RawCipoRecord,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Re-exports for barrel                                              */
/* ------------------------------------------------------------------ */

export {
  fetchCipoRecords,
  fetchAllCipoRecords,
} from './fetcher.js';

export {
  parseCipoRecord,
  parseCipoBatch,
  normalizeCipoStatus,
  normalizeCipoType,
} from './parser.js';

export {
  CIPO_DDL,
  CIPO_SOURCES,
  CIPO_IP_TYPE_CONFIG,
  CIPO_STATUS_MAP,
  ALL_CIPO_IP_TYPES,
  DEFAULT_MAX_RECORDS,
  CipoError,
} from './constants.js';

export type {
  CipoRecord,
  CipoIpType,
  CipoStatus,
  CipoIngestionOptions,
  CipoIngestionResult,
  RawCipoRecord,
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
 * Initialize the cipo_records table.
 */
export async function initializeCipoTable(db: D1Database): Promise<void> {
  await db.exec(CIPO_DDL);
}

/**
 * Upsert (insert or ignore) a CIPO record.
 *
 * @returns true if inserted, false if skipped (duplicate)
 */
async function upsertCipoRecord(
  db: D1Database,
  record: CipoRecord,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO cipo_records
      (id, application_number, filing_date, status, type,
       title, description, owner_name, agent_name,
       ipc_classification, nice_classification,
       registration_date, expiry_date, publication_date,
       source_url, source_system, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    record.applicationNumber,
    record.filingDate,
    record.status,
    record.type,
    record.title,
    record.description,
    record.ownerName,
    record.agentName,
    record.ipcClassification,
    record.niceClassification,
    record.registrationDate,
    record.expiryDate,
    record.publicationDate,
    record.sourceUrl,
    record.sourceSystem,
    record.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}

/**
 * Check if a record already exists by its content hash.
 */
export async function cipoRecordExists(
  db: D1Database,
  id: string,
): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 FROM cipo_records WHERE id = ? LIMIT 1`,
  ).bind(id).first();

  return row !== null;
}

/**
 * Check if the cipo_records table exists.
 */
export async function cipoTableExists(db: D1Database): Promise<boolean> {
  try {
    const row = await db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='cipo_records'`,
    ).first();
    return row !== null;
  } catch {
    return false;
  }
}

/**
 * Get the latest ingestion date from the cipo_records table.
 */
export async function getLatestCipoIngestionDate(db: D1Database): Promise<string | null> {
  const row = await db.prepare(
    'SELECT ingested_at FROM cipo_records ORDER BY ingested_at DESC LIMIT 1',
  ).first<{ ingested_at: string }>();
  return row?.ingested_at ?? null;
}

/* ------------------------------------------------------------------ */
/*  Search Functions                                                   */
/* ------------------------------------------------------------------ */

/**
 * Search CIPO records by keyword across multiple fields.
 */
export async function searchCipoRecords(
  db: D1Database,
  query: string,
  options: {
    limit?: number;
    ipType?: CipoIpType;
    status?: CipoStatus;
    ownerName?: string;
  } = {},
): Promise<CipoRecord[]> {
  let sql = `SELECT * FROM cipo_records WHERE 1=1`;
  const params: unknown[] = [];

  if (query) {
    sql += ` AND (
      title LIKE ? OR
      description LIKE ? OR
      application_number LIKE ? OR
      owner_name LIKE ? OR
      agent_name LIKE ? OR
      ipc_classification LIKE ? OR
      nice_classification LIKE ?
    )`;
    const q = `%${query}%`;
    params.push(q, q, q, q, q, q, q);
  }

  if (options.ipType) {
    sql += ' AND type = ?';
    params.push(options.ipType);
  }

  if (options.status) {
    sql += ' AND status = ?';
    params.push(options.status);
  }

  if (options.ownerName) {
    sql += ' AND owner_name LIKE ?';
    params.push(`%${options.ownerName}%`);
  }

  sql += ' ORDER BY filing_date DESC NULLS LAST, registration_date DESC NULLS LAST LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<CipoRecord>();
  return result.results ?? [];
}

/**
 * Get CIPO records by IP type.
 */
export async function getCipoByType(
  db: D1Database,
  ipType: CipoIpType,
  options: {
    limit?: number;
    status?: CipoStatus;
  } = {},
): Promise<CipoRecord[]> {
  return searchCipoRecords(db, '', {
    ipType,
    status: options.status,
    limit: options.limit ?? 100,
  });
}

/**
 * Get CIPO records by owner name.
 */
export async function getCipoByOwner(
  db: D1Database,
  ownerName: string,
  options: {
    limit?: number;
    ipType?: CipoIpType;
  } = {},
): Promise<CipoRecord[]> {
  return searchCipoRecords(db, ownerName, {
    ipType: options.ipType,
    limit: options.limit ?? 100,
  });
}

/**
 * Get active (in-force) CIPO records.
 */
export async function getActiveCipoRecords(
  db: D1Database,
  options: {
    ipType?: CipoIpType;
    limit?: number;
  } = {},
): Promise<CipoRecord[]> {
  return searchCipoRecords(db, '', {
    ipType: options.ipType,
    status: 'active',
    limit: options.limit ?? 100,
  });
}

/**
 * Get CIPO records expiring soon (within a given number of days).
 */
export async function getExpiringCipoRecords(
  db: D1Database,
  daysAhead: number = 90,
  options: {
    ipType?: CipoIpType;
    limit?: number;
  } = {},
): Promise<CipoRecord[]> {
  let sql = `SELECT * FROM cipo_records
    WHERE expiry_date IS NOT NULL
    AND date(expiry_date) BETWEEN date('now') AND date('now', '+${daysAhead} days')`;
  const params: unknown[] = [];

  if (options.ipType) {
    sql += ' AND type = ?';
    params.push(options.ipType);
  }

  sql += ' ORDER BY expiry_date ASC LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<CipoRecord>();
  return result.results ?? [];
}

/* ------------------------------------------------------------------ */
/*  Ingestion Orchestrator                                             */
/* ------------------------------------------------------------------ */

/**
 * Ingest CIPO IP rights records into the database.
 *
 * Orchestrates:
 *   1. Initialize table (if requested)
 *   2. Fetch IP records from CIPO APIs
 *   3. Parse and normalize records into unified schema
 *   4. Deduplicate and persist to D1
 *
 * @param db - D1 database instance (null to dry-run)
 * @param options - Ingestion options
 * @returns Ingestion result with counts and errors
 */
export async function ingestCipo(
  db: D1Database | null,
  options: CipoIngestionOptions = {},
): Promise<CipoIngestionResult> {
  const startTime = Date.now();
  const result: CipoIngestionResult = {
    recordsFound: 0,
    recordsIngested: 0,
    newRecords: 0,
    errors: [],
    perType: {},
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  const ipTypes = options.ipTypes ?? ALL_CIPO_IP_TYPES;
  const year = options.year;

  // Initialize per-type counters
  for (const pt of ipTypes) {
    result.perType[pt] = { recordsFound: 0, recordsIngested: 0 };
  }

  try {
    // Phase 0: Initialize table if requested
    if (db && options.initializeTable) {
      log('[CIPO] Initializing cipo_records table...');
      await initializeCipoTable(db);
    }

    // Phase 1: Fetch and process each IP type
    for (const ipType of ipTypes) {
      log(`[CIPO] Fetching ${ipType} records...`);

      try {
        const { records: rawRecords, errors: fetchErrors } = await fetchCipoRecords(
          ipType,
          year,
          { limit: maxRecords },
        );

        result.errors.push(...fetchErrors);
        log(`[CIPO] Found ${rawRecords.length} raw ${ipType} records`);

        // Get the configured source system for this type
        const sourceSystem = CIPO_IP_TYPE_CONFIG[ipType].sourceSystem;

        // Phase 2-4: Parse and persist
        const records = await parseCipoBatch(rawRecords, {
          sourceSystem,
          ipType,
        });

        for (const record of records) {
          result.recordsFound++;
          result.perType[ipType].recordsFound++;

          // Persist to database
          if (db) {
            const inserted = await upsertCipoRecord(db, record);
            if (inserted) {
              result.newRecords++;
            }
            result.recordsIngested++;
            result.perType[ipType].recordsIngested++;
          }
        }
      } catch (err) {
        const msg = `CIPO ${ipType} fetch/parse failed: ${(err as Error).message}`;
        result.errors.push(msg);
        log(`[CIPO] ${msg}`);
      }
    }
  } catch (err) {
    const msg = `CIPO ingestion failed: ${(err as Error).message}`;
    result.errors.push(msg);
    log(`[CIPO] ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[CIPO] Done: ${result.recordsFound} found, ${result.recordsIngested} ingested, ${result.newRecords} new in ${result.durationMs}ms`);

  return result;
}
