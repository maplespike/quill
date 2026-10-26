// SPDX-License-Identifier: AGPL-3.0-only

import { fetchAbEducationRecords } from './fetcher.js';
import { parseAbEducationRecord, parseAbEducationBatch } from './parser.js';
import { ABEDUCATION_DDL, DEFAULT_MAX_RECORDS, AbEducationError } from './constants.js';
import type { AbEducationRecord, AbEducationIngestionOptions, AbEducationIngestionResult, RawAbEducationRecord } from './types.js';

export { fetchAbEducationRecords } from './fetcher.js';
export { parseAbEducationRecord, parseAbEducationBatch } from './parser.js';
export { ABEDUCATION_DDL, DEFAULT_MAX_RECORDS, AbEducationError } from './constants.js';
export type { AbEducationRecord, AbEducationIngestionOptions, AbEducationIngestionResult, RawAbEducationRecord } from './types.js';

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

export async function initializeAbEducationTable(db: D1Database): Promise<void> {
  await db.exec(ABEDUCATION_DDL);
}

async function upsertAbEducationRecord(db: D1Database, record: AbEducationRecord): Promise<boolean> {
  const fields = ['id', 'record_type', 'category', 'school_authority', 'school_name', 'academic_year', 'grade', 'subject', 'result', 'student_count', 'funding_amount'];
  const values = [record.id, record.recordType, record.category, record.schoolAuthority, record.schoolName, record.academicYear, record.grade, record.subject, record.result, record.studentCount, record.fundingAmount];
  const placeholders = fields.map(() => '?').join(', ');
  const stmt = db.prepare('INSERT OR IGNORE INTO ab_education_records (' + fields.join(', ') + ') VALUES (' + placeholders + ')').bind(...values);
  const result = await stmt.run();
  return result.success;
}

export async function searchAbEducationRecords(db: D1Database, query: string, options: { limit?: number } = {}): Promise<AbEducationRecord[]> {
  let sql = 'SELECT * FROM ab_education_records WHERE 1=1';
  const params: unknown[] = [];

if (query) {
    const likeCols = ['record_type', 'category', 'school_authority', 'school_name', 'academic_year', 'grade', 'subject', 'result'];
    sql += ' AND (' + likeCols.map(c => c + ' LIKE ?').join(' OR ') + ')';
    const q = '%' + query + '%';
    for (let i = 0; i < 8; i++) params.push(q);
  }

  sql += ' ORDER BY ingested_at DESC LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<AbEducationRecord>();
  return result.results ?? [];
}

export async function ingestAbEducationData(db: D1Database | null, options: AbEducationIngestionOptions = {}): Promise<AbEducationIngestionResult> {
  const startTime = Date.now();
  const result: AbEducationIngestionResult = { recordsFound: 0, recordsIngested: 0, newRecords: 0, errors: [], perType: {}, durationMs: 0 };
  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  result.perType['ab_education'] = { recordsFound: 0, recordsIngested: 0 };

  try {
    if (db && options.initializeTable) {
      log('[AbEducation] Initializing table...');
      await initializeAbEducationTable(db);
    }

    log('[AbEducation] Fetching data...');
    const { records: rawRecords, errors: fetchErrors } = await fetchAbEducationRecords({ limit: maxRecords });
    result.errors.push(...fetchErrors);
    log('[AbEducation] Found ' + rawRecords.length + ' raw records');

    const parsed = await parseAbEducationBatch(rawRecords as RawAbEducationRecord[], { sourceSystem: 'ab-education' });

    for (const record of parsed) {
      result.recordsFound++;
      result.perType['ab_education'].recordsFound++;
      if (db) {
        const inserted = await upsertAbEducationRecord(db, record);
        if (inserted) result.newRecords++;
        result.recordsIngested++;
        result.perType['ab_education'].recordsIngested++;
      }
    }
  } catch (err) {
    const msg = 'AbEducation ingestion failed: ' + (err as Error).message;
    result.errors.push(msg);
    log('[AbEducation] ' + msg);
  }

  result.durationMs = Date.now() - startTime;
  log('[AbEducation] Done: ' + result.recordsFound + ' found, ' + result.recordsIngested + ' ingested, ' + result.newRecords + ' new in ' + result.durationMs + 'ms');
  return result;
}
