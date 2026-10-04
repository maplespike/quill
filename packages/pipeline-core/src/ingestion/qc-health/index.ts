// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Quebec Health Ingestion — Quill
 *
 * Orchestrates the ingestion pipeline for Quebec health records:
 *   - RAMQ (Régie de l'assurance maladie du Québec) medical claims statistics
 *   - INSPQ (Institut national de santé publique du Québec) public health data
 *
 * Pipeline:
 *   1. Fetch health records from Données Québec CKAN portal
 *   2. Parse and normalize records into RAMQRecord and QCHealthRecord schemas
 *   3. Persist to D1 database with deduplication
 *   4. Enable search and query functions
 *
 * Cross-reference opportunities:
 *   - Regional: health outcomes by Quebec administrative region
 *   - Immigration: health services for newcomers
 *   - Education: school-based health programs
 */

import {
  fetchQCHealthRecords,
  fetchAllQCHealthRecords,
} from './fetcher.js';
import {
  parseRAMQRecord,
  parseRAMQBatch,
  parseQCHealthRecord,
  parseQCHealthBatch,
} from './parser.js';
import {
  QC_HEALTH_DDL,
  QC_HEALTH_TYPE_CONFIG,
  ALL_QC_HEALTH_TYPES,
  DEFAULT_MAX_RECORDS,
  QCHealthError,
} from './constants.js';
import type {
  RAMQRecord,
  QCHealthRecord,
  RAMQRecordType,
  QCHealthIngestionOptions,
  QCHealthIngestionResult,
  RawRAMQRecord,
  RawQCHealthRecord,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Re-exports for barrel                                              */
/* ------------------------------------------------------------------ */

export {
  fetchQCHealthRecords,
  fetchAllQCHealthRecords,
} from './fetcher.js';

export {
  parseRAMQRecord,
  parseRAMQBatch,
  parseQCHealthRecord,
  parseQCHealthBatch,
} from './parser.js';

export {
  QC_HEALTH_DDL,
  QC_HEALTH_TYPE_CONFIG,
  ALL_QC_HEALTH_TYPES,
  DEFAULT_MAX_RECORDS,
  QCHealthError,
} from './constants.js';

export type {
  RAMQRecord,
  QCHealthRecord,
  RAMQRecordType,
  QCHealthIngestionOptions,
  QCHealthIngestionResult,
  RawRAMQRecord,
  RawQCHealthRecord,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  D1Database Interface                                               */
/* ------------------------------------------------------------------ */

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

export async function initializeQCHealthTable(db: D1Database): Promise<void> {
  await db.exec(QC_HEALTH_DDL);
}

async function upsertRAMQRecord(
  db: D1Database,
  record: RAMQRecord,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO qc_health_records
      (id, record_type, claim_type, service_code, service_date,
       provider_type, beneficiary_type, region, claims_count,
       total_paid, fiscal_year, source_url, source_system, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    'ramq',
    record.claimType,
    record.serviceCode,
    record.serviceDate,
    record.providerType,
    record.beneficiaryType,
    record.region,
    record.claimsCount,
    record.totalPaid,
    record.fiscalYear,
    record.sourceUrl,
    record.sourceSystem,
    record.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}

async function upsertQCHealthRecord(
  db: D1Database,
  record: QCHealthRecord,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO qc_health_records
      (id, record_type, title, title_fr, topic, publication_date,
       url, summary, source_url, source_system, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    'inspq',
    record.title,
    record.titleFr,
    record.topic,
    record.publicationDate,
    record.url,
    record.summary,
    record.url,
    record.sourceSystem,
    record.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}

export async function qchealthRecordExists(
  db: D1Database,
  id: string,
): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 FROM qc_health_records WHERE id = ? LIMIT 1`,
  ).bind(id).first();

  return row !== null;
}

export async function qcHealthTableExists(db: D1Database): Promise<boolean> {
  try {
    const row = await db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='qc_health_records'`,
    ).first();
    return row !== null;
  } catch {
    return false;
  }
}

export async function getLatestQCHealthIngestionDate(db: D1Database): Promise<string | null> {
  const row = await db.prepare(
    'SELECT ingested_at FROM qc_health_records ORDER BY ingested_at DESC LIMIT 1',
  ).first<{ ingested_at: string }>();
  return row?.ingested_at ?? null;
}

/* ------------------------------------------------------------------ */
/*  Search Functions                                                   */
/* ------------------------------------------------------------------ */

export async function searchQCHealthRecords(
  db: D1Database,
  query: string,
  options: {
    limit?: number;
    recordType?: RAMQRecordType;
    region?: string;
    topic?: string;
    fiscalYear?: string;
  } = {},
): Promise<(RAMQRecord | QCHealthRecord)[]> {
  let sql = `SELECT * FROM qc_health_records WHERE 1=1`;
  const params: unknown[] = [];

  if (query) {
    sql += ` AND (
      title LIKE ? OR
      title_fr LIKE ? OR
      claim_type LIKE ? OR
      topic LIKE ? OR
      summary LIKE ?
    )`;
    const q = `%${query}%`;
    params.push(q, q, q, q, q);
  }

  if (options.recordType) {
    sql += ' AND record_type = ?';
    params.push(options.recordType);
  }

  if (options.region) {
    sql += ' AND region LIKE ?';
    params.push(`%${options.region}%`);
  }

  if (options.topic) {
    sql += ' AND topic LIKE ?';
    params.push(`%${options.topic}%`);
  }

  if (options.fiscalYear) {
    sql += ' AND fiscal_year = ?';
    params.push(options.fiscalYear);
  }

  sql += ' ORDER BY ingested_at DESC LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all();
  return (result.results ?? []) as (RAMQRecord | QCHealthRecord)[];
}

export async function getRAMQByRegion(
  db: D1Database,
  region: string,
  options: {
    limit?: number;
    fiscalYear?: string;
  } = {},
): Promise<RAMQRecord[]> {
  let sql = `SELECT * FROM qc_health_records WHERE record_type = 'ramq' AND region LIKE ?`;
  const params: unknown[] = [`%${region}%`];

  if (options.fiscalYear) {
    sql += ' AND fiscal_year = ?';
    params.push(options.fiscalYear);
  }

  sql += ' ORDER BY service_date DESC LIMIT ?';
  params.push(options.limit ?? 100);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<RAMQRecord>();
  return result.results ?? [];
}

export async function getRAMQByFiscalYear(
  db: D1Database,
  fiscalYear: string,
  options: {
    limit?: number;
    region?: string;
  } = {},
): Promise<RAMQRecord[]> {
  let sql = `SELECT * FROM qc_health_records WHERE record_type = 'ramq' AND fiscal_year = ?`;
  const params: unknown[] = [fiscalYear];

  if (options.region) {
    sql += ' AND region LIKE ?';
    params.push(`%${options.region}%`);
  }

  sql += ' ORDER BY service_date DESC LIMIT ?';
  params.push(options.limit ?? 100);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<RAMQRecord>();
  return result.results ?? [];
}

/* ------------------------------------------------------------------ */
/*  Ingestion Orchestrator                                             */
/* ------------------------------------------------------------------ */

export async function ingestRAMQData(
  db: D1Database | null,
  options: QCHealthIngestionOptions = {},
): Promise<QCHealthIngestionResult> {
  const startTime = Date.now();
  const result: QCHealthIngestionResult = {
    recordsFound: 0,
    recordsIngested: 0,
    newRecords: 0,
    errors: [],
    perType: {},
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;

  result.perType['ramq'] = { recordsFound: 0, recordsIngested: 0 };

  try {
    if (db && options.initializeTable) {
      log('[QC-Health] Initializing qc_health_records table...');
      await initializeQCHealthTable(db);
    }

    log('[QC-Health] Fetching RAMQ records...');
    const { records: rawRecords, errors: fetchErrors } = await fetchQCHealthRecords('ramq', {
      limit: maxRecords,
    });

    result.errors.push(...fetchErrors);
    log(`[QC-Health] Found ${rawRecords.length} raw RAMQ records`);

    const ramqRecords = await parseRAMQBatch(rawRecords as RawRAMQRecord[], {
      sourceSystem: 'qc-ramq',
    });

    for (const record of ramqRecords) {
      result.recordsFound++;
      result.perType['ramq'].recordsFound++;

      if (db) {
        const inserted = await upsertRAMQRecord(db, record);
        if (inserted) {
          result.newRecords++;
        }
        result.recordsIngested++;
        result.perType['ramq'].recordsIngested++;
      }
    }
  } catch (err) {
    const msg = `RAMQ ingestion failed: ${(err as Error).message}`;
    result.errors.push(msg);
    log(`[QC-Health] ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[QC-Health] RAMQ done: ${result.recordsFound} found, ${result.recordsIngested} ingested, ${result.newRecords} new in ${result.durationMs}ms`);

  return result;
}

export async function ingestQCHealthData(
  db: D1Database | null,
  options: QCHealthIngestionOptions = {},
): Promise<QCHealthIngestionResult> {
  const startTime = Date.now();
  const result: QCHealthIngestionResult = {
    recordsFound: 0,
    recordsIngested: 0,
    newRecords: 0,
    errors: [],
    perType: {},
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;

  result.perType['inspq'] = { recordsFound: 0, recordsIngested: 0 };

  try {
    if (db && options.initializeTable) {
      log('[QC-Health] Initializing qc_health_records table...');
      await initializeQCHealthTable(db);
    }

    log('[QC-Health] Fetching INSPQ records...');
    const { records: rawRecords, errors: fetchErrors } = await fetchQCHealthRecords('inspq', {
      limit: maxRecords,
    });

    result.errors.push(...fetchErrors);
    log(`[QC-Health] Found ${rawRecords.length} raw INSPQ records`);

    const inspqRecords = await parseQCHealthBatch(rawRecords as RawQCHealthRecord[], {
      sourceSystem: 'qc-inspq',
    });

    for (const record of inspqRecords) {
      result.recordsFound++;
      result.perType['inspq'].recordsFound++;

      if (db) {
        const inserted = await upsertQCHealthRecord(db, record);
        if (inserted) {
          result.newRecords++;
        }
        result.recordsIngested++;
        result.perType['inspq'].recordsIngested++;
      }
    }
  } catch (err) {
    const msg = `INSPQ ingestion failed: ${(err as Error).message}`;
    result.errors.push(msg);
    log(`[QC-Health] ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[QC-Health] INSPQ done: ${result.recordsFound} found, ${result.recordsIngested} ingested, ${result.newRecords} new in ${result.durationMs}ms`);

  return result;
}

export async function ingestAllQCHealth(
  db: D1Database | null,
  options: QCHealthIngestionOptions = {},
): Promise<QCHealthIngestionResult> {
  const startTime = Date.now();
  const result: QCHealthIngestionResult = {
    recordsFound: 0,
    recordsIngested: 0,
    newRecords: 0,
    errors: [],
    perType: {},
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});
  const recordTypes = options.recordTypes ?? ALL_QC_HEALTH_TYPES;

  for (const rt of recordTypes) {
    result.perType[rt] = { recordsFound: 0, recordsIngested: 0 };
  }

  try {
    if (db && options.initializeTable) {
      log('[QC-Health] Initializing qc_health_records table...');
      await initializeQCHealthTable(db);
    }

    const ramqResult = await ingestRAMQData(db, { ...options, initializeTable: false });
    result.recordsFound += ramqResult.recordsFound;
    result.recordsIngested += ramqResult.recordsIngested;
    result.newRecords += ramqResult.newRecords;
    result.errors.push(...ramqResult.errors);
    result.perType['ramq'] = ramqResult.perType['ramq'];

    const inspqResult = await ingestQCHealthData(db, { ...options, initializeTable: false });
    result.recordsFound += inspqResult.recordsFound;
    result.recordsIngested += inspqResult.recordsIngested;
    result.newRecords += inspqResult.newRecords;
    result.errors.push(...inspqResult.errors);
    result.perType['inspq'] = inspqResult.perType['inspq'];
  } catch (err) {
    const msg = `QC Health ingestion failed: ${(err as Error).message}`;
    result.errors.push(msg);
    log(`[QC-Health] ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[QC-Health] All done: ${result.recordsFound} found, ${result.recordsIngested} ingested, ${result.newRecords} new in ${result.durationMs}ms`);

  return result;
}