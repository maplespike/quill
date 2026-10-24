// SPDX-License-Identifier: AGPL-3.0-only

import { fetchQcEducationRecords } from './fetcher.js';
import { parseQcEducationRecord, parseQcEducationBatch } from './parser.js';
import { QCEDUCATION_DDL, DEFAULT_MAX_RECORDS, QcEducationError } from './constants.js';
import type { QcEducationRecord, QcEducationIngestionOptions, QcEducationIngestionResult, RawQcEducationRecord } from './types.js';

export { fetchQcEducationRecords } from './fetcher.js';
export { parseQcEducationRecord, parseQcEducationBatch } from './parser.js';
export { QCEDUCATION_DDL, DEFAULT_MAX_RECORDS, QcEducationError } from './constants.js';
export type { QcEducationRecord, QcEducationIngestionOptions, QcEducationIngestionResult, RawQcEducationRecord } from './types.js';

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

export async function initializeQcEducationTable(db: D1Database): Promise<void> {
  await db.exec(QCEDUCATION_DDL);
}

async function upsertQcEducationRecord(db: D1Database, record: QcEducationRecord): Promise<boolean> {
  const fields = ['id', 'record_type', 'category', 'school_board', 'school_name', 'academic_year', 'grade', 'subject', 'result', 'student_count', 'funding_amount'];
  const values = [record.id, record.recordType, record.category, record.schoolBoard, record.schoolName, record.academicYear, record.grade, record.subject, record.result, record.studentCount, record.fundingAmount];
  const placeholders = fields.map(() => '?').join(', ');
  const stmt = db.prepare('INSERT OR IGNORE INTO qc_education_records (' + fields.join(', ') + ') VALUES (' + placeholders + ')').bind(...values);
  const result = await stmt.run();
  return result.success;
}

export async function searchQcEducationRecords(db: D1Database, query: string, options: { limit?: number } = {}): Promise<QcEducationRecord[]> {
  let sql = 'SELECT * FROM qc_education_records WHERE 1=1';
  const params: unknown[] = [];

if (query) {
    const likeCols = ['record_type', 'category', 'school_board', 'school_name', 'academic_year', 'grade', 'subject', 'result'];
    sql += ' AND (' + likeCols.map(c => c + ' LIKE ?').join(' OR ') + ')';
    const q = '%' + query + '%';
    for (let i = 0; i < 8; i++) params.push(q);
  }

  sql += ' ORDER BY ingested_at DESC LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<QcEducationRecord>();
  return result.results ?? [];
}

export async function ingestQcEducationData(db: D1Database | null, options: QcEducationIngestionOptions = {}): Promise<QcEducationIngestionResult> {
  const startTime = Date.now();
  const result: QcEducationIngestionResult = { recordsFound: 0, recordsIngested: 0, newRecords: 0, errors: [], perType: {}, durationMs: 0 };
  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  result.perType['qc_education'] = { recordsFound: 0, recordsIngested: 0 };

  try {
    if (db && options.initializeTable) {
      log('[QcEducation] Initializing table...');
      await initializeQcEducationTable(db);
    }

    log('[QcEducation] Fetching data...');
    const { records: rawRecords, errors: fetchErrors } = await fetchQcEducationRecords({ limit: maxRecords });
    result.errors.push(...fetchErrors);
    log('[QcEducation] Found ' + rawRecords.length + ' raw records');

    const parsed = await parseQcEducationBatch(rawRecords as RawQcEducationRecord[], { sourceSystem: 'qc-education' });

    for (const record of parsed) {
      result.recordsFound++;
      result.perType['qc_education'].recordsFound++;
      if (db) {
        const inserted = await upsertQcEducationRecord(db, record);
        if (inserted) result.newRecords++;
        result.recordsIngested++;
        result.perType['qc_education'].recordsIngested++;
      }
    }
  } catch (err) {
    const msg = 'QcEducation ingestion failed: ' + (err as Error).message;
    result.errors.push(msg);
    log('[QcEducation] ' + msg);
  }

  result.durationMs = Date.now() - startTime;
  log('[QcEducation] Done: ' + result.recordsFound + ' found, ' + result.recordsIngested + ' ingested, ' + result.newRecords + ' new in ' + result.durationMs + 'ms');
  return result;
}
