// SPDX-License-Identifier: AGPL-3.0-only

import {
  fetchOntarioHealthRecords,
  fetchAllOntarioHealthRecords,
} from './fetcher.js';
import {
  parseOntarioHealthRecord,
  parseOntarioHealthBatch,
  normalizeOntarioHealthRecordType,
} from './parser.js';
import {
  ON_HEALTH_DDL,
  ON_HEALTH_TYPE_CONFIG,
  DEFAULT_MAX_RECORDS,
  OntarioHealthError,
  ALL_ON_HEALTH_TYPES,
} from './constants.js';
import type {
  OntarioHealthRecord,
  OntarioHealthRecordType,
  OntarioHealthIngestionOptions,
  OntarioHealthIngestionResult,
  RawOntarioHealthRecord,
} from './types.js';

export {
  fetchOntarioHealthRecords,
  fetchAllOntarioHealthRecords,
} from './fetcher.js';

export {
  parseOntarioHealthRecord,
  parseOntarioHealthBatch,
  normalizeOntarioHealthRecordType,
} from './parser.js';

export {
  ON_HEALTH_DDL,
  ON_HEALTH_TYPE_CONFIG,
  DEFAULT_MAX_RECORDS,
  OntarioHealthError,
} from './constants.js';

export type {
  OntarioHealthRecord,
  OntarioHealthRecordType,
  OntarioHealthIngestionOptions,
  OntarioHealthIngestionResult,
  RawOntarioHealthRecord,
} from './types.js';

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

export async function initializeOntarioHealthTable(db: D1Database): Promise<void> {
  await db.exec(ON_HEALTH_DDL);
}

async function upsertOntarioHealthRecord(
  db: D1Database,
  record: OntarioHealthRecord,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO ontario_health_records
      (id, record_type, claim_type, service_code, service_date,
       provider_type, fee_schedule, claims_count,
       total_paid, fiscal_year, source_url, source_system, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    'ohip_claim',
    record.claimType,
    record.serviceCode,
    record.serviceDate,
    record.providerType,
    record.feeSchedule,
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

export async function onHealthRecordExists(
  db: D1Database,
  id: string,
): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 FROM ontario_health_records WHERE id = ? LIMIT 1`,
  ).bind(id).first();

  return row !== null;
}

export async function onHealthTableExists(db: D1Database): Promise<boolean> {
  try {
    const row = await db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='ontario_health_records'`,
    ).first();
    return row !== null;
  } catch {
    return false;
  }
}

export async function getLatestONHealthIngestionDate(db: D1Database): Promise<string | null> {
  const row = await db.prepare(
    'SELECT ingested_at FROM ontario_health_records ORDER BY ingested_at DESC LIMIT 1',
  ).first<{ ingested_at: string }>();
  return row?.ingested_at ?? null;
}

export async function searchONHealthRecords(
  db: D1Database,
  query: string,
  options: {
    limit?: number;
    recordType?: OntarioHealthRecordType;
    fiscalYear?: string;
    providerType?: string;
  } = {},
): Promise<OntarioHealthRecord[]> {
  let sql = `SELECT * FROM ontario_health_records WHERE 1=1`;
  const params: unknown[] = [];

  if (query) {
    sql += ` AND (
      claim_type LIKE ? OR
      service_code LIKE ? OR
      provider_type LIKE ? OR
      fee_schedule LIKE ?
    )`;
    const q = `%${query}%`;
    params.push(q, q, q, q);
  }

  if (options.recordType) {
    sql += ' AND record_type = ?';
    params.push(options.recordType);
  }

  if (options.fiscalYear) {
    sql += ' AND fiscal_year = ?';
    params.push(options.fiscalYear);
  }

  if (options.providerType) {
    sql += ' AND provider_type LIKE ?';
    params.push(`%${options.providerType}%`);
  }

  sql += ' ORDER BY ingested_at DESC LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<OntarioHealthRecord>();
  return result.results ?? [];
}

export async function getONHealthByFiscalYear(
  db: D1Database,
  fiscalYear: string,
  options: { limit?: number } = {},
): Promise<OntarioHealthRecord[]> {
  return searchONHealthRecords(db, '', { fiscalYear, limit: options.limit ?? 100 });
}

export async function getONHealthByProviderType(
  db: D1Database,
  providerType: string,
  options: { limit?: number; fiscalYear?: string } = {},
): Promise<OntarioHealthRecord[]> {
  return searchONHealthRecords(db, providerType, {
    providerType,
    fiscalYear: options.fiscalYear,
    limit: options.limit ?? 100,
  });
}

export async function ingestOntarioHealthClaims(
  db: D1Database | null,
  options: OntarioHealthIngestionOptions = {},
): Promise<OntarioHealthIngestionResult> {
  const startTime = Date.now();
  const result: OntarioHealthIngestionResult = {
    recordsFound: 0,
    recordsIngested: 0,
    newRecords: 0,
    errors: [],
    perType: {},
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;

  result.perType['ohip_claim'] = { recordsFound: 0, recordsIngested: 0 };

  try {
    if (db && options.initializeTable) {
      log('[ON-Health] Initializing ontario_health_records table...');
      await initializeOntarioHealthTable(db);
    }

    log('[ON-Health] Fetching OHIP claims...');
    const { records: rawRecords, errors: fetchErrors } = await fetchOntarioHealthRecords('ohip_claim', {
      limit: maxRecords,
    });

    result.errors.push(...fetchErrors);
    log(`[ON-Health] Found ${rawRecords.length} raw OHIP claim records`);

    const ohipRecords = await parseOntarioHealthBatch(rawRecords as RawOntarioHealthRecord[], {
      sourceSystem: 'on-ohip',
    });

    for (const record of ohipRecords) {
      result.recordsFound++;
      result.perType['ohip_claim'].recordsFound++;

      if (db) {
        const inserted = await upsertOntarioHealthRecord(db, record);
        if (inserted) {
          result.newRecords++;
        }
        result.recordsIngested++;
        result.perType['ohip_claim'].recordsIngested++;
      }
    }
  } catch (err) {
    const msg = `OHIP ingestion failed: ${(err as Error).message}`;
    result.errors.push(msg);
    log(`[ON-Health] ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[ON-Health] OHIP done: ${result.recordsFound} found, ${result.recordsIngested} ingested, ${result.newRecords} new in ${result.durationMs}ms`);

  return result;
}

export async function ingestAllONHealth(
  db: D1Database | null,
  options: OntarioHealthIngestionOptions = {},
): Promise<OntarioHealthIngestionResult> {
  const startTime = Date.now();
  const result: OntarioHealthIngestionResult = {
    recordsFound: 0,
    recordsIngested: 0,
    newRecords: 0,
    errors: [],
    perType: {},
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  for (const rt of (options.recordTypes ?? ALL_ON_HEALTH_TYPES)) {
    result.perType[rt] = { recordsFound: 0, recordsIngested: 0 };
  }

  try {
    if (db && options.initializeTable) {
      log('[ON-Health] Initializing ontario_health_records table...');
      await initializeOntarioHealthTable(db);
    }

    const ohipResult = await ingestOntarioHealthClaims(db, { ...options, initializeTable: false });
    result.recordsFound += ohipResult.recordsFound;
    result.recordsIngested += ohipResult.recordsIngested;
    result.newRecords += ohipResult.newRecords;
    result.errors.push(...ohipResult.errors);
    result.perType['ohip_claim'] = ohipResult.perType['ohip_claim'];
  } catch (err) {
    const msg = `ON Health ingestion failed: ${(err as Error).message}`;
    result.errors.push(msg);
    log(`[ON-Health] ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[ON-Health] All done: ${result.recordsFound} found, ${result.recordsIngested} ingested, ${result.newRecords} new in ${result.durationMs}ms`);

  return result;
}
