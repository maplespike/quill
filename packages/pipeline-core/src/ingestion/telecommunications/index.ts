// SPDX-License-Identifier: AGPL-3.0-only

import {
  fetchTelecommunicationsRecords,
} from './fetcher.js';
import {
  TELECOMMUNICATIONS_DDL,
  TELECOMMUNICATIONS_SOURCES,
  DEFAULT_MAX_RECORDS,
  TelecommunicationsError,
} from './constants.js';
import type {
  TelecommunicationsRecord,
  TelecommunicationsIngestionOptions,
  TelecommunicationsIngestionResult,
  RawTelecommunicationsRecord,
} from './types.js';

export {
  fetchTelecommunicationsRecords,
} from './fetcher.js';

export {
  TELECOMMUNICATIONS_DDL,
  TELECOMMUNICATIONS_SOURCES,
  DEFAULT_MAX_RECORDS,
  TelecommunicationsError,
} from './constants.js';

export type {
  TelecommunicationsRecord,
  TelecommunicationsIngestionOptions,
  TelecommunicationsIngestionResult,
  RawTelecommunicationsRecord,
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

export async function initializeTelecommunicationsTable(db: D1Database): Promise<void> {
  await db.exec(TELECOMMUNICATIONS_DDL);
}

async function upsertTelecommunicationsRecord(
  db: D1Database,
  record: TelecommunicationsRecord,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO telecommunications_records
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

export async function telecommunicationsRecordExists(
  db: D1Database,
  record: TelecommunicationsRecord,
): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 FROM telecommunications_records WHERE url = ? AND source_system = ? LIMIT 1`,
  ).bind(record.url, record.sourceSystem).first();
  return row !== null;
}

export async function searchTelecommunicationsRecords(
  db: D1Database,
  query: string,
  options: { limit?: number; source?: string } = {},
): Promise<TelecommunicationsRecord[]> {
  let sql = `SELECT * FROM telecommunications_records WHERE 1=1`;
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
  const result = await stmt.all<TelecommunicationsRecord>();
  return result.results ?? [];
}

export async function ingestTelecommunicationsRecords(
  db: D1Database | null,
  options: TelecommunicationsIngestionOptions = {},
): Promise<TelecommunicationsIngestionResult> {
  const startTime = Date.now();
  const result: TelecommunicationsIngestionResult = {
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
      log('[TELECOMMUNICATIONS] Initializing telecommunications_records...');
      await initializeTelecommunicationsTable(db);
    }

    log('[TELECOMMUNICATIONS] Fetching records...');
    const { records: rawRecords, errors: fetchErrors } = await fetchTelecommunicationsRecords({ limit: maxRecords });
    result.errors.push(...fetchErrors);

    for (const raw of rawRecords) {
      result.recordsFound++;
      const record: TelecommunicationsRecord = {
        id: raw.url ? `${raw.sourceSystem}-${Buffer.from(raw.url).toString('hex').slice(0, 32)}` : crypto.randomUUID(),
        sourceSystem: raw.sourceSystem ?? 'telecommunications',
        recordType: 'general',
        title: raw.title ?? null,
        description: raw.description ?? null,
        url: raw.url ?? null,
        publishedAt: raw.publishedAt ?? null,
        ingestedAt: new Date().toISOString(),
      };
      if (db) {
        const inserted = await upsertTelecommunicationsRecord(db, record);
        if (inserted) result.newRecords++;
        result.recordsIngested++;
      }
    }
  } catch (err) {
    result.errors.push(`Telecommunications ingestion failed: ${(err as Error).message}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}
