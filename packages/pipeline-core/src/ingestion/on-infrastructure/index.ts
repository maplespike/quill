// SPDX-License-Identifier: AGPL-3.0-only

import { fetchOnInfrastructureRecords } from './fetcher.js';
import { parseOnInfrastructureRecord, parseOnInfrastructureBatch } from './parser.js';
import { OnInfrastructure_DDL, DEFAULT_MAX_RECORDS, OnInfrastructureError } from './constants.js';
import type { OnInfrastructureRecord, OnInfrastructureIngestionOptions, OnInfrastructureIngestionResult, RawOnInfrastructureRecord } from './types.js';

export { fetchOnInfrastructureRecords } from './fetcher.js';
export { parseOnInfrastructureRecord, parseOnInfrastructureBatch } from './parser.js';
export { OnInfrastructure_DDL, DEFAULT_MAX_RECORDS, OnInfrastructureError } from './constants.js';
export type { OnInfrastructureRecord, OnInfrastructureIngestionOptions, OnInfrastructureIngestionResult, RawOnInfrastructureRecord } from './types.js';

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

export async function initializeOnInfrastructureTable(db: D1Database): Promise<void> {
  await db.exec(OnInfrastructure_DDL);
}

async function upsertOnInfrastructureRecord(db: D1Database, record: OnInfrastructureRecord): Promise<boolean> {
  const fields = ['id', 'record_type', 'category', 'subcategory', 'value', 'unit', 'period', 'fiscal_year', 'region', 'status', 'description'];
  const values = [record.id, record.recordType, record.category, record.subcategory, record.value, record.unit, record.period, record.fiscalYear, record.region, record.status, record.description];
  const placeholders = fields.map(() => '?').join(', ');
  const stmt = db.prepare(`INSERT OR IGNORE INTO on_infrastructure_projects (${fields.join(', ')}) VALUES (${placeholders})`).bind(...values);
  return (await stmt.run()).success;
}

export async function searchOnInfrastructureRecords(db: D1Database, query: string, options: { limit?: number } = {}): Promise<OnInfrastructureRecord[]> {
  let sql = `SELECT * FROM on_infrastructure_projects WHERE 1=1`;
  const params: unknown[] = [];
  if (query) {
    const likeCols = ['record_type', 'category', 'subcategory', 'region', 'status', 'description'];
    sql += ' AND (' + likeCols.map(c => c + ' LIKE ?').join(' OR ') + ')';
    const q = '%' + query + '%';
    for (let i = 0; i < likeCols.length; i++) params.push(q);
  }
  sql += ' ORDER BY ingested_at DESC LIMIT ?';
  params.push(options.limit ?? 50);
  return (await db.prepare(sql).bind(...params).all<OnInfrastructureRecord>()).results ?? [];
}

export async function ingestOnInfrastructureData(db: D1Database | null, options: OnInfrastructureIngestionOptions = {}): Promise<OnInfrastructureIngestionResult> {
  const startTime = Date.now();
  const result: OnInfrastructureIngestionResult = { recordsFound: 0, recordsIngested: 0, newRecords: 0, errors: [], perType: {}, durationMs: 0 };
  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  result.perType['on_infrastructure'] = { recordsFound: 0, recordsIngested: 0 };
  try {
    if (db && options.initializeTable) { log('[OnInfrastructure] Initializing...'); await initializeOnInfrastructureTable(db); }
    log('[OnInfrastructure] Fetching...');
    const { records: rawRecords, errors: fetchErrors } = await fetchOnInfrastructureRecords({ limit: maxRecords });
    result.errors.push(...fetchErrors);
    log('[OnInfrastructure] Found ' + rawRecords.length + ' raw records');
    const parsed = await parseOnInfrastructureBatch(rawRecords as RawOnInfrastructureRecord[], { sourceSystem: 'on-infrastructure' });
    for (const record of parsed) {
      result.recordsFound++;
      result.perType['on_infrastructure'].recordsFound++;
      if (db) {
        const inserted = await upsertOnInfrastructureRecord(db, record);
        if (inserted) result.newRecords++;
        result.recordsIngested++;
        result.perType['on_infrastructure'].recordsIngested++;
      }
    }
  } catch (err) {
    const msg = 'OnInfrastructure ingestion failed: ' + (err as Error).message;
    result.errors.push(msg);
    log('[OnInfrastructure] ' + msg);
  }
  result.durationMs = Date.now() - startTime;
  log('[OnInfrastructure] Done: ' + result.recordsFound + ' found, ' + result.recordsIngested + ' ingested, ' + result.newRecords + ' new in ' + result.durationMs + 'ms');
  return result;
}
