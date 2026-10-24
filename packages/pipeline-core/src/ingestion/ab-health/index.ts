// SPDX-License-Identifier: AGPL-3.0-only

import { fetchAHSData, fetchAllAHSData, fetchABHealthPublications } from './fetcher.js';
import { parseAHSRecord, parseAHSBatch, parseABHealthPublication, parseABHealthPublicationBatch } from './parser.js';
import type { AHSRecord, ABHealthRecord, ABHealthIngestionOptions, ABHealthIngestionResult, RawAHSRecord } from './types.js';
import { AB_HEALTH_DDL, ABHealthError, DEFAULT_MAX_RECORDS, ALL_AHS_RECORD_TYPES } from './constants.js';

export { fetchAHSData, fetchAllAHSData, fetchABHealthPublications } from './fetcher.js';
export { parseAHSRecord, parseAHSBatch, parseABHealthPublication, parseABHealthPublicationBatch } from './parser.js';
export type { AHSRecord, ABHealthRecord, ABHealthIngestionOptions, ABHealthIngestionResult, RawAHSRecord } from './types.js';
export { AB_HEALTH_DDL, ABHealthError, DEFAULT_MAX_RECORDS, ALL_AHS_RECORD_TYPES } from './constants.js';

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

export async function initializeABHealthTable(db: D1Database): Promise<void> { await db.exec(AB_HEALTH_DDL); }

async function upsertAHSRecord(db: D1Database, record: AHSRecord): Promise<boolean> {
  const stmt = db.prepare(`INSERT OR IGNORE INTO ab_health_records (id, category, measure, value, region, fiscal_year, quarter, source_url, source_system, ingested_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(record.id, record.category, record.measure, record.value, record.region, record.fiscalYear, record.quarter, record.sourceUrl, record.sourceSystem, record.ingestedAt);
  return (await stmt.run()).success;
}

async function upsertABHealthPublication(db: D1Database, record: ABHealthRecord): Promise<boolean> {
  const stmt = db.prepare(`INSERT OR IGNORE INTO ab_health_publications (id, title, topic, publication_date, data_type, url, summary, source_system, ingested_at) VALUES (?,?,?,?,?,?,?,?,?)`).bind(record.id, record.title, record.topic, record.publicationDate, record.dataType, record.url, record.summary, record.sourceSystem, record.ingestedAt);
  return (await stmt.run()).success;
}

export async function abHealthRecordExists(db: D1Database, id: string): Promise<boolean> {
  return (await db.prepare('SELECT 1 FROM ab_health_records WHERE id = ? LIMIT 1').bind(id).first()) !== null;
}

export async function abHealthTableExists(db: D1Database): Promise<boolean> {
  try { return (await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ab_health_records'").first()) !== null; } catch { return false; }
}

export async function searchABHealthRecords(db: D1Database, query: string, options: { limit?: number; category?: string; region?: string; fiscalYear?: string } = {}): Promise<any[]> {
  let sql = 'SELECT * FROM ab_health_records WHERE 1=1'; const params: any[] = [];
  if (query) { sql += ' AND (measure LIKE ? OR value LIKE ? OR region LIKE ?)'; const q = '%' + query + '%'; params.push(q, q, q); }
  if (options.category) { sql += ' AND category = ?'; params.push(options.category); }
  if (options.region) { sql += ' AND region LIKE ?'; params.push('%' + options.region + '%'); }
  if (options.fiscalYear) { sql += ' AND fiscal_year = ?'; params.push(options.fiscalYear); }
  sql += ' ORDER BY ingested_at DESC LIMIT ?'; params.push(options.limit ?? 50);
  return (await db.prepare(sql).bind(...params).all()).results ?? [];
}

export async function ingestAHSData(db: D1Database | null, options: ABHealthIngestionOptions = {}): Promise<ABHealthIngestionResult> {
  const startTime = Date.now(); const result: ABHealthIngestionResult = { recordsFound: 0, recordsIngested: 0, newRecords: 0, errors: [], perType: {}, durationMs: 0 };
  const log = options.onProgress ?? (() => {}); const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  result.perType['ahs'] = { recordsFound: 0, recordsIngested: 0 };
  try {
    if (db && options.initializeTable) { log('[AB-Health] Initializing...'); await initializeABHealthTable(db); }
    log('[AB-Health] Fetching AHS data...');
    const { records: rawRecords, errors: fetchErrors } = await fetchAHSData('surgery', { limit: maxRecords });
    result.errors.push(...fetchErrors); log('[AB-Health] Found ' + rawRecords.length + ' raw records');
    const records = await parseAHSBatch(rawRecords as any[], { sourceSystem: 'ab-ahs' });
    for (const record of records) {
      result.recordsFound++; result.perType['ahs'].recordsFound++;
      if (db) { const inserted = await upsertAHSRecord(db, record); if (inserted) result.newRecords++; result.recordsIngested++; result.perType['ahs'].recordsIngested++; }
    }
  } catch (err) { result.errors.push('AHS ingestion failed: ' + (err as Error).message); }
  result.durationMs = Date.now() - startTime; log('[AB-Health] AHS done: ' + result.recordsFound + ' found, ' + result.recordsIngested + ' ingested, ' + result.newRecords + ' new in ' + result.durationMs + 'ms');
  return result;
}

export async function ingestAllABHealth(db: D1Database | null, options: ABHealthIngestionOptions = {}): Promise<ABHealthIngestionResult> {
  const startTime = Date.now(); const result: ABHealthIngestionResult = { recordsFound: 0, recordsIngested: 0, newRecords: 0, errors: [], perType: {}, durationMs: 0 };
  const log = options.onProgress ?? (() => {});
  const recordTypes = options.recordTypes ?? ALL_AHS_RECORD_TYPES;
  for (const rt of recordTypes) result.perType[rt] = { recordsFound: 0, recordsIngested: 0 };
  try {
    if (db && options.initializeTable) { log('[AB-Health] Initializing...'); await initializeABHealthTable(db); }
    const ahsResult = await ingestAHSData(db, { ...options, initializeTable: false });
    result.recordsFound += ahsResult.recordsFound; result.recordsIngested += ahsResult.recordsIngested; result.newRecords += ahsResult.newRecords; result.errors.push(...ahsResult.errors); result.perType['ahs'] = ahsResult.perType['ahs'];
  } catch (err) { result.errors.push('AB Health ingestion failed: ' + (err as Error).message); }
  result.durationMs = Date.now() - startTime; log('[AB-Health] All done: ' + result.recordsFound + ' found, ' + result.recordsIngested + ' ingested, ' + result.newRecords + ' new in ' + result.durationMs + 'ms');
  return result;
}
