// SPDX-License-Identifier: AGPL-3.0-only

import { fetchQcEconomicRecords } from './fetcher.js';
import { parseQcEconomicRecord, parseQcEconomicBatch } from './parser.js';
import { QcEconomic_DDL, DEFAULT_MAX_RECORDS, QcEconomicError } from './constants.js';
import type { QcEconomicRecord, QcEconomicIngestionOptions, QcEconomicIngestionResult, RawQcEconomicRecord } from './types.js';

export { fetchQcEconomicRecords } from './fetcher.js';
export { parseQcEconomicRecord, parseQcEconomicBatch } from './parser.js';
export { QcEconomic_DDL, DEFAULT_MAX_RECORDS, QcEconomicError } from './constants.js';
export type { QcEconomicRecord, QcEconomicIngestionOptions, QcEconomicIngestionResult, RawQcEconomicRecord } from './types.js';

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

export async function initializeQcEconomicTable(db: D1Database): Promise<void> {
  await db.exec(QcEconomic_DDL);
}

async function upsertQcEconomicRecord(db: D1Database, record: QcEconomicRecord): Promise<boolean> {
  const fields = ['id', 'record_type', 'category', 'subcategory', 'value', 'unit', 'period', 'fiscal_year', 'region', 'status', 'description'];
  const values = [record.id, record.recordType, record.category, record.subcategory, record.value, record.unit, record.period, record.fiscalYear, record.region, record.status, record.description];
  const placeholders = fields.map(() => '?').join(', ');
  const stmt = db.prepare(`INSERT OR IGNORE INTO qc_economic_indicators (${fields.join(', ')}) VALUES (${placeholders})`).bind(...values);
  return (await stmt.run()).success;
}

export async function searchQcEconomicRecords(db: D1Database, query: string, options: { limit?: number } = {}): Promise<QcEconomicRecord[]> {
  let sql = `SELECT * FROM qc_economic_indicators WHERE 1=1`;
  const params: unknown[] = [];
  if (query) {
    const likeCols = ['record_type', 'category', 'subcategory', 'region', 'status', 'description'];
    sql += ' AND (' + likeCols.map(c => c + ' LIKE ?').join(' OR ') + ')';
    const q = '%' + query + '%';
    for (let i = 0; i < likeCols.length; i++) params.push(q);
  }
  sql += ' ORDER BY ingested_at DESC LIMIT ?';
  params.push(options.limit ?? 50);
  return (await db.prepare(sql).bind(...params).all<QcEconomicRecord>()).results ?? [];
}

export async function ingestQcEconomicData(db: D1Database | null, options: QcEconomicIngestionOptions = {}): Promise<QcEconomicIngestionResult> {
  const startTime = Date.now();
  const result: QcEconomicIngestionResult = { recordsFound: 0, recordsIngested: 0, newRecords: 0, errors: [], perType: {}, durationMs: 0 };
  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  result.perType['qc_economic'] = { recordsFound: 0, recordsIngested: 0 };
  try {
    if (db && options.initializeTable) { log('[QcEconomic] Initializing...'); await initializeQcEconomicTable(db); }
    log('[QcEconomic] Fetching...');
    const { records: rawRecords, errors: fetchErrors } = await fetchQcEconomicRecords({ limit: maxRecords });
    result.errors.push(...fetchErrors);
    log('[QcEconomic] Found ' + rawRecords.length + ' raw records');
    const parsed = await parseQcEconomicBatch(rawRecords as RawQcEconomicRecord[], { sourceSystem: 'qc-economic' });
    for (const record of parsed) {
      result.recordsFound++;
      result.perType['qc_economic'].recordsFound++;
      if (db) {
        const inserted = await upsertQcEconomicRecord(db, record);
        if (inserted) result.newRecords++;
        result.recordsIngested++;
        result.perType['qc_economic'].recordsIngested++;
      }
    }
  } catch (err) {
    const msg = 'QcEconomic ingestion failed: ' + (err as Error).message;
    result.errors.push(msg);
    log('[QcEconomic] ' + msg);
  }
  result.durationMs = Date.now() - startTime;
  log('[QcEconomic] Done: ' + result.recordsFound + ' found, ' + result.recordsIngested + ' ingested, ' + result.newRecords + ' new in ' + result.durationMs + 'ms');
  return result;
}
