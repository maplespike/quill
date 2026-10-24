// SPDX-License-Identifier: AGPL-3.0-only

import { fetchBcImmigrationRecords } from './fetcher.js';
import { parseBcImmigrationRecord, parseBcImmigrationBatch } from './parser.js';
import { BCIMMIGRATION_DDL, DEFAULT_MAX_RECORDS, BcImmigrationError } from './constants.js';
import type { BcImmigrationRecord, BcImmigrationIngestionOptions, BcImmigrationIngestionResult, RawBcImmigrationRecord } from './types.js';

export { fetchBcImmigrationRecords } from './fetcher.js';
export { parseBcImmigrationRecord, parseBcImmigrationBatch } from './parser.js';
export { BCIMMIGRATION_DDL, DEFAULT_MAX_RECORDS, BcImmigrationError } from './constants.js';
export type { BcImmigrationRecord, BcImmigrationIngestionOptions, BcImmigrationIngestionResult, RawBcImmigrationRecord } from './types.js';

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

export async function initializeBcImmigrationTable(db: D1Database): Promise<void> {
  await db.exec(BCIMMIGRATION_DDL);
}

async function upsertBcImmigrationRecord(db: D1Database, record: BcImmigrationRecord): Promise<boolean> {
  const fields = ['id', 'record_type', 'stream', 'nominations_issued', 'year', 'quarter', 'occupation', 'industry'];
  const values = [record.id, record.recordType, record.stream, record.nominationsIssued, record.year, record.quarter, record.occupation, record.industry];
  const placeholders = fields.map(() => '?').join(', ');
  const stmt = db.prepare('INSERT OR IGNORE INTO bc_immigration_records (' + fields.join(', ') + ') VALUES (' + placeholders + ')').bind(...values);
  const result = await stmt.run();
  return result.success;
}

export async function searchBcImmigrationRecords(db: D1Database, query: string, options: { limit?: number } = {}): Promise<BcImmigrationRecord[]> {
  let sql = 'SELECT * FROM bc_immigration_records WHERE 1=1';
  const params: unknown[] = [];

if (query) {
    const likeCols = ['record_type', 'stream', 'occupation', 'industry'];
    sql += ' AND (' + likeCols.map(c => c + ' LIKE ?').join(' OR ') + ')';
    const q = '%' + query + '%';
    for (let i = 0; i < 4; i++) params.push(q);
  }

  sql += ' ORDER BY ingested_at DESC LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<BcImmigrationRecord>();
  return result.results ?? [];
}

export async function ingestBcImmigrationData(db: D1Database | null, options: BcImmigrationIngestionOptions = {}): Promise<BcImmigrationIngestionResult> {
  const startTime = Date.now();
  const result: BcImmigrationIngestionResult = { recordsFound: 0, recordsIngested: 0, newRecords: 0, errors: [], perType: {}, durationMs: 0 };
  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  result.perType['bcpnp'] = { recordsFound: 0, recordsIngested: 0 };

  try {
    if (db && options.initializeTable) {
      log('[BcImmigration] Initializing table...');
      await initializeBcImmigrationTable(db);
    }

    log('[BcImmigration] Fetching data...');
    const { records: rawRecords, errors: fetchErrors } = await fetchBcImmigrationRecords({ limit: maxRecords });
    result.errors.push(...fetchErrors);
    log('[BcImmigration] Found ' + rawRecords.length + ' raw records');

    const parsed = await parseBcImmigrationBatch(rawRecords as RawBcImmigrationRecord[], { sourceSystem: 'bc-bcpnp' });

    for (const record of parsed) {
      result.recordsFound++;
      result.perType['bcpnp'].recordsFound++;
      if (db) {
        const inserted = await upsertBcImmigrationRecord(db, record);
        if (inserted) result.newRecords++;
        result.recordsIngested++;
        result.perType['bcpnp'].recordsIngested++;
      }
    }
  } catch (err) {
    const msg = 'BcImmigration ingestion failed: ' + (err as Error).message;
    result.errors.push(msg);
    log('[BcImmigration] ' + msg);
  }

  result.durationMs = Date.now() - startTime;
  log('[BcImmigration] Done: ' + result.recordsFound + ' found, ' + result.recordsIngested + ' ingested, ' + result.newRecords + ' new in ' + result.durationMs + 'ms');
  return result;
}
