// SPDX-License-Identifier: AGPL-3.0-only

import { fetchQcInfrastructureRecords } from './fetcher.js';
import { parseQcInfrastructureRecord, parseQcInfrastructureBatch } from './parser.js';
import { QcInfrastructure_DDL, DEFAULT_MAX_RECORDS, QcInfrastructureError } from './constants.js';
import type { QcInfrastructureRecord, QcInfrastructureIngestionOptions, QcInfrastructureIngestionResult, RawQcInfrastructureRecord } from './types.js';

export { fetchQcInfrastructureRecords } from './fetcher.js';
export { parseQcInfrastructureRecord, parseQcInfrastructureBatch } from './parser.js';
export { QcInfrastructure_DDL, DEFAULT_MAX_RECORDS, QcInfrastructureError } from './constants.js';
export type { QcInfrastructureRecord, QcInfrastructureIngestionOptions, QcInfrastructureIngestionResult, RawQcInfrastructureRecord } from './types.js';

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

export async function initializeQcInfrastructureTable(db: D1Database): Promise<void> {
  await db.exec(QcInfrastructure_DDL);
}

async function upsertQcInfrastructureRecord(db: D1Database, record: QcInfrastructureRecord): Promise<boolean> {
  const fields = ['id', 'record_type', 'category', 'subcategory', 'value', 'unit', 'period', 'fiscal_year', 'region', 'status', 'description'];
  const values = [record.id, record.recordType, record.category, record.subcategory, record.value, record.unit, record.period, record.fiscalYear, record.region, record.status, record.description];
  const placeholders = fields.map(() => '?').join(', ');
  const stmt = db.prepare(`INSERT OR IGNORE INTO qc_infrastructure_projects (${fields.join(', ')}) VALUES (${placeholders})`).bind(...values);
  return (await stmt.run()).success;
}

export async function searchQcInfrastructureRecords(db: D1Database, query: string, options: { limit?: number } = {}): Promise<QcInfrastructureRecord[]> {
  let sql = `SELECT * FROM qc_infrastructure_projects WHERE 1=1`;
  const params: unknown[] = [];
  if (query) {
    const likeCols = ['record_type', 'category', 'subcategory', 'region', 'status', 'description'];
    sql += ' AND (' + likeCols.map(c => c + ' LIKE ?').join(' OR ') + ')';
    const q = '%' + query + '%';
    for (let i = 0; i < likeCols.length; i++) params.push(q);
  }
  sql += ' ORDER BY ingested_at DESC LIMIT ?';
  params.push(options.limit ?? 50);
  return (await db.prepare(sql).bind(...params).all<QcInfrastructureRecord>()).results ?? [];
}

export async function ingestQcInfrastructureData(db: D1Database | null, options: QcInfrastructureIngestionOptions = {}): Promise<QcInfrastructureIngestionResult> {
  const startTime = Date.now();
  const result: QcInfrastructureIngestionResult = { recordsFound: 0, recordsIngested: 0, newRecords: 0, errors: [], perType: {}, durationMs: 0 };
  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  result.perType['qc_infrastructure'] = { recordsFound: 0, recordsIngested: 0 };
  try {
    if (db && options.initializeTable) { log('[QcInfrastructure] Initializing...'); await initializeQcInfrastructureTable(db); }
    log('[QcInfrastructure] Fetching...');
    const { records: rawRecords, errors: fetchErrors } = await fetchQcInfrastructureRecords({ limit: maxRecords });
    result.errors.push(...fetchErrors);
    log('[QcInfrastructure] Found ' + rawRecords.length + ' raw records');
    const parsed = await parseQcInfrastructureBatch(rawRecords as RawQcInfrastructureRecord[], { sourceSystem: 'qc-infrastructure' });
    for (const record of parsed) {
      result.recordsFound++;
      result.perType['qc_infrastructure'].recordsFound++;
      if (db) {
        const inserted = await upsertQcInfrastructureRecord(db, record);
        if (inserted) result.newRecords++;
        result.recordsIngested++;
        result.perType['qc_infrastructure'].recordsIngested++;
      }
    }
  } catch (err) {
    const msg = 'QcInfrastructure ingestion failed: ' + (err as Error).message;
    result.errors.push(msg);
    log('[QcInfrastructure] ' + msg);
  }
  result.durationMs = Date.now() - startTime;
  log('[QcInfrastructure] Done: ' + result.recordsFound + ' found, ' + result.recordsIngested + ' ingested, ' + result.newRecords + ' new in ' + result.durationMs + 'ms');
  return result;
}
