// SPDX-License-Identifier: AGPL-3.0-only

import {
  fetchPolicingSecurityRecords,
} from './fetcher.js';
import {
  POLICING_SECURITY_DDL,
  POLICING_SECURITY_SOURCES,
  DEFAULT_MAX_RECORDS,
  PolicingSecurityError,
} from './constants.js';
import type {
  PolicingSecurityRecord,
  PolicingSecurityIngestionOptions,
  PolicingSecurityIngestionResult,
  RawPolicingSecurityRecord,
} from './types.js';

export {
  fetchPolicingSecurityRecords,
} from './fetcher.js';

export {
  POLICING_SECURITY_DDL,
  POLICING_SECURITY_SOURCES,
  DEFAULT_MAX_RECORDS,
  PolicingSecurityError,
} from './constants.js';

export type {
  PolicingSecurityRecord,
  PolicingSecurityIngestionOptions,
  PolicingSecurityIngestionResult,
  RawPolicingSecurityRecord,
} from './types.js';

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

export async function initializePolicingSecurityTable(db: D1Database): Promise<void> {
  await db.exec(POLICING_SECURITY_DDL);
}

async function upsertPolicingSecurityRecord(
  db: D1Database,
  record: PolicingSecurityRecord,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO policing_records
      (id, source_system, record_type, title, description, url, published_at, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    record.sourceSystem,
    record.recordType || 'general',
    record.title,
    record.description,
    record.url,
    record.publishedAt,
    record.ingestedAt,
  );
  const result = await stmt.run();
  return result.success;
}

export async function policingSecurityRecordExists(
  db: D1Database,
  record: PolicingSecurityRecord,
): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 FROM policing_records WHERE url = ? AND source_system = ? LIMIT 1`,
  ).bind(record.url, record.sourceSystem).first();
  return row !== null;
}

export async function searchPolicingSecurityRecords(
  db: D1Database,
  query: string,
  options: { limit?: number; source?: string } = {},
): Promise<PolicingSecurityRecord[]> {
  let sql = `SELECT * FROM policing_records WHERE 1=1`;
  const params: unknown[] = [];

  if (query) {
    sql += ` AND (title LIKE ? OR description LIKE ?)`;
    const q = `%${query}%`;
    params.push(q, q);
  }
  if (options.source) {
    sql += ` AND source_system = ?`;
    params.push(options.source);
  }
  sql += ' ORDER BY published_at DESC LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<PolicingSecurityRecord>();
  return result.results ?? [];
}

export async function ingestPolicingSecurityRecords(
  db: D1Database | null,
  options: PolicingSecurityIngestionOptions = {},
): Promise<PolicingSecurityIngestionResult> {
  const startTime = Date.now();
  const result: PolicingSecurityIngestionResult = {
    recordsFound: 0,
    recordsIngested: 0,
    newRecords: 0,
    errors: [],
    durationMs: 0,
  };
  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;

  try {
    if (db && options.initializeTable) {
      log('[POLICING_SECURITY] Initializing policing_records...');
      await initializePolicingSecurityTable(db);
    }

    log('[POLICING_SECURITY] Fetching records...');
    const { records: rawRecords, errors: fetchErrors } = await fetchPolicingSecurityRecords({ limit: maxRecords });
    result.errors.push(...fetchErrors);

    for (const raw of rawRecords) {
      result.recordsFound++;
      const record: PolicingSecurityRecord = {
        id: raw.url ? `${raw.sourceSystem}-${Buffer.from(raw.url).toString('hex').slice(0, 32)}` : crypto.randomUUID(),
        sourceSystem: raw.sourceSystem ?? 'policingSecurity',
        recordType: 'general',
        title: raw.title ?? null,
        description: raw.description ?? null,
        url: raw.url ?? null,
        publishedAt: raw.publishedAt ?? null,
        ingestedAt: new Date().toISOString(),
      };
      if (db) {
        const inserted = await upsertPolicingSecurityRecord(db, record);
        if (inserted) result.newRecords++;
        result.recordsIngested++;
      }
    }
  } catch (err) {
    result.errors.push(`PolicingSecurity ingestion failed: ${(err as Error).message}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}
