// SPDX-License-Identifier: AGPL-3.0-only

import { fetchBcInfrastructureRecords } from './fetcher.js';
import { parseBcInfrastructureRecord, parseBcInfrastructureBatch } from './parser.js';
import { BcInfrastructure_DDL, DEFAULT_MAX_RECORDS, BcInfrastructureError } from './constants.js';
import type { BcInfrastructureRecord, BcInfrastructureIngestionOptions, BcInfrastructureIngestionResult, RawBcInfrastructureRecord } from './types.js';

export { fetchBcInfrastructureRecords } from './fetcher.js';
export { parseBcInfrastructureRecord, parseBcInfrastructureBatch } from './parser.js';
export { BcInfrastructure_DDL, DEFAULT_MAX_RECORDS, BcInfrastructureError } from './constants.js';
export type { BcInfrastructureRecord, BcInfrastructureIngestionOptions, BcInfrastructureIngestionResult, RawBcInfrastructureRecord } from './types.js';

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

export async function initializeBcInfrastructureTable(db: D1Database): Promise<void> {
  await db.exec(BcInfrastructure_DDL);
}

async function upsertBcInfrastructureRecord(db: D1Database, record: BcInfrastructureRecord): Promise<boolean> {
  const fields = ['id', 'record_type', 'category', 'subcategory', 'value', 'unit', 'period', 'fiscal_year', 'region', 'status', 'description'];
  const values = [record.id, record.recordType, record.category, record.subcategory, record.value, record.unit, record.period, record.fiscalYear, record.region, record.status, record.description];
  const placeholders = fields.map(() => '?').join(', ');
  const stmt = db.prepare(`INSERT OR IGNORE INTO bc_infrastructure_projects (${fields.join(', ')}) VALUES (${placeholders})`).bind(...values);
  return (await stmt.run()).success;
}

export async function searchBcInfrastructureRecords(db: D1Database, query: string, options: { limit?: number } = {}): Promise<BcInfrastructureRecord[]> {
  let sql = `SELECT * FROM bc_infrastructure_projects WHERE 1=1`;
  const params: unknown[] = [];
  if (query) {
    const likeCols = ['record_type', 'category', 'subcategory', 'region', 'status', 'description'];
    sql += ' AND (' + likeCols.map(c => c + ' LIKE ?').join(' OR ') + ')';
    const q = '%' + query + '%';
    for (let i = 0; i < likeCols.length; i++) params.push(q);
  }
  sql += ' ORDER BY ingested_at DESC LIMIT ?';
  params.push(options.limit ?? 50);
  return (await db.prepare(sql).bind(...params).all<BcInfrastructureRecord>()).results ?? [];
}

export async function ingestBcInfrastructureData(db: D1Database | null, options: BcInfrastructureIngestionOptions = {}): Promise<BcInfrastructureIngestionResult> {
  const startTime = Date.now();
  const result: BcInfrastructureIngestionResult = { recordsFound: 0, recordsIngested: 0, newRecords: 0, errors: [], perType: {}, durationMs: 0 };
  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  result.perType['bc_infrastructure'] = { recordsFound: 0, recordsIngested: 0 };
  try {
    if (db && options.initializeTable) { log('[BcInfrastructure] Initializing...'); await initializeBcInfrastructureTable(db); }
    log('[BcInfrastructure] Fetching...');
    const { records: rawRecords, errors: fetchErrors } = await fetchBcInfrastructureRecords({ limit: maxRecords });
    result.errors.push(...fetchErrors);
    log('[BcInfrastructure] Found ' + rawRecords.length + ' raw records');
    const parsed = await parseBcInfrastructureBatch(rawRecords as RawBcInfrastructureRecord[], { sourceSystem: 'bc-infrastructure' });
    for (const record of parsed) {
      result.recordsFound++;
      result.perType['bc_infrastructure'].recordsFound++;
      if (db) {
        const inserted = await upsertBcInfrastructureRecord(db, record);
        if (inserted) result.newRecords++;
        result.recordsIngested++;
        result.perType['bc_infrastructure'].recordsIngested++;
      }
    }
  } catch (err) {
    const msg = 'BcInfrastructure ingestion failed: ' + (err as Error).message;
    result.errors.push(msg);
    log('[BcInfrastructure] ' + msg);
  }
  result.durationMs = Date.now() - startTime;
  log('[BcInfrastructure] Done: ' + result.recordsFound + ' found, ' + result.recordsIngested + ' ingested, ' + result.newRecords + ' new in ' + result.durationMs + 'ms');
  return result;
}
