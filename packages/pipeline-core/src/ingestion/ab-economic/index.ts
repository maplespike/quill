// SPDX-License-Identifier: AGPL-3.0-only

import { fetchAbEconomicRecords } from './fetcher.js';
import { parseAbEconomicRecord, parseAbEconomicBatch } from './parser.js';
import { AbEconomic_DDL, DEFAULT_MAX_RECORDS, AbEconomicError } from './constants.js';
import type { AbEconomicRecord, AbEconomicIngestionOptions, AbEconomicIngestionResult, RawAbEconomicRecord } from './types.js';

export { fetchAbEconomicRecords } from './fetcher.js';
export { parseAbEconomicRecord, parseAbEconomicBatch } from './parser.js';
export { AbEconomic_DDL, DEFAULT_MAX_RECORDS, AbEconomicError } from './constants.js';
export type { AbEconomicRecord, AbEconomicIngestionOptions, AbEconomicIngestionResult, RawAbEconomicRecord } from './types.js';

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

export async function initializeAbEconomicTable(db: D1Database): Promise<void> {
  await db.exec(AbEconomic_DDL);
}

async function upsertAbEconomicRecord(db: D1Database, record: AbEconomicRecord): Promise<boolean> {
  const fields = ['id', 'record_type', 'category', 'subcategory', 'value', 'unit', 'period', 'fiscal_year', 'region', 'status', 'description'];
  const values = [record.id, record.recordType, record.category, record.subcategory, record.value, record.unit, record.period, record.fiscalYear, record.region, record.status, record.description];
  const placeholders = fields.map(() => '?').join(', ');
  const stmt = db.prepare(`INSERT OR IGNORE INTO ab_economic_indicators (${fields.join(', ')}) VALUES (${placeholders})`).bind(...values);
  return (await stmt.run()).success;
}

export async function searchAbEconomicRecords(db: D1Database, query: string, options: { limit?: number } = {}): Promise<AbEconomicRecord[]> {
  let sql = `SELECT * FROM ab_economic_indicators WHERE 1=1`;
  const params: unknown[] = [];
  if (query) {
    const likeCols = ['record_type', 'category', 'subcategory', 'region', 'status', 'description'];
    sql += ' AND (' + likeCols.map(c => c + ' LIKE ?').join(' OR ') + ')';
    const q = '%' + query + '%';
    for (let i = 0; i < likeCols.length; i++) params.push(q);
  }
  sql += ' ORDER BY ingested_at DESC LIMIT ?';
  params.push(options.limit ?? 50);
  return (await db.prepare(sql).bind(...params).all<AbEconomicRecord>()).results ?? [];
}

export async function ingestAbEconomicData(db: D1Database | null, options: AbEconomicIngestionOptions = {}): Promise<AbEconomicIngestionResult> {
  const startTime = Date.now();
  const result: AbEconomicIngestionResult = { recordsFound: 0, recordsIngested: 0, newRecords: 0, errors: [], perType: {}, durationMs: 0 };
  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  result.perType['ab_economic'] = { recordsFound: 0, recordsIngested: 0 };
  try {
    if (db && options.initializeTable) { log('[AbEconomic] Initializing...'); await initializeAbEconomicTable(db); }
    log('[AbEconomic] Fetching...');
    const { records: rawRecords, errors: fetchErrors } = await fetchAbEconomicRecords({ limit: maxRecords });
    result.errors.push(...fetchErrors);
    log('[AbEconomic] Found ' + rawRecords.length + ' raw records');
    const parsed = await parseAbEconomicBatch(rawRecords as RawAbEconomicRecord[], { sourceSystem: 'ab-economic' });
    for (const record of parsed) {
      result.recordsFound++;
      result.perType['ab_economic'].recordsFound++;
      if (db) {
        const inserted = await upsertAbEconomicRecord(db, record);
        if (inserted) result.newRecords++;
        result.recordsIngested++;
        result.perType['ab_economic'].recordsIngested++;
      }
    }
  } catch (err) {
    const msg = 'AbEconomic ingestion failed: ' + (err as Error).message;
    result.errors.push(msg);
    log('[AbEconomic] ' + msg);
  }
  result.durationMs = Date.now() - startTime;
  log('[AbEconomic] Done: ' + result.recordsFound + ' found, ' + result.recordsIngested + ' ingested, ' + result.newRecords + ' new in ' + result.durationMs + 'ms');
  return result;
}
