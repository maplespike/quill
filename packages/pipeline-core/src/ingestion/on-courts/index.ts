// SPDX-License-Identifier: AGPL-3.0-only

import { fetchOnCourtsRecords } from './fetcher.js';
import { parseOnCourtsRecord, parseOnCourtsBatch } from './parser.js';
import { ONCOURTS_DDL, DEFAULT_MAX_RECORDS, OnCourtsError } from './constants.js';
import type { OnCourtsRecord, OnCourtsIngestionOptions, OnCourtsIngestionResult, RawOnCourtsRecord } from './types.js';

export { fetchOnCourtsRecords } from './fetcher.js';
export { parseOnCourtsRecord, parseOnCourtsBatch } from './parser.js';
export { ONCOURTS_DDL, DEFAULT_MAX_RECORDS, OnCourtsError } from './constants.js';
export type { OnCourtsRecord, OnCourtsIngestionOptions, OnCourtsIngestionResult, RawOnCourtsRecord } from './types.js';

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

export async function initializeOnCourtsTable(db: D1Database): Promise<void> {
  await db.exec(ONCOURTS_DDL);
}

async function upsertOnCourtsRecord(db: D1Database, record: OnCourtsRecord): Promise<boolean> {
  const fields = ['id', 'record_type', 'court_type', 'case_number', 'filing_date', 'case_type', 'location', 'status'];
  const values = [record.id, record.recordType, record.courtType, record.caseNumber, record.filingDate, record.caseType, record.location, record.status];
  const placeholders = fields.map(() => '?').join(', ');
  const stmt = db.prepare('INSERT OR IGNORE INTO on_court_records (' + fields.join(', ') + ') VALUES (' + placeholders + ')').bind(...values);
  const result = await stmt.run();
  return result.success;
}

export async function searchOnCourtsRecords(db: D1Database, query: string, options: { limit?: number } = {}): Promise<OnCourtsRecord[]> {
  let sql = 'SELECT * FROM on_court_records WHERE 1=1';
  const params: unknown[] = [];

if (query) {
    const likeCols = ['record_type', 'court_type', 'case_number', 'filing_date', 'case_type', 'location', 'status'];
    sql += ' AND (' + likeCols.map(c => c + ' LIKE ?').join(' OR ') + ')';
    const q = '%' + query + '%';
    for (let i = 0; i < 7; i++) params.push(q);
  }

  sql += ' ORDER BY ingested_at DESC LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<OnCourtsRecord>();
  return result.results ?? [];
}

export async function ingestOnCourtsData(db: D1Database | null, options: OnCourtsIngestionOptions = {}): Promise<OnCourtsIngestionResult> {
  const startTime = Date.now();
  const result: OnCourtsIngestionResult = { recordsFound: 0, recordsIngested: 0, newRecords: 0, errors: [], perType: {}, durationMs: 0 };
  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  result.perType['on_court'] = { recordsFound: 0, recordsIngested: 0 };

  try {
    if (db && options.initializeTable) {
      log('[OnCourts] Initializing table...');
      await initializeOnCourtsTable(db);
    }

    log('[OnCourts] Fetching data...');
    const { records: rawRecords, errors: fetchErrors } = await fetchOnCourtsRecords({ limit: maxRecords });
    result.errors.push(...fetchErrors);
    log('[OnCourts] Found ' + rawRecords.length + ' raw records');

    const parsed = await parseOnCourtsBatch(rawRecords as RawOnCourtsRecord[], { sourceSystem: 'on-courts' });

    for (const record of parsed) {
      result.recordsFound++;
      result.perType['on_court'].recordsFound++;
      if (db) {
        const inserted = await upsertOnCourtsRecord(db, record);
        if (inserted) result.newRecords++;
        result.recordsIngested++;
        result.perType['on_court'].recordsIngested++;
      }
    }
  } catch (err) {
    const msg = 'OnCourts ingestion failed: ' + (err as Error).message;
    result.errors.push(msg);
    log('[OnCourts] ' + msg);
  }

  result.durationMs = Date.now() - startTime;
  log('[OnCourts] Done: ' + result.recordsFound + ' found, ' + result.recordsIngested + ' ingested, ' + result.newRecords + ' new in ' + result.durationMs + 'ms');
  return result;
}
