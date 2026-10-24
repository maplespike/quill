// SPDX-License-Identifier: AGPL-3.0-only

import { fetchQcCourtsRecords } from './fetcher.js';
import { parseQcCourtsRecord, parseQcCourtsBatch } from './parser.js';
import { QCCOURTS_DDL, DEFAULT_MAX_RECORDS, QcCourtsError } from './constants.js';
import type { QcCourtsRecord, QcCourtsIngestionOptions, QcCourtsIngestionResult, RawQcCourtsRecord } from './types.js';

export { fetchQcCourtsRecords } from './fetcher.js';
export { parseQcCourtsRecord, parseQcCourtsBatch } from './parser.js';
export { QCCOURTS_DDL, DEFAULT_MAX_RECORDS, QcCourtsError } from './constants.js';
export type { QcCourtsRecord, QcCourtsIngestionOptions, QcCourtsIngestionResult, RawQcCourtsRecord } from './types.js';

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

export async function initializeQcCourtsTable(db: D1Database): Promise<void> {
  await db.exec(QCCOURTS_DDL);
}

async function upsertQcCourtsRecord(db: D1Database, record: QcCourtsRecord): Promise<boolean> {
  const fields = ['id', 'record_type', 'court_type', 'file_number', 'filing_date', 'case_type', 'district', 'status'];
  const values = [record.id, record.recordType, record.courtType, record.fileNumber, record.filingDate, record.caseType, record.district, record.status];
  const placeholders = fields.map(() => '?').join(', ');
  const stmt = db.prepare('INSERT OR IGNORE INTO qc_court_records (' + fields.join(', ') + ') VALUES (' + placeholders + ')').bind(...values);
  const result = await stmt.run();
  return result.success;
}

export async function searchQcCourtsRecords(db: D1Database, query: string, options: { limit?: number } = {}): Promise<QcCourtsRecord[]> {
  let sql = 'SELECT * FROM qc_court_records WHERE 1=1';
  const params: unknown[] = [];

if (query) {
    const likeCols = ['record_type', 'court_type', 'file_number', 'filing_date', 'case_type', 'district', 'status'];
    sql += ' AND (' + likeCols.map(c => c + ' LIKE ?').join(' OR ') + ')';
    const q = '%' + query + '%';
    for (let i = 0; i < 7; i++) params.push(q);
  }

  sql += ' ORDER BY ingested_at DESC LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<QcCourtsRecord>();
  return result.results ?? [];
}

export async function ingestQcCourtsData(db: D1Database | null, options: QcCourtsIngestionOptions = {}): Promise<QcCourtsIngestionResult> {
  const startTime = Date.now();
  const result: QcCourtsIngestionResult = { recordsFound: 0, recordsIngested: 0, newRecords: 0, errors: [], perType: {}, durationMs: 0 };
  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  result.perType['qc_court'] = { recordsFound: 0, recordsIngested: 0 };

  try {
    if (db && options.initializeTable) {
      log('[QcCourts] Initializing table...');
      await initializeQcCourtsTable(db);
    }

    log('[QcCourts] Fetching data...');
    const { records: rawRecords, errors: fetchErrors } = await fetchQcCourtsRecords({ limit: maxRecords });
    result.errors.push(...fetchErrors);
    log('[QcCourts] Found ' + rawRecords.length + ' raw records');

    const parsed = await parseQcCourtsBatch(rawRecords as RawQcCourtsRecord[], { sourceSystem: 'qc-courts' });

    for (const record of parsed) {
      result.recordsFound++;
      result.perType['qc_court'].recordsFound++;
      if (db) {
        const inserted = await upsertQcCourtsRecord(db, record);
        if (inserted) result.newRecords++;
        result.recordsIngested++;
        result.perType['qc_court'].recordsIngested++;
      }
    }
  } catch (err) {
    const msg = 'QcCourts ingestion failed: ' + (err as Error).message;
    result.errors.push(msg);
    log('[QcCourts] ' + msg);
  }

  result.durationMs = Date.now() - startTime;
  log('[QcCourts] Done: ' + result.recordsFound + ' found, ' + result.recordsIngested + ' ingested, ' + result.newRecords + ' new in ' + result.durationMs + 'ms');
  return result;
}
