// SPDX-License-Identifier: AGPL-3.0-only

import { fetchAbInfrastructureRecords } from './fetcher.js';
import { parseAbInfrastructureRecord, parseAbInfrastructureBatch } from './parser.js';
import { AbInfrastructure_DDL, DEFAULT_MAX_RECORDS, AbInfrastructureError } from './constants.js';
import type { AbInfrastructureRecord, AbInfrastructureIngestionOptions, AbInfrastructureIngestionResult, RawAbInfrastructureRecord } from './types.js';

export { fetchAbInfrastructureRecords } from './fetcher.js';
export { parseAbInfrastructureRecord, parseAbInfrastructureBatch } from './parser.js';
export { AbInfrastructure_DDL, DEFAULT_MAX_RECORDS, AbInfrastructureError } from './constants.js';
export type { AbInfrastructureRecord, AbInfrastructureIngestionOptions, AbInfrastructureIngestionResult, RawAbInfrastructureRecord } from './types.js';

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

export async function initializeAbInfrastructureTable(db: D1Database): Promise<void> {
  await db.exec(AbInfrastructure_DDL);
}

async function upsertAbInfrastructureRecord(db: D1Database, record: AbInfrastructureRecord): Promise<boolean> {
  const fields = ['id', 'record_type', 'category', 'subcategory', 'value', 'unit', 'period', 'fiscal_year', 'region', 'status', 'description'];
  const values = [record.id, record.recordType, record.category, record.subcategory, record.value, record.unit, record.period, record.fiscalYear, record.region, record.status, record.description];
  const placeholders = fields.map(() => '?').join(', ');
  const stmt = db.prepare(`INSERT OR IGNORE INTO ab_infrastructure_projects (${fields.join(', ')}) VALUES (${placeholders})`).bind(...values);
  return (await stmt.run()).success;
}

export async function searchAbInfrastructureRecords(db: D1Database, query: string, options: { limit?: number } = {}): Promise<AbInfrastructureRecord[]> {
  let sql = `SELECT * FROM ab_infrastructure_projects WHERE 1=1`;
  const params: unknown[] = [];
  if (query) {
    const likeCols = ['record_type', 'category', 'subcategory', 'region', 'status', 'description'];
    sql += ' AND (' + likeCols.map(c => c + ' LIKE ?').join(' OR ') + ')';
    const q = '%' + query + '%';
    for (let i = 0; i < likeCols.length; i++) params.push(q);
  }
  sql += ' ORDER BY ingested_at DESC LIMIT ?';
  params.push(options.limit ?? 50);
  return (await db.prepare(sql).bind(...params).all<AbInfrastructureRecord>()).results ?? [];
}

export async function ingestAbInfrastructureData(db: D1Database | null, options: AbInfrastructureIngestionOptions = {}): Promise<AbInfrastructureIngestionResult> {
  const startTime = Date.now();
  const result: AbInfrastructureIngestionResult = { recordsFound: 0, recordsIngested: 0, newRecords: 0, errors: [], perType: {}, durationMs: 0 };
  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  result.perType['ab_infrastructure'] = { recordsFound: 0, recordsIngested: 0 };
  try {
    if (db && options.initializeTable) { log('[AbInfrastructure] Initializing...'); await initializeAbInfrastructureTable(db); }
    log('[AbInfrastructure] Fetching...');
    const { records: rawRecords, errors: fetchErrors } = await fetchAbInfrastructureRecords({ limit: maxRecords });
    result.errors.push(...fetchErrors);
    log('[AbInfrastructure] Found ' + rawRecords.length + ' raw records');
    const parsed = await parseAbInfrastructureBatch(rawRecords as RawAbInfrastructureRecord[], { sourceSystem: 'ab-infrastructure' });
    for (const record of parsed) {
      result.recordsFound++;
      result.perType['ab_infrastructure'].recordsFound++;
      if (db) {
        const inserted = await upsertAbInfrastructureRecord(db, record);
        if (inserted) result.newRecords++;
        result.recordsIngested++;
        result.perType['ab_infrastructure'].recordsIngested++;
      }
    }
  } catch (err) {
    const msg = 'AbInfrastructure ingestion failed: ' + (err as Error).message;
    result.errors.push(msg);
    log('[AbInfrastructure] ' + msg);
  }
  result.durationMs = Date.now() - startTime;
  log('[AbInfrastructure] Done: ' + result.recordsFound + ' found, ' + result.recordsIngested + ' ingested, ' + result.newRecords + ' new in ' + result.durationMs + 'ms');
  return result;
}
