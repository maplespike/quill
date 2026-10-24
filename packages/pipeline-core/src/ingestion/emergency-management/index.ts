// SPDX-License-Identifier: AGPL-3.0-only

import {
  fetchEmergencyManagementRecords,
} from './fetcher.js';
import {
  EMERGENCY_MANAGEMENT_DDL,
  EMERGENCY_MANAGEMENT_SOURCES,
  DEFAULT_MAX_RECORDS,
  EmergencyManagementError,
} from './constants.js';
import type {
  EmergencyManagementRecord,
  EmergencyManagementIngestionOptions,
  EmergencyManagementIngestionResult,
  RawEmergencyManagementRecord,
} from './types.js';

export {
  fetchEmergencyManagementRecords,
} from './fetcher.js';

export {
  EMERGENCY_MANAGEMENT_DDL,
  EMERGENCY_MANAGEMENT_SOURCES,
  DEFAULT_MAX_RECORDS,
  EmergencyManagementError,
} from './constants.js';

export type {
  EmergencyManagementRecord,
  EmergencyManagementIngestionOptions,
  EmergencyManagementIngestionResult,
  RawEmergencyManagementRecord,
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

export async function initializeEmergencyManagementTable(db: D1Database): Promise<void> {
  await db.exec(EMERGENCY_MANAGEMENT_DDL);
}

async function upsertEmergencyManagementRecord(
  db: D1Database,
  record: EmergencyManagementRecord,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO emergency_records
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

export async function emergencyManagementRecordExists(
  db: D1Database,
  record: EmergencyManagementRecord,
): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 FROM emergency_records WHERE url = ? AND source_system = ? LIMIT 1`,
  ).bind(record.url, record.sourceSystem).first();
  return row !== null;
}

export async function searchEmergencyManagementRecords(
  db: D1Database,
  query: string,
  options: { limit?: number; source?: string } = {},
): Promise<EmergencyManagementRecord[]> {
  let sql = `SELECT * FROM emergency_records WHERE 1=1`;
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
  const result = await stmt.all<EmergencyManagementRecord>();
  return result.results ?? [];
}

export async function ingestEmergencyManagementRecords(
  db: D1Database | null,
  options: EmergencyManagementIngestionOptions = {},
): Promise<EmergencyManagementIngestionResult> {
  const startTime = Date.now();
  const result: EmergencyManagementIngestionResult = {
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
      log('[EMERGENCY_MANAGEMENT] Initializing emergency_records...');
      await initializeEmergencyManagementTable(db);
    }

    log('[EMERGENCY_MANAGEMENT] Fetching records...');
    const { records: rawRecords, errors: fetchErrors } = await fetchEmergencyManagementRecords({ limit: maxRecords });
    result.errors.push(...fetchErrors);

    for (const raw of rawRecords) {
      result.recordsFound++;
      const record: EmergencyManagementRecord = {
        id: raw.url ? `${raw.sourceSystem}-${Buffer.from(raw.url).toString('hex').slice(0, 32)}` : crypto.randomUUID(),
        sourceSystem: raw.sourceSystem ?? 'emergencyManagement',
        recordType: 'general',
        title: raw.title ?? null,
        description: raw.description ?? null,
        url: raw.url ?? null,
        publishedAt: raw.publishedAt ?? null,
        ingestedAt: new Date().toISOString(),
      };
      if (db) {
        const inserted = await upsertEmergencyManagementRecord(db, record);
        if (inserted) result.newRecords++;
        result.recordsIngested++;
      }
    }
  } catch (err) {
    result.errors.push(`EmergencyManagement ingestion failed: ${(err as Error).message}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}
