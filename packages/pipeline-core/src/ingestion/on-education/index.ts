// SPDX-License-Identifier: AGPL-3.0-only

import { fetchOnEducationRecords } from './fetcher.js';
import { parseOnEducationRecord, parseOnEducationBatch } from './parser.js';
import { ONEDUCATION_DDL, DEFAULT_MAX_RECORDS, OnEducationError } from './constants.js';
import type { OnEducationRecord, OnEducationIngestionOptions, OnEducationIngestionResult, RawOnEducationRecord } from './types.js';

export { fetchOnEducationRecords } from './fetcher.js';
export { parseOnEducationRecord, parseOnEducationBatch } from './parser.js';
export { ONEDUCATION_DDL, DEFAULT_MAX_RECORDS, OnEducationError } from './constants.js';
export type { OnEducationRecord, OnEducationIngestionOptions, OnEducationIngestionResult, RawOnEducationRecord } from './types.js';

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

export async function initializeOnEducationTable(db: D1Database): Promise<void> {
  await db.exec(ONEDUCATION_DDL);
}

async function upsertOnEducationRecord(db: D1Database, record: OnEducationRecord): Promise<boolean> {
  const fields = ['id', 'record_type', 'category', 'school_board', 'school_name', 'academic_year', 'grade', 'subject', 'result', 'student_count', 'funding_amount'];
  const values = [record.id, record.recordType, record.category, record.schoolBoard, record.schoolName, record.academicYear, record.grade, record.subject, record.result, record.studentCount, record.fundingAmount];
  const placeholders = fields.map(() => '?').join(', ');
  const stmt = db.prepare('INSERT OR IGNORE INTO on_education_records (' + fields.join(', ') + ') VALUES (' + placeholders + ')').bind(...values);
  const result = await stmt.run();
  return result.success;
}

export async function searchOnEducationRecords(db: D1Database, query: string, options: { limit?: number } = {}): Promise<OnEducationRecord[]> {
  let sql = 'SELECT * FROM on_education_records WHERE 1=1';
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
  const result = await stmt.all<OnEducationRecord>();
  return result.results ?? [];
}

export async function ingestOnEducationData(db: D1Database | null, options: OnEducationIngestionOptions = {}): Promise<OnEducationIngestionResult> {
  const startTime = Date.now();
  const result: OnEducationIngestionResult = { recordsFound: 0, recordsIngested: 0, newRecords: 0, errors: [], perType: {}, durationMs: 0 };
  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  result.perType['on_education'] = { recordsFound: 0, recordsIngested: 0 };

  try {
    if (db && options.initializeTable) {
      log('[OnEducation] Initializing table...');
      await initializeOnEducationTable(db);
    }

    log('[OnEducation] Fetching data...');
    const { records: rawRecords, errors: fetchErrors } = await fetchOnEducationRecords({ limit: maxRecords });
    result.errors.push(...fetchErrors);
    log('[OnEducation] Found ' + rawRecords.length + ' raw records');

    const parsed = await parseOnEducationBatch(rawRecords as RawOnEducationRecord[], { sourceSystem: 'on-education' });

    for (const record of parsed) {
      result.recordsFound++;
      result.perType['on_education'].recordsFound++;
      if (db) {
        const inserted = await upsertOnEducationRecord(db, record);
        if (inserted) result.newRecords++;
        result.recordsIngested++;
        result.perType['on_education'].recordsIngested++;
      }
    }
  } catch (err) {
    const msg = 'OnEducation ingestion failed: ' + (err as Error).message;
    result.errors.push(msg);
    log('[OnEducation] ' + msg);
  }

  result.durationMs = Date.now() - startTime;
  log('[OnEducation] Done: ' + result.recordsFound + ' found, ' + result.recordsIngested + ' ingested, ' + result.newRecords + ' new in ' + result.durationMs + 'ms');
  return result;
}
