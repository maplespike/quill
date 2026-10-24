// SPDX-License-Identifier: AGPL-3.0-only

import { fetchBcEconomicRecords } from './fetcher.js';
import { parseBcEconomicRecord, parseBcEconomicBatch } from './parser.js';
import { BcEconomic_DDL, DEFAULT_MAX_RECORDS, BcEconomicError } from './constants.js';
import type { BcEconomicRecord, BcEconomicIngestionOptions, BcEconomicIngestionResult, RawBcEconomicRecord } from './types.js';

export { fetchBcEconomicRecords } from './fetcher.js';
export { parseBcEconomicRecord, parseBcEconomicBatch } from './parser.js';
export { BcEconomic_DDL, DEFAULT_MAX_RECORDS, BcEconomicError } from './constants.js';
export type { BcEconomicRecord, BcEconomicIngestionOptions, BcEconomicIngestionResult, RawBcEconomicRecord } from './types.js';

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

export async function initializeBcEconomicTable(db: D1Database): Promise<void> {
  await db.exec(BcEconomic_DDL);
}

async function upsertBcEconomicRecord(db: D1Database, record: BcEconomicRecord): Promise<boolean> {
  const fields = ['id', 'record_type', 'category', 'subcategory', 'value', 'unit', 'period', 'fiscal_year', 'region', 'status', 'description'];
  const values = [record.id, record.recordType, record.category, record.subcategory, record.value, record.unit, record.period, record.fiscalYear, record.region, record.status, record.description];
  const placeholders = fields.map(() => '?').join(', ');
  const stmt = db.prepare(`INSERT OR IGNORE INTO bc_economic_indicators (${fields.join(', ')}) VALUES (${placeholders})`).bind(...values);
  return (await stmt.run()).success;
}

export async function searchBcEconomicRecords(db: D1Database, query: string, options: { limit?: number } = {}): Promise<BcEconomicRecord[]> {
  let sql = `SELECT * FROM bc_economic_indicators WHERE 1=1`;
  const params: unknown[] = [];
  if (query) {
    const likeCols = ['record_type', 'category', 'subcategory', 'region', 'status', 'description'];
    sql += ' AND (' + likeCols.map(c => c + ' LIKE ?').join(' OR ') + ')';
    const q = '%' + query + '%';
    for (let i = 0; i < likeCols.length; i++) params.push(q);
  }
  sql += ' ORDER BY ingested_at DESC LIMIT ?';
  params.push(options.limit ?? 50);
  return (await db.prepare(sql).bind(...params).all<BcEconomicRecord>()).results ?? [];
}

export async function ingestBcEconomicData(db: D1Database | null, options: BcEconomicIngestionOptions = {}): Promise<BcEconomicIngestionResult> {
  const startTime = Date.now();
  const result: BcEconomicIngestionResult = { recordsFound: 0, recordsIngested: 0, newRecords: 0, errors: [], perType: {}, durationMs: 0 };
  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  result.perType['bc_economic'] = { recordsFound: 0, recordsIngested: 0 };
  try {
    if (db && options.initializeTable) { log('[BcEconomic] Initializing...'); await initializeBcEconomicTable(db); }
    log('[BcEconomic] Fetching...');
    const { records: rawRecords, errors: fetchErrors } = await fetchBcEconomicRecords({ limit: maxRecords });
    result.errors.push(...fetchErrors);
    log('[BcEconomic] Found ' + rawRecords.length + ' raw records');
    const parsed = await parseBcEconomicBatch(rawRecords as RawBcEconomicRecord[], { sourceSystem: 'bc-economic' });
    for (const record of parsed) {
      result.recordsFound++;
      result.perType['bc_economic'].recordsFound++;
      if (db) {
        const inserted = await upsertBcEconomicRecord(db, record);
        if (inserted) result.newRecords++;
        result.recordsIngested++;
        result.perType['bc_economic'].recordsIngested++;
      }
    }
  } catch (err) {
    const msg = 'BcEconomic ingestion failed: ' + (err as Error).message;
    result.errors.push(msg);
    log('[BcEconomic] ' + msg);
  }
  result.durationMs = Date.now() - startTime;
  log('[BcEconomic] Done: ' + result.recordsFound + ' found, ' + result.recordsIngested + ' ingested, ' + result.newRecords + ' new in ' + result.durationMs + 'ms');
  return result;
}
