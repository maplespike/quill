// SPDX-License-Identifier: AGPL-3.0-only

import { fetchOnEconomicRecords } from './fetcher.js';
import { parseOnEconomicRecord, parseOnEconomicBatch } from './parser.js';
import { OnEconomic_DDL, DEFAULT_MAX_RECORDS, OnEconomicError } from './constants.js';
import type { OnEconomicRecord, OnEconomicIngestionOptions, OnEconomicIngestionResult, RawOnEconomicRecord } from './types.js';

export { fetchOnEconomicRecords } from './fetcher.js';
export { parseOnEconomicRecord, parseOnEconomicBatch } from './parser.js';
export { OnEconomic_DDL, DEFAULT_MAX_RECORDS, OnEconomicError } from './constants.js';
export type { OnEconomicRecord, OnEconomicIngestionOptions, OnEconomicIngestionResult, RawOnEconomicRecord } from './types.js';

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

export async function initializeOnEconomicTable(db: D1Database): Promise<void> {
  await db.exec(OnEconomic_DDL);
}

async function upsertOnEconomicRecord(db: D1Database, record: OnEconomicRecord): Promise<boolean> {
  const fields = ['id', 'record_type', 'category', 'subcategory', 'value', 'unit', 'period', 'fiscal_year', 'region', 'status', 'description'];
  const values = [record.id, record.recordType, record.category, record.subcategory, record.value, record.unit, record.period, record.fiscalYear, record.region, record.status, record.description];
  const placeholders = fields.map(() => '?').join(', ');
  const stmt = db.prepare(`INSERT OR IGNORE INTO on_economic_indicators (${fields.join(', ')}) VALUES (${placeholders})`).bind(...values);
  return (await stmt.run()).success;
}

export async function searchOnEconomicRecords(db: D1Database, query: string, options: { limit?: number } = {}): Promise<OnEconomicRecord[]> {
  let sql = `SELECT * FROM on_economic_indicators WHERE 1=1`;
  const params: unknown[] = [];
  if (query) {
    const likeCols = ['record_type', 'category', 'subcategory', 'region', 'status', 'description'];
    sql += ' AND (' + likeCols.map(c => c + ' LIKE ?').join(' OR ') + ')';
    const q = '%' + query + '%';
    for (let i = 0; i < likeCols.length; i++) params.push(q);
  }
  sql += ' ORDER BY ingested_at DESC LIMIT ?';
  params.push(options.limit ?? 50);
  return (await db.prepare(sql).bind(...params).all<OnEconomicRecord>()).results ?? [];
}

export async function ingestOnEconomicData(db: D1Database | null, options: OnEconomicIngestionOptions = {}): Promise<OnEconomicIngestionResult> {
  const startTime = Date.now();
  const result: OnEconomicIngestionResult = { recordsFound: 0, recordsIngested: 0, newRecords: 0, errors: [], perType: {}, durationMs: 0 };
  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  result.perType['on_economic'] = { recordsFound: 0, recordsIngested: 0 };
  try {
    if (db && options.initializeTable) { log('[OnEconomic] Initializing...'); await initializeOnEconomicTable(db); }
    log('[OnEconomic] Fetching...');
    const { records: rawRecords, errors: fetchErrors } = await fetchOnEconomicRecords({ limit: maxRecords });
    result.errors.push(...fetchErrors);
    log('[OnEconomic] Found ' + rawRecords.length + ' raw records');
    const parsed = await parseOnEconomicBatch(rawRecords as RawOnEconomicRecord[], { sourceSystem: 'on-economic' });
    for (const record of parsed) {
      result.recordsFound++;
      result.perType['on_economic'].recordsFound++;
      if (db) {
        const inserted = await upsertOnEconomicRecord(db, record);
        if (inserted) result.newRecords++;
        result.recordsIngested++;
        result.perType['on_economic'].recordsIngested++;
      }
    }
  } catch (err) {
    const msg = 'OnEconomic ingestion failed: ' + (err as Error).message;
    result.errors.push(msg);
    log('[OnEconomic] ' + msg);
  }
  result.durationMs = Date.now() - startTime;
  log('[OnEconomic] Done: ' + result.recordsFound + ' found, ' + result.recordsIngested + ' ingested, ' + result.newRecords + ' new in ' + result.durationMs + 'ms');
  return result;
}
