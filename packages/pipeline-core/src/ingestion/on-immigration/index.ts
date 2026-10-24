// SPDX-License-Identifier: AGPL-3.0-only

import { fetchOnImmigrationRecords } from './fetcher.js';
import { parseOnImmigrationRecord, parseOnImmigrationBatch } from './parser.js';
import { ONIMMIGRATION_DDL, DEFAULT_MAX_RECORDS, OnImmigrationError } from './constants.js';
import type { OnImmigrationRecord, OnImmigrationIngestionOptions, OnImmigrationIngestionResult, RawOnImmigrationRecord } from './types.js';

export { fetchOnImmigrationRecords } from './fetcher.js';
export { parseOnImmigrationRecord, parseOnImmigrationBatch } from './parser.js';
export { ONIMMIGRATION_DDL, DEFAULT_MAX_RECORDS, OnImmigrationError } from './constants.js';
export type { OnImmigrationRecord, OnImmigrationIngestionOptions, OnImmigrationIngestionResult, RawOnImmigrationRecord } from './types.js';

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

export async function initializeOnImmigrationTable(db: D1Database): Promise<void> {
  await db.exec(ONIMMIGRATION_DDL);
}

async function upsertOnImmigrationRecord(db: D1Database, record: OnImmigrationRecord): Promise<boolean> {
  const fields = ['id', 'record_type', 'stream', 'nominations_issued', 'year', 'quarter', 'occupation', 'industry'];
  const values = [record.id, record.recordType, record.stream, record.nominationsIssued, record.year, record.quarter, record.occupation, record.industry];
  const placeholders = fields.map(() => '?').join(', ');
  const stmt = db.prepare('INSERT OR IGNORE INTO on_immigration_records (' + fields.join(', ') + ') VALUES (' + placeholders + ')').bind(...values);
  const result = await stmt.run();
  return result.success;
}

export async function searchOnImmigrationRecords(db: D1Database, query: string, options: { limit?: number } = {}): Promise<OnImmigrationRecord[]> {
  let sql = 'SELECT * FROM on_immigration_records WHERE 1=1';
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
  const result = await stmt.all<OnImmigrationRecord>();
  return result.results ?? [];
}

export async function ingestOnImmigrationData(db: D1Database | null, options: OnImmigrationIngestionOptions = {}): Promise<OnImmigrationIngestionResult> {
  const startTime = Date.now();
  const result: OnImmigrationIngestionResult = { recordsFound: 0, recordsIngested: 0, newRecords: 0, errors: [], perType: {}, durationMs: 0 };
  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  result.perType['oinp'] = { recordsFound: 0, recordsIngested: 0 };

  try {
    if (db && options.initializeTable) {
      log('[OnImmigration] Initializing table...');
      await initializeOnImmigrationTable(db);
    }

    log('[OnImmigration] Fetching data...');
    const { records: rawRecords, errors: fetchErrors } = await fetchOnImmigrationRecords({ limit: maxRecords });
    result.errors.push(...fetchErrors);
    log('[OnImmigration] Found ' + rawRecords.length + ' raw records');

    const parsed = await parseOnImmigrationBatch(rawRecords as RawOnImmigrationRecord[], { sourceSystem: 'on-oinp' });

    for (const record of parsed) {
      result.recordsFound++;
      result.perType['oinp'].recordsFound++;
      if (db) {
        const inserted = await upsertOnImmigrationRecord(db, record);
        if (inserted) result.newRecords++;
        result.recordsIngested++;
        result.perType['oinp'].recordsIngested++;
      }
    }
  } catch (err) {
    const msg = 'OnImmigration ingestion failed: ' + (err as Error).message;
    result.errors.push(msg);
    log('[OnImmigration] ' + msg);
  }

  result.durationMs = Date.now() - startTime;
  log('[OnImmigration] Done: ' + result.recordsFound + ' found, ' + result.recordsIngested + ' ingested, ' + result.newRecords + ' new in ' + result.durationMs + 'ms');
  return result;
}
