// SPDX-License-Identifier: AGPL-3.0-only

import { fetchQcImmigrationRecords } from './fetcher.js';
import { parseQcImmigrationRecord, parseQcImmigrationBatch } from './parser.js';
import { QC_IMMIGRATION_DDL, DEFAULT_MAX_RECORDS, QCImmigrationError } from './constants.js';
import type { QcImmigrationRecord, QcImmigrationIngestionOptions, QcImmigrationIngestionResult, RawQcImmigrationRecord } from './types.js';

export { fetchQcImmigrationRecords } from './fetcher.js';
export { parseQcImmigrationRecord, parseQcImmigrationBatch } from './parser.js';
export { QC_IMMIGRATION_DDL, DEFAULT_MAX_RECORDS, QCImmigrationError } from './constants.js';
export type { QcImmigrationRecord, QcImmigrationIngestionOptions, QcImmigrationIngestionResult, RawQcImmigrationRecord } from './types.js';

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

export async function initializeQcImmigrationTable(db: D1Database): Promise<void> {
  await db.exec(QC_IMMIGRATION_DDL);
}

async function upsertQcImmigrationRecord(db: D1Database, record: QcImmigrationRecord): Promise<boolean> {
  const fields = ['id', 'record_type', 'stream', 'nominations_issued', 'year', 'quarter', 'country_of_origin', 'region'];
  const values = [record.id, record.recordType, record.stream, record.nominationsIssued, record.year, record.quarter, record.countryOfOrigin, record.region];
  const placeholders = fields.map(() => '?').join(', ');
  const stmt = db.prepare('INSERT OR IGNORE INTO qc_immigration_records (' + fields.join(', ') + ') VALUES (' + placeholders + ')').bind(...values);
  const result = await stmt.run();
  return result.success;
}

export async function searchQcImmigrationRecords(db: D1Database, query: string, options: { limit?: number } = {}): Promise<QcImmigrationRecord[]> {
  let sql = 'SELECT * FROM qc_immigration_records WHERE 1=1';
  const params: unknown[] = [];

if (query) {
    const likeCols = ['record_type', 'stream', 'country_of_origin', 'region'];
    sql += ' AND (' + likeCols.map(c => c + ' LIKE ?').join(' OR ') + ')';
    const q = '%' + query + '%';
    for (let i = 0; i < 4; i++) params.push(q);
  }

  sql += ' ORDER BY ingested_at DESC LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<QcImmigrationRecord>();
  return result.results ?? [];
}

export async function ingestQcImmigrationData(db: D1Database | null, options: QcImmigrationIngestionOptions = {}): Promise<QcImmigrationIngestionResult> {
  const startTime = Date.now();
  const result: QcImmigrationIngestionResult = { recordsFound: 0, recordsIngested: 0, newRecords: 0, errors: [], perType: {}, durationMs: 0 };
  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  result.perType['qc_immigration'] = { recordsFound: 0, recordsIngested: 0 };

  try {
    if (db && options.initializeTable) {
      log('[QcImmigration] Initializing table...');
      await initializeQcImmigrationTable(db);
    }

    log('[QcImmigration] Fetching data...');
    const { records: rawRecords, errors: fetchErrors } = await fetchQcImmigrationRecords({ limit: maxRecords });
    result.errors.push(...fetchErrors);
    log('[QcImmigration] Found ' + rawRecords.length + ' raw records');

    const parsed = await parseQcImmigrationBatch(rawRecords as RawQcImmigrationRecord[], { sourceSystem: 'qc-mifi' });

    for (const record of parsed) {
      result.recordsFound++;
      result.perType['qc_immigration'].recordsFound++;
      if (db) {
        const inserted = await upsertQcImmigrationRecord(db, record);
        if (inserted) result.newRecords++;
        result.recordsIngested++;
        result.perType['qc_immigration'].recordsIngested++;
      }
    }
  } catch (err) {
    const msg = 'QcImmigration ingestion failed: ' + (err as Error).message;
    result.errors.push(msg);
    log('[QcImmigration] ' + msg);
  }

  result.durationMs = Date.now() - startTime;
  log('[QcImmigration] Done: ' + result.recordsFound + ' found, ' + result.recordsIngested + ' ingested, ' + result.newRecords + ' new in ' + result.durationMs + 'ms');
  return result;
}
