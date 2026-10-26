// SPDX-License-Identifier: AGPL-3.0-only

import { fetchBcEducationRecords } from './fetcher.js';
import { parseBcEducationRecord, parseBcEducationBatch } from './parser.js';
import { BCEDUCATION_DDL, DEFAULT_MAX_RECORDS, BcEducationError } from './constants.js';
import type { BcEducationRecord, BcEducationIngestionOptions, BcEducationIngestionResult, RawBcEducationRecord } from './types.js';

export { fetchBcEducationRecords } from './fetcher.js';
export { parseBcEducationRecord, parseBcEducationBatch } from './parser.js';
export { BCEDUCATION_DDL, DEFAULT_MAX_RECORDS, BcEducationError } from './constants.js';
export type { BcEducationRecord, BcEducationIngestionOptions, BcEducationIngestionResult, RawBcEducationRecord } from './types.js';

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

export async function initializeBcEducationTable(db: D1Database): Promise<void> {
  await db.exec(BCEDUCATION_DDL);
}

async function upsertBcEducationRecord(db: D1Database, record: BcEducationRecord): Promise<boolean> {
  const fields = ['id', 'record_type', 'category', 'school_district', 'school_name', 'academic_year', 'grade', 'subject', 'result', 'student_count'];
  const values = [record.id, record.recordType, record.category, record.schoolDistrict, record.schoolName, record.academicYear, record.grade, record.subject, record.result, record.studentCount];
  const placeholders = fields.map(() => '?').join(', ');
  const stmt = db.prepare('INSERT OR IGNORE INTO bc_education_records (' + fields.join(', ') + ') VALUES (' + placeholders + ')').bind(...values);
  const result = await stmt.run();
  return result.success;
}

export async function searchBcEducationRecords(db: D1Database, query: string, options: { limit?: number } = {}): Promise<BcEducationRecord[]> {
  let sql = 'SELECT * FROM bc_education_records WHERE 1=1';
  const params: unknown[] = [];

if (query) {
    const likeCols = ['record_type', 'category', 'school_district', 'school_name', 'academic_year', 'grade', 'subject', 'result'];
    sql += ' AND (' + likeCols.map(c => c + ' LIKE ?').join(' OR ') + ')';
    const q = '%' + query + '%';
    for (let i = 0; i < 8; i++) params.push(q);
  }

  sql += ' ORDER BY ingested_at DESC LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<BcEducationRecord>();
  return result.results ?? [];
}

export async function ingestBcEducationData(db: D1Database | null, options: BcEducationIngestionOptions = {}): Promise<BcEducationIngestionResult> {
  const startTime = Date.now();
  const result: BcEducationIngestionResult = { recordsFound: 0, recordsIngested: 0, newRecords: 0, errors: [], perType: {}, durationMs: 0 };
  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  result.perType['bc_education'] = { recordsFound: 0, recordsIngested: 0 };

  try {
    if (db && options.initializeTable) {
      log('[BcEducation] Initializing table...');
      await initializeBcEducationTable(db);
    }

    log('[BcEducation] Fetching data...');
    const { records: rawRecords, errors: fetchErrors } = await fetchBcEducationRecords({ limit: maxRecords });
    result.errors.push(...fetchErrors);
    log('[BcEducation] Found ' + rawRecords.length + ' raw records');

    const parsed = await parseBcEducationBatch(rawRecords as RawBcEducationRecord[], { sourceSystem: 'bc-education' });

    for (const record of parsed) {
      result.recordsFound++;
      result.perType['bc_education'].recordsFound++;
      if (db) {
        const inserted = await upsertBcEducationRecord(db, record);
        if (inserted) result.newRecords++;
        result.recordsIngested++;
        result.perType['bc_education'].recordsIngested++;
      }
    }
  } catch (err) {
    const msg = 'BcEducation ingestion failed: ' + (err as Error).message;
    result.errors.push(msg);
    log('[BcEducation] ' + msg);
  }

  result.durationMs = Date.now() - startTime;
  log('[BcEducation] Done: ' + result.recordsFound + ' found, ' + result.recordsIngested + ' ingested, ' + result.newRecords + ' new in ' + result.durationMs + 'ms');
  return result;
}
