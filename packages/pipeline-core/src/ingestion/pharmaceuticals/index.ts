// SPDX-License-Identifier: AGPL-3.0-only

import {
  fetchPharmaceuticalsRecords,
} from './fetcher.js';
import {
  PHARMACEUTICALS_DDL,
  PHARMACEUTICALS_SOURCES,
  DEFAULT_MAX_RECORDS,
  PharmaceuticalsError,
} from './constants.js';
import type {
  PharmaceuticalsRecord,
  PharmaceuticalsIngestionOptions,
  PharmaceuticalsIngestionResult,
  RawPharmaceuticalsRecord,
} from './types.js';

export {
  fetchPharmaceuticalsRecords,
} from './fetcher.js';

export {
  PHARMACEUTICALS_DDL,
  PHARMACEUTICALS_SOURCES,
  DEFAULT_MAX_RECORDS,
  PharmaceuticalsError,
} from './constants.js';

export type {
  PharmaceuticalsRecord,
  PharmaceuticalsIngestionOptions,
  PharmaceuticalsIngestionResult,
  RawPharmaceuticalsRecord,
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

export async function initializePharmaceuticalsTable(db: D1Database): Promise<void> {
  await db.exec(PHARMACEUTICALS_DDL);
}

async function upsertPharmaceuticalsRecord(
  db: D1Database,
  record: PharmaceuticalsRecord,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO pharmaceuticals_records
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

export async function pharmaceuticalsRecordExists(
  db: D1Database,
  record: PharmaceuticalsRecord,
): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 FROM pharmaceuticals_records WHERE url = ? AND source_system = ? LIMIT 1`,
  ).bind(record.url, record.sourceSystem).first();
  return row !== null;
}

export async function searchPharmaceuticalsRecords(
  db: D1Database,
  query: string,
  options: { limit?: number; source?: string } = {},
): Promise<PharmaceuticalsRecord[]> {
  let sql = `SELECT * FROM pharmaceuticals_records WHERE 1=1`;
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
  const result = await stmt.all<PharmaceuticalsRecord>();
  return result.results ?? [];
}

export async function ingestPharmaceuticalsRecords(
  db: D1Database | null,
  options: PharmaceuticalsIngestionOptions = {},
): Promise<PharmaceuticalsIngestionResult> {
  const startTime = Date.now();
  const result: PharmaceuticalsIngestionResult = {
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
      log('[PHARMACEUTICALS] Initializing pharmaceuticals_records...');
      await initializePharmaceuticalsTable(db);
    }

    log('[PHARMACEUTICALS] Fetching records...');
    const { records: rawRecords, errors: fetchErrors } = await fetchPharmaceuticalsRecords({ limit: maxRecords });
    result.errors.push(...fetchErrors);

    for (const raw of rawRecords) {
      result.recordsFound++;
      const record: PharmaceuticalsRecord = {
        id: raw.url ? `${raw.sourceSystem}-${Buffer.from(raw.url).toString('hex').slice(0, 32)}` : crypto.randomUUID(),
        sourceSystem: raw.sourceSystem ?? 'pharmaceuticals',
        recordType: 'general',
        title: raw.title ?? null,
        description: raw.description ?? null,
        url: raw.url ?? null,
        publishedAt: raw.publishedAt ?? null,
        ingestedAt: new Date().toISOString(),
      };
      if (db) {
        const inserted = await upsertPharmaceuticalsRecord(db, record);
        if (inserted) result.newRecords++;
        result.recordsIngested++;
      }
    }
  } catch (err) {
    result.errors.push(`Pharmaceuticals ingestion failed: ${(err as Error).message}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}
