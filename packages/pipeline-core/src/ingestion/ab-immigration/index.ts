// SPDX-License-Identifier: AGPL-3.0-only

import { fetchAbImmigrationRecords } from './fetcher.js';
import { parseAbImmigrationRecord, parseAbImmigrationBatch } from './parser.js';
import { ABIMMIGRATION_DDL, DEFAULT_MAX_RECORDS, AbImmigrationError } from './constants.js';
import type { AbImmigrationRecord, AbImmigrationIngestionOptions, AbImmigrationIngestionResult, RawAbImmigrationRecord } from './types.js';

export { fetchAbImmigrationRecords } from './fetcher.js';
export { parseAbImmigrationRecord, parseAbImmigrationBatch } from './parser.js';
export { ABIMMIGRATION_DDL, DEFAULT_MAX_RECORDS, AbImmigrationError } from './constants.js';
export type { AbImmigrationRecord, AbImmigrationIngestionOptions, AbImmigrationIngestionResult, RawAbImmigrationRecord } from './types.js';

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

export async function initializeAbImmigrationTable(db: D1Database): Promise<void> {
  await db.exec(ABIMMIGRATION_DDL);
}

async function upsertAbImmigrationRecord(db: D1Database, record: AbImmigrationRecord): Promise<boolean> {
  const fields = ['id', 'record_type', 'stream', 'nominations_issued', 'year', 'quarter', 'occupation', 'industry'];
  const values = [record.id, record.recordType, record.stream, record.nominationsIssued, record.year, record.quarter, record.occupation, record.industry];
  const placeholders = fields.map(() => '?').join(', ');
  const stmt = db.prepare('INSERT OR IGNORE INTO ab_immigration_records (' + fields.join(', ') + ') VALUES (' + placeholders + ')').bind(...values);
  const result = await stmt.run();
  return result.success;
}

export async function searchAbImmigrationRecords(db: D1Database, query: string, options: { limit?: number } = {}): Promise<AbImmigrationRecord[]> {
  let sql = 'SELECT * FROM ab_immigration_records WHERE 1=1';
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
  const result = await stmt.all<AbImmigrationRecord>();
  return result.results ?? [];
}

export async function ingestAbImmigrationData(db: D1Database | null, options: AbImmigrationIngestionOptions = {}): Promise<AbImmigrationIngestionResult> {
  const startTime = Date.now();
  const result: AbImmigrationIngestionResult = { recordsFound: 0, recordsIngested: 0, newRecords: 0, errors: [], perType: {}, durationMs: 0 };
  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  result.perType['aaip'] = { recordsFound: 0, recordsIngested: 0 };

  try {
    if (db && options.initializeTable) {
      log('[AbImmigration] Initializing table...');
      await initializeAbImmigrationTable(db);
    }

    log('[AbImmigration] Fetching data...');
    const { records: rawRecords, errors: fetchErrors } = await fetchAbImmigrationRecords({ limit: maxRecords });
    result.errors.push(...fetchErrors);
    log('[AbImmigration] Found ' + rawRecords.length + ' raw records');

    const parsed = await parseAbImmigrationBatch(rawRecords as RawAbImmigrationRecord[], { sourceSystem: 'ab-aaip' });

    for (const record of parsed) {
      result.recordsFound++;
      result.perType['aaip'].recordsFound++;
      if (db) {
        const inserted = await upsertAbImmigrationRecord(db, record);
        if (inserted) result.newRecords++;
        result.recordsIngested++;
        result.perType['aaip'].recordsIngested++;
      }
    }
  } catch (err) {
    const msg = 'AbImmigration ingestion failed: ' + (err as Error).message;
    result.errors.push(msg);
    log('[AbImmigration] ' + msg);
  }

  result.durationMs = Date.now() - startTime;
  log('[AbImmigration] Done: ' + result.recordsFound + ' found, ' + result.recordsIngested + ' ingested, ' + result.newRecords + ' new in ' + result.durationMs + 'ms');
  return result;
}
