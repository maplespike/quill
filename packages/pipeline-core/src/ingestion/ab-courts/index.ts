// SPDX-License-Identifier: AGPL-3.0-only

import { fetchAbCourtsRecords } from './fetcher.js';
import { parseAbCourtsRecord, parseAbCourtsBatch } from './parser.js';
import { ABCOURTS_DDL, DEFAULT_MAX_RECORDS, AbCourtsError } from './constants.js';
import type { AbCourtsRecord, AbCourtsIngestionOptions, AbCourtsIngestionResult, RawAbCourtsRecord } from './types.js';

export { fetchAbCourtsRecords } from './fetcher.js';
export { parseAbCourtsRecord, parseAbCourtsBatch } from './parser.js';
export { ABCOURTS_DDL, DEFAULT_MAX_RECORDS, AbCourtsError } from './constants.js';
export type { AbCourtsRecord, AbCourtsIngestionOptions, AbCourtsIngestionResult, RawAbCourtsRecord } from './types.js';

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

export async function initializeAbCourtsTable(db: D1Database): Promise<void> {
  await db.exec(ABCOURTS_DDL);
}

async function upsertAbCourtsRecord(db: D1Database, record: AbCourtsRecord): Promise<boolean> {
  const fields = ['id', 'record_type', 'court_type', 'file_number', 'filing_date', 'case_type', 'location', 'status'];
  const values = [record.id, record.recordType, record.courtType, record.fileNumber, record.filingDate, record.caseType, record.location, record.status];
  const placeholders = fields.map(() => '?').join(', ');
  const stmt = db.prepare('INSERT OR IGNORE INTO ab_court_records (' + fields.join(', ') + ') VALUES (' + placeholders + ')').bind(...values);
  const result = await stmt.run();
  return result.success;
}

export async function searchAbCourtsRecords(db: D1Database, query: string, options: { limit?: number } = {}): Promise<AbCourtsRecord[]> {
  let sql = 'SELECT * FROM ab_court_records WHERE 1=1';
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
  const result = await stmt.all<AbCourtsRecord>();
  return result.results ?? [];
}

export async function ingestAbCourtsData(db: D1Database | null, options: AbCourtsIngestionOptions = {}): Promise<AbCourtsIngestionResult> {
  const startTime = Date.now();
  const result: AbCourtsIngestionResult = { recordsFound: 0, recordsIngested: 0, newRecords: 0, errors: [], perType: {}, durationMs: 0 };
  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  result.perType['ab_court'] = { recordsFound: 0, recordsIngested: 0 };

  try {
    if (db && options.initializeTable) {
      log('[AbCourts] Initializing table...');
      await initializeAbCourtsTable(db);
    }

    log('[AbCourts] Fetching data...');
    const { records: rawRecords, errors: fetchErrors } = await fetchAbCourtsRecords({ limit: maxRecords });
    result.errors.push(...fetchErrors);
    log('[AbCourts] Found ' + rawRecords.length + ' raw records');

    const parsed = await parseAbCourtsBatch(rawRecords as RawAbCourtsRecord[], { sourceSystem: 'ab-courts' });

    for (const record of parsed) {
      result.recordsFound++;
      result.perType['ab_court'].recordsFound++;
      if (db) {
        const inserted = await upsertAbCourtsRecord(db, record);
        if (inserted) result.newRecords++;
        result.recordsIngested++;
        result.perType['ab_court'].recordsIngested++;
      }
    }
  } catch (err) {
    const msg = 'AbCourts ingestion failed: ' + (err as Error).message;
    result.errors.push(msg);
    log('[AbCourts] ' + msg);
  }

  result.durationMs = Date.now() - startTime;
  log('[AbCourts] Done: ' + result.recordsFound + ' found, ' + result.recordsIngested + ' ingested, ' + result.newRecords + ' new in ' + result.durationMs + 'ms');
  return result;
}
