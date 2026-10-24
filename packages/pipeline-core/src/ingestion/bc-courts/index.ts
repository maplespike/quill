// SPDX-License-Identifier: AGPL-3.0-only

import { fetchBcCourtsRecords } from './fetcher.js';
import { parseBcCourtsRecord, parseBcCourtsBatch } from './parser.js';
import { BCCOURTS_DDL, DEFAULT_MAX_RECORDS, BcCourtsError } from './constants.js';
import type { BcCourtsRecord, BcCourtsIngestionOptions, BcCourtsIngestionResult, RawBcCourtsRecord } from './types.js';

export { fetchBcCourtsRecords } from './fetcher.js';
export { parseBcCourtsRecord, parseBcCourtsBatch } from './parser.js';
export { BCCOURTS_DDL, DEFAULT_MAX_RECORDS, BcCourtsError } from './constants.js';
export type { BcCourtsRecord, BcCourtsIngestionOptions, BcCourtsIngestionResult, RawBcCourtsRecord } from './types.js';

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

export async function initializeBcCourtsTable(db: D1Database): Promise<void> {
  await db.exec(BCCOURTS_DDL);
}

async function upsertBcCourtsRecord(db: D1Database, record: BcCourtsRecord): Promise<boolean> {
  const fields = ['id', 'record_type', 'court_type', 'file_number', 'filing_date', 'case_type', 'location', 'status'];
  const values = [record.id, record.recordType, record.courtType, record.fileNumber, record.filingDate, record.caseType, record.location, record.status];
  const placeholders = fields.map(() => '?').join(', ');
  const stmt = db.prepare('INSERT OR IGNORE INTO bc_court_records (' + fields.join(', ') + ') VALUES (' + placeholders + ')').bind(...values);
  const result = await stmt.run();
  return result.success;
}

export async function searchBcCourtsRecords(db: D1Database, query: string, options: { limit?: number } = {}): Promise<BcCourtsRecord[]> {
  let sql = 'SELECT * FROM bc_court_records WHERE 1=1';
  const params: unknown[] = [];

if (query) {
    const likeCols = ['record_type', 'court_type', 'file_number', 'filing_date', 'case_type', 'location', 'status'];
    sql += ' AND (' + likeCols.map(c => c + ' LIKE ?').join(' OR ') + ')';
    const q = '%' + query + '%';
    for (let i = 0; i < 7; i++) params.push(q);
  }

  sql += ' ORDER BY ingested_at DESC LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<BcCourtsRecord>();
  return result.results ?? [];
}

export async function ingestBcCourtsData(db: D1Database | null, options: BcCourtsIngestionOptions = {}): Promise<BcCourtsIngestionResult> {
  const startTime = Date.now();
  const result: BcCourtsIngestionResult = { recordsFound: 0, recordsIngested: 0, newRecords: 0, errors: [], perType: {}, durationMs: 0 };
  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  result.perType['bc_court'] = { recordsFound: 0, recordsIngested: 0 };

  try {
    if (db && options.initializeTable) {
      log('[BcCourts] Initializing table...');
      await initializeBcCourtsTable(db);
    }

    log('[BcCourts] Fetching data...');
    const { records: rawRecords, errors: fetchErrors } = await fetchBcCourtsRecords({ limit: maxRecords });
    result.errors.push(...fetchErrors);
    log('[BcCourts] Found ' + rawRecords.length + ' raw records');

    const parsed = await parseBcCourtsBatch(rawRecords as RawBcCourtsRecord[], { sourceSystem: 'bc-courts' });

    for (const record of parsed) {
      result.recordsFound++;
      result.perType['bc_court'].recordsFound++;
      if (db) {
        const inserted = await upsertBcCourtsRecord(db, record);
        if (inserted) result.newRecords++;
        result.recordsIngested++;
        result.perType['bc_court'].recordsIngested++;
      }
    }
  } catch (err) {
    const msg = 'BcCourts ingestion failed: ' + (err as Error).message;
    result.errors.push(msg);
    log('[BcCourts] ' + msg);
  }

  result.durationMs = Date.now() - startTime;
  log('[BcCourts] Done: ' + result.recordsFound + ' found, ' + result.recordsIngested + ' ingested, ' + result.newRecords + ' new in ' + result.durationMs + 'ms');
  return result;
}
