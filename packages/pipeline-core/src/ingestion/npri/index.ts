// SPDX-License-Identifier: AGPL-3.0-only
/**
 * NPRI (National Pollutant Release Inventory) Ingestion — Quill
 *
 * Orchestrates the ingestion pipeline for Canada's National Pollutant Release
 * Inventory data from the Government of Canada's open.canada.ca portal.
 *
 * Pipeline:
 *   1. Fetch raw NPRI records from CKAN (open.canada.ca)
 *   2. Parse and normalize records into unified NpriRecord schema
 *   3. Persist to D1 database with deduplication
 *   4. Enable search and query functions
 *
 * Sources:
 *   - open.canada.ca CKAN: https://open.canada.ca/data
 *   - ECCC NPRI data portal: https://data.ec.gc.ca/data/substances/monitor/national-pollutant-release-inventory/
 *
 * Cross-reference opportunities:
 *   - Corporate: parent companies matching lobbying/procurement records
 *   - Oversight: ECCC enforcement actions against NPRI reporters
 *   - Municipal: facilities located in specific cities/municipalities
 */

import {
  fetchNpriReleases,
  fetchAllNpriReleases,
  searchNpriCkanPackages,
  fetchNpriCkanPackage,
  fetchNpriResource,
} from './fetcher.js';
import {
  parseNpriRecord,
  parseNpriBatch,
  parseNpriCkanPackage,
} from './parser.js';
import {
  NPRI_RECORDS_DDL,
  NPRI_SOURCES,
  NPRI_CKAN_PACKAGE_IDS,
  RECENT_FISCAL_YEARS,
  DEFAULT_MAX_RECORDS,
  NpriError,
} from './constants.js';
import type {
  NpriRecord,
  NpriIngestionOptions,
  NpriIngestionResult,
  RawNpriRecord,
  RawNpriCkanPackage,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Re-exports for barrel                                              */
/* ------------------------------------------------------------------ */

export {
  fetchNpriReleases,
  fetchAllNpriReleases,
  searchNpriCkanPackages,
  fetchNpriCkanPackage,
  fetchNpriResource,
} from './fetcher.js';

export {
  parseNpriRecord,
  parseNpriBatch,
  parseNpriCkanPackage,
} from './parser.js';

export {
  NPRI_RECORDS_DDL,
  NPRI_SOURCES,
  NPRI_CKAN_PACKAGE_IDS,
  RECENT_FISCAL_YEARS,
  DEFAULT_MAX_RECORDS,
  NpriError,
} from './constants.js';

export type {
  NpriRecord,
  NpriIngestionOptions,
  NpriIngestionResult,
  RawNpriRecord,
  RawNpriCkanPackage,
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
 * Initialize the npri_records table.
 */
export async function initializeNpriTable(db: D1Database): Promise<void> {
  await db.exec(NPRI_RECORDS_DDL);
}

/**
 * Insert (or ignore) an NPRI record.
 *
 * @returns true if inserted, false if skipped (duplicate)
 */
async function upsertNpriRecord(
  db: D1Database,
  record: NpriRecord,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO npri_records
      (id, facility_name, facility_location, province, latitude, longitude,
       substance_name, substance_cas, release_air_kg, release_water_kg,
       release_land_kg, disposal_kg, recycling_kg, fiscal_year,
       reported_by, source_url, ckan_package_id, ckan_resource_id,
       source_system, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    record.facilityName,
    record.facilityLocation,
    record.province,
    record.latitude,
    record.longitude,
    record.substanceName,
    record.substanceCas,
    record.releaseAirKg,
    record.releaseWaterKg,
    record.releaseLandKg,
    record.disposalKg,
    record.recyclingKg,
    record.fiscalYear,
    record.reportedBy,
    record.sourceUrl,
    record.ckanPackageId,
    record.ckanResourceId,
    record.sourceSystem,
    record.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}

/**
 * Check if a record already exists.
 */
export async function npriRecordExists(
  db: D1Database,
  record: NpriRecord,
): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 FROM npri_records
     WHERE facility_name = ? AND substance_name = ? AND fiscal_year = ? AND source_url = ?
     LIMIT 1`,
  ).bind(
    record.facilityName,
    record.substanceName,
    record.fiscalYear,
    record.sourceUrl,
  ).first();

  return row !== null;
}

/**
 * Check if the npri_records table exists.
 */
export async function npriTableExists(db: D1Database): Promise<boolean> {
  try {
    const row = await db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='npri_records'`,
    ).first();
    return row !== null;
  } catch {
    return false;
  }
}

/**
 * Get the latest ingestion date from the npri_records table.
 */
export async function getLatestNpriIngestionDate(db: D1Database): Promise<string | null> {
  const row = await db.prepare(
    'SELECT ingested_at FROM npri_records ORDER BY ingested_at DESC LIMIT 1',
  ).first<{ ingested_at: string }>();
  return row?.ingested_at ?? null;
}

/* ------------------------------------------------------------------ */
/*  Search Functions                                                   */
/* ------------------------------------------------------------------ */

/**
 * Search NPRI records by keyword across multiple fields.
 *
 * @param db - D1 database instance
 * @param query - Search terms
 * @param options - Search options (limit, province, substance)
 * @returns Matching NpriRecord array
 */
export async function searchNpriRecords(
  db: D1Database,
  query: string,
  options: {
    limit?: number;
    province?: string;
    substance?: string;
    fiscalYear?: string;
  } = {},
): Promise<NpriRecord[]> {
  let sql = `SELECT * FROM npri_records WHERE 1=1`;
  const params: unknown[] = [];

  if (query) {
    sql += ` AND (
      facility_name LIKE ? OR
      substance_name LIKE ? OR
      reported_by LIKE ? OR
      province LIKE ? OR
      facility_location LIKE ?
    )`;
    const q = `%${query}%`;
    params.push(q, q, q, q, q);
  }

  if (options.province) {
    sql += ' AND province = ?';
    params.push(options.province);
  }

  if (options.substance) {
    sql += ' AND (substance_name LIKE ? OR substance_cas = ?)';
    params.push(`%${options.substance}%`, options.substance);
  }

  if (options.fiscalYear) {
    sql += ' AND fiscal_year = ?';
    params.push(options.fiscalYear);
  }

  sql += ' ORDER BY fiscal_year DESC NULLS LAST, facility_name LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<NpriRecord>();
  return result.results ?? [];
}

/**
 * Get NPRI records by facility name.
 */
export async function getNpriByFacility(
  db: D1Database,
  facilityName: string,
  options: {
    limit?: number;
    fiscalYear?: string;
  } = {},
): Promise<NpriRecord[]> {
  return searchNpriRecords(db, '', {
    ...options,
    substance: undefined,
  });
}

/**
 * Get NPRI records by substance.
 */
export async function getNpriBySubstance(
  db: D1Database,
  substance: string,
  options: {
    limit?: number;
    fiscalYear?: string;
  } = {},
): Promise<NpriRecord[]> {
  return searchNpriRecords(db, '', {
    substance,
    limit: options.limit ?? 100,
    fiscalYear: options.fiscalYear,
  });
}

/**
 * Get NPRI records by province.
 */
export async function getNpriByProvince(
  db: D1Database,
  province: string,
  options: {
    limit?: number;
    fiscalYear?: string;
  } = {},
): Promise<NpriRecord[]> {
  return searchNpriRecords(db, '', {
    province,
    limit: options.limit ?? 100,
    fiscalYear: options.fiscalYear,
  });
}

/* ------------------------------------------------------------------ */
/*  Ingestion Orchestrator                                             */
/* ------------------------------------------------------------------ */

/**
 * Ingest NPRI records into the database.
 *
 * Orchestrates:
 *   1. Initialize table (if requested)
 *   2. Fetch NPRI releases from CKAN
 *   3. Parse and normalize records into unified schema
 *   4. Deduplicate and persist to D1
 *
 * @param db - D1 database instance (null to dry-run)
 * @param options - Ingestion options
 * @returns Ingestion result with counts and errors
 */
export async function ingestNpri(
  db: D1Database | null,
  options: NpriIngestionOptions = {},
): Promise<NpriIngestionResult> {
  const startTime = Date.now();
  const result: NpriIngestionResult = {
    recordsFound: 0,
    recordsIngested: 0,
    newRecords: 0,
    errors: [],
    perSubstance: {},
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;

  try {
    // Phase 0: Initialize table if requested
    if (db && options.initializeTable) {
      log('[NPRI] Initializing npri_records table...');
      await initializeNpriTable(db);
    }

    const fiscalYears = options.fiscalYears ?? RECENT_FISCAL_YEARS.slice(-3);

    log(`[NPRI] Processing across ${fiscalYears.length} fiscal years`);

    // Phase 1: Fetch from CKAN
    log('[NPRI] Searching CKAN for NPRI packages...');
    try {
      const ckanPackages = await searchNpriCkanPackages(
        NPRI_SOURCES.NPRI_CKAN_QUERY,
        maxRecords,
      );

      log(`[NPRI] Found ${ckanPackages.length} NPRI packages via CKAN search`);

      // Phase 2-4: For each CKAN package, parse and persist
      for (const pkg of ckanPackages) {
        const records = await parseNpriCkanPackage(pkg, {
          sourceSystem: 'open-canada-ckan',
        });

        if (records.length === 0) continue;

        for (const record of records) {
          result.recordsFound++;

          const substanceKey = record.substanceName;

          if (!result.perSubstance[substanceKey]) {
            result.perSubstance[substanceKey] = { recordsFound: 0, recordsIngested: 0 };
          }
          result.perSubstance[substanceKey].recordsFound++;

          // Persist to database
          if (db) {
            const inserted = await upsertNpriRecord(db, record);
            if (inserted) {
              result.newRecords++;
            }
            result.recordsIngested++;
          }
        }
      }
    } catch (err) {
      const msg = `CKAN search/parse failed: ${(err as Error).message}`;
      result.errors.push(msg);
      log(`[NPRI] ${msg}`);
    }
  } catch (err) {
    const msg = `NPRI ingestion failed: ${(err as Error).message}`;
    result.errors.push(msg);
    log(`[NPRI] ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[NPRI] Done: ${result.recordsFound} found, ${result.recordsIngested} ingested, ${result.newRecords} new in ${result.durationMs}ms`);

  return result;
}
