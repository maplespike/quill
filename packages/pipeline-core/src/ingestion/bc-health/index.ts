// SPDX-License-Identifier: AGPL-3.0-only

import { fetchPharmaCareClaims, fetchBCCDCPublications, fetchAllBCHealthData } from './fetcher.js';
import { parsePharmaCareRecord, parsePharmaCareBatch, parseBCCDCRecord, parseBCCDCBatch } from './parser.js';
import type { PharmaCareRecord, BCCDCRecord, BCHealthIngestionOptions, BCHealthIngestionResult, RawBCHealthRecord } from './types.js';
import { BC_HEALTH_DDL, BCHealthError, DEFAULT_MAX_RECORDS, ALL_BC_HEALTH_TYPES } from './constants.js';

export { fetchPharmaCareClaims, fetchBCCDCPublications, fetchAllBCHealthData } from './fetcher.js';
export { parsePharmaCareRecord, parsePharmaCareBatch, parseBCCDCRecord, parseBCCDCBatch } from './parser.js';
export type { PharmaCareRecord, BCCDCRecord, BCHealthIngestionOptions, BCHealthIngestionResult, RawBCHealthRecord } from './types.js';
export { BC_HEALTH_DDL, BCHealthError, DEFAULT_MAX_RECORDS, ALL_BC_HEALTH_TYPES } from './constants.js';

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

export async function initializeBCHealthTable(db: D1Database): Promise<void> { await db.exec(BC_HEALTH_DDL); }

async function upsertPharmaCareRecord(db: D1Database, record: PharmaCareRecord): Promise<boolean> {
  const stmt = db.prepare(`INSERT OR IGNORE INTO bc_health_records (id, record_type, drug_name, manufacturer, formulary_status, atc_code, therapeutic_category, claim_count, total_cost, fiscal_year, source_url, source_system, ingested_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(record.id, 'pharmacare', record.drugName, record.manufacturer, record.formularyStatus, record.atcCode, record.therapeuticCategory, record.claimCount, record.totalCost, record.fiscalYear, record.sourceUrl, 'bc-pharmacare', record.ingestedAt);
  return (await stmt.run()).success;
}

async function upsertBCCDCRecord(db: D1Database, record: BCCDCRecord): Promise<boolean> {
  const stmt = db.prepare(`INSERT OR IGNORE INTO bc_health_records (id, record_type, title, topic, publication_date, disease_focus, url, summary, source_url, source_system, ingested_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(record.id, 'bccdc', record.title, record.topic, record.publicationDate, record.diseaseFocus, record.url, record.summary, record.url, 'bc-bccdc', record.ingestedAt);
  return (await stmt.run()).success;
}

export async function bcHealthRecordExists(db: D1Database, id: string): Promise<boolean> {
  return (await db.prepare('SELECT 1 FROM bc_health_records WHERE id = ? LIMIT 1').bind(id).first()) !== null;
}

export async function bcHealthTableExists(db: D1Database): Promise<boolean> {
  try { return (await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bc_health_records'").first()) !== null; } catch { return false; }
}

export async function searchBCHealthRecords(db: D1Database, query: string, options: { limit?: number; recordType?: string; fiscalYear?: string } = {}): Promise<any[]> {
  let sql = 'SELECT * FROM bc_health_records WHERE 1=1'; const params: any[] = [];
  if (query) { sql += ' AND (drug_name LIKE ? OR manufacturer LIKE ? OR title LIKE ? OR topic LIKE ? OR summary LIKE ?)'; const q = '%' + query + '%'; params.push(q, q, q, q, q); }
  if (options.recordType) { sql += ' AND record_type = ?'; params.push(options.recordType); }
  if (options.fiscalYear) { sql += ' AND fiscal_year = ?'; params.push(options.fiscalYear); }
  sql += ' ORDER BY ingested_at DESC LIMIT ?'; params.push(options.limit ?? 50);
  return (await db.prepare(sql).bind(...params).all()).results ?? [];
}

export async function ingestPharmaCareClaims(db: D1Database | null, options: BCHealthIngestionOptions = {}): Promise<BCHealthIngestionResult> {
  const startTime = Date.now(); const result: BCHealthIngestionResult = { recordsFound: 0, recordsIngested: 0, newRecords: 0, errors: [], perType: {}, durationMs: 0 };
  const log = options.onProgress ?? (() => {}); const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  result.perType['pharmacare'] = { recordsFound: 0, recordsIngested: 0 };
  try {
    if (db && options.initializeTable) { log('[BC-Health] Initializing...'); await initializeBCHealthTable(db); }
    log('[BC-Health] Fetching PharmaCare...');
    const { records: rawRecords, errors: fetchErrors } = await fetchPharmaCareClaims({ limit: maxRecords });
    result.errors.push(...fetchErrors); log('[BC-Health] Found ' + rawRecords.length + ' raw records');
    const records = await parsePharmaCareBatch(rawRecords as any[], { sourceSystem: 'bc-pharmacare' });
    for (const record of records) {
      result.recordsFound++; result.perType['pharmacare'].recordsFound++;
      if (db) { const inserted = await upsertPharmaCareRecord(db, record); if (inserted) result.newRecords++; result.recordsIngested++; result.perType['pharmacare'].recordsIngested++; }
    }
  } catch (err) { result.errors.push('PharmaCare ingestion failed: ' + (err as Error).message); }
  result.durationMs = Date.now() - startTime; log('[BC-Health] PharmaCare done: ' + result.recordsFound + ' found, ' + result.recordsIngested + ' ingested, ' + result.newRecords + ' new in ' + result.durationMs + 'ms');
  return result;
}

export async function ingestAllBCHealth(db: D1Database | null, options: BCHealthIngestionOptions = {}): Promise<BCHealthIngestionResult> {
  const startTime = Date.now(); const result: BCHealthIngestionResult = { recordsFound: 0, recordsIngested: 0, newRecords: 0, errors: [], perType: {}, durationMs: 0 };
  const log = options.onProgress ?? (() => {});
  const recordTypes = options.recordTypes ?? ALL_BC_HEALTH_TYPES;
  for (const rt of recordTypes) result.perType[rt] = { recordsFound: 0, recordsIngested: 0 };
  try {
    if (db && options.initializeTable) { log('[BC-Health] Initializing...'); await initializeBCHealthTable(db); }
    const pharmaResult = await ingestPharmaCareClaims(db, { ...options, initializeTable: false });
    result.recordsFound += pharmaResult.recordsFound; result.recordsIngested += pharmaResult.recordsIngested; result.newRecords += pharmaResult.newRecords; result.errors.push(...pharmaResult.errors); result.perType['pharmacare'] = pharmaResult.perType['pharmacare'];
  } catch (err) { result.errors.push('BC Health ingestion failed: ' + (err as Error).message); }
  result.durationMs = Date.now() - startTime; log('[BC-Health] All done: ' + result.recordsFound + ' found, ' + result.recordsIngested + ' ingested, ' + result.newRecords + ' new in ' + result.durationMs + 'ms');
  return result;
}
