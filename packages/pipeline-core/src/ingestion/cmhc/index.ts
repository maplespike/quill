// SPDX-License-Identifier: AGPL-3.0-only
/**
 * CMHC (Canada Mortgage and Housing Corporation) Ingestion — Quill
 *
 * Orchestrates the ingestion pipeline for Canadian housing market data:
 *   - Housing starts, completions, under construction
 *   - Vacancy rates (rental market survey)
 *   - Rental rates (rental market survey)
 *   - Affordability indicators
 *
 * Pipeline:
 *   1. Fetch housing data from CMHC web portal / CKAN
 *   2. Parse and normalize records into unified CmhcRecord schema
 *   3. Persist to D1 database with deduplication
 *   4. Enable search and query functions
 *
 * Cross-reference opportunities:
 *   - Municipal: local housing policies and zoning decisions
 *   - Federal Budget: national housing strategy funding
 *   - Bank of Canada: interest rate impacts on housing affordability
 */

import {
  fetchCmhcData,
  fetchCmhcCkanMetadata,
} from './fetcher.js';
import {
  parseCmhcDataset,
  parseCmhcCsvRows,
  normalizeCmhcMetric,
  normalizeCmhcHousingType,
} from './parser.js';
import {
  CMHC_DDL,
  CMHC_SOURCES,
  CMHC_METRIC_CONFIG,
  CMHC_METRIC_TYPE_MAP,
  ALL_CMHC_METRICS,
  DEFAULT_MAX_RECORDS,
  CmhcError,
} from './constants.js';
import type {
  CmhcRecord,
  CmhcMetric,
  CmhcHousingType,
  CmhcIngestionOptions,
  CmhcIngestionResult,
  RawCmhcRecord,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Re-exports for barrel                                              */
/* ------------------------------------------------------------------ */

export {
  fetchCmhcData,
  fetchCmhcCkanMetadata,
} from './fetcher.js';

export {
  parseCmhcDataset,
  parseCmhcCsvRows,
  normalizeCmhcMetric,
  normalizeCmhcHousingType,
} from './parser.js';

export {
  CMHC_DDL,
  CMHC_SOURCES,
  CMHC_METRIC_CONFIG,
  CMHC_METRIC_TYPE_MAP,
  ALL_CMHC_METRICS,
  DEFAULT_MAX_RECORDS,
  CmhcError,
} from './constants.js';

export type {
  CmhcRecord,
  CmhcMetric,
  CmhcHousingType,
  CmhcIngestionOptions,
  CmhcIngestionResult,
  RawCmhcRecord,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  D1Database Interface                                               */
/* ------------------------------------------------------------------ */

/** Minimal D1Database interface matching Cloudflare D1 API. */
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

/* ------------------------------------------------------------------ */
/*  Database Operations                                                */
/* ------------------------------------------------------------------ */

/**
 * Initialize the cmhc_records table.
 */
export async function initializeCmhcTable(db: D1Database): Promise<void> {
  await db.exec(CMHC_DDL);
}

/**
 * Upsert (insert or ignore) a CMHC record.
 *
 * @returns true if inserted, false if skipped (duplicate)
 */
async function upsertCmhcRecord(
  db: D1Database,
  record: CmhcRecord,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO cmhc_records
      (id, metric_name, metric_type, geographic_area, geographic_level,
       period, period_start, period_end, value, unit,
       housing_type, seasonally_adjusted,
       source_url, source_system, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    record.metricName,
    record.metricType,
    record.geographicArea,
    record.geographicLevel,
    record.period,
    record.periodStart,
    record.periodEnd,
    record.value,
    record.unit,
    record.housingType,
    record.seasonallyAdjusted === null ? null : record.seasonallyAdjusted ? 1 : 0,
    record.sourceUrl,
    record.sourceSystem,
    record.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}

/**
 * Check if a record already exists by its content hash.
 */
export async function cmhcRecordExists(
  db: D1Database,
  id: string,
): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 FROM cmhc_records WHERE id = ? LIMIT 1`,
  ).bind(id).first();

  return row !== null;
}

/**
 * Check if the cmhc_records table exists.
 */
export async function cmhcTableExists(db: D1Database): Promise<boolean> {
  try {
    const row = await db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='cmhc_records'`,
    ).first();
    return row !== null;
  } catch {
    return false;
  }
}

/**
 * Get the latest ingestion date from the cmhc_records table.
 */
export async function getLatestCmhcIngestionDate(db: D1Database): Promise<string | null> {
  const row = await db.prepare(
    'SELECT ingested_at FROM cmhc_records ORDER BY ingested_at DESC LIMIT 1',
  ).first<{ ingested_at: string }>();
  return row?.ingested_at ?? null;
}

/* ------------------------------------------------------------------ */
/*  Search Functions                                                   */
/* ------------------------------------------------------------------ */

/**
 * Search CMHC records by keyword across multiple fields.
 */
export async function searchCmhcRecords(
  db: D1Database,
  query: string,
  options: {
    limit?: number;
    metricType?: CmhcMetric;
    housingType?: CmhcHousingType;
    geographicArea?: string;
  } = {},
): Promise<CmhcRecord[]> {
  let sql = `SELECT * FROM cmhc_records WHERE 1=1`;
  const params: unknown[] = [];

  if (query) {
    sql += ` AND (
      metric_name LIKE ? OR
      geographic_area LIKE ? OR
      period LIKE ?
    )`;
    const q = `%${query}%`;
    params.push(q, q, q);
  }

  if (options.metricType) {
    sql += ' AND metric_type = ?';
    params.push(options.metricType);
  }

  if (options.housingType) {
    sql += ' AND housing_type = ?';
    params.push(options.housingType);
  }

  if (options.geographicArea) {
    sql += ' AND geographic_area LIKE ?';
    params.push(`%${options.geographicArea}%`);
  }

  sql += ' ORDER BY period DESC NULLS LAST, metric_name ASC LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<CmhcRecord>();
  return result.results ?? [];
}

/**
 * Get CMHC records by metric type.
 */
export async function getCmhcByMetric(
  db: D1Database,
  metricType: CmhcMetric,
  options: {
    limit?: number;
    geographicArea?: string;
  } = {},
): Promise<CmhcRecord[]> {
  return searchCmhcRecords(db, '', {
    metricType,
    geographicArea: options.geographicArea,
    limit: options.limit ?? 100,
  });
}

/**
 * Get CMHC records by geographic area.
 */
export async function getCmhcByArea(
  db: D1Database,
  geographicArea: string,
  options: {
    limit?: number;
    metricType?: CmhcMetric;
  } = {},
): Promise<CmhcRecord[]> {
  return searchCmhcRecords(db, geographicArea, {
    metricType: options.metricType,
    limit: options.limit ?? 100,
  });
}

/**
 * Get CMHC records by housing type.
 */
export async function getCmhcByHousingType(
  db: D1Database,
  housingType: CmhcHousingType,
  options: {
    limit?: number;
    metricType?: CmhcMetric;
  } = {},
): Promise<CmhcRecord[]> {
  return searchCmhcRecords(db, '', {
    housingType,
    metricType: options.metricType,
    limit: options.limit ?? 100,
  });
}

/**
 * Get the latest records for a given metric.
 */
export async function getLatestCmhcMetric(
  db: D1Database,
  metricType: CmhcMetric,
  options: {
    geographicArea?: string;
  } = {},
): Promise<CmhcRecord[]> {
  let sql = `SELECT * FROM cmhc_records
    WHERE metric_type = ?`;
  const params: unknown[] = [metricType];

  if (options.geographicArea) {
    sql += ' AND geographic_area = ?';
    params.push(options.geographicArea);
  }

  sql += ' ORDER BY period DESC LIMIT 10';

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<CmhcRecord>();
  return result.results ?? [];
}

/* ------------------------------------------------------------------ */
/*  Ingestion Orchestrator                                             */
/* ------------------------------------------------------------------ */

/**
 * Ingest CMHC housing market data records into the database.
 *
 * Orchestrates:
 *   1. Initialize table (if requested)
 *   2. Fetch housing data from CMHC portal / CKAN
 *   3. Parse and normalize records into unified schema
 *   4. Deduplicate and persist to D1
 *
 * @param db - D1 database instance (null to dry-run)
 * @param options - Ingestion options
 * @returns Ingestion result with counts and errors
 */
export async function ingestCmhc(
  db: D1Database | null,
  options: CmhcIngestionOptions = {},
): Promise<CmhcIngestionResult> {
  const startTime = Date.now();
  const result: CmhcIngestionResult = {
    recordsFound: 0,
    recordsIngested: 0,
    newRecords: 0,
    errors: [],
    perMetric: {},
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  const metricTypes = options.metricTypes ?? ALL_CMHC_METRICS;
  const year = options.year;

  // Initialize per-metric counters
  for (const mt of metricTypes) {
    result.perMetric[mt] = { recordsFound: 0, recordsIngested: 0 };
  }

  try {
    // Phase 0: Initialize table if requested
    if (db && options.initializeTable) {
      log('[CMHC] Initializing cmhc_records table...');
      await initializeCmhcTable(db);
    }

    // Phase 1: Fetch and process each metric type
    for (const metric of metricTypes) {
      log(`[CMHC] Fetching ${metric} data...`);

      try {
        const { records: rawRecords, errors: fetchErrors } = await fetchCmhcData(
          metric,
          year,
          { limit: maxRecords },
        );

        result.errors.push(...fetchErrors);
        log(`[CMHC] Found ${rawRecords.length} raw ${metric} records`);

        // Get the configured source system for this metric
        const sourceSystem = CMHC_METRIC_CONFIG[metric].sourceSystem;

        // Phase 2-4: Parse and persist
        for (const raw of rawRecords) {
          const record = await parseCmhcDataset(raw, {
            sourceSystem,
            metricType: metric,
          });

          if (record === null) continue;

          result.recordsFound++;
          result.perMetric[metric].recordsFound++;

          // Persist to database
          if (db) {
            const inserted = await upsertCmhcRecord(db, record);
            if (inserted) {
              result.newRecords++;
            }
            result.recordsIngested++;
            result.perMetric[metric].recordsIngested++;
          }
        }
      } catch (err) {
        const msg = `CMHC ${metric} fetch/parse failed: ${(err as Error).message}`;
        result.errors.push(msg);
        log(`[CMHC] ${msg}`);
      }
    }
  } catch (err) {
    const msg = `CMHC ingestion failed: ${(err as Error).message}`;
    result.errors.push(msg);
    log(`[CMHC] ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[CMHC] Done: ${result.recordsFound} found, ${result.recordsIngested} ingested, ${result.newRecords} new in ${result.durationMs}ms`);

  return result;
}
