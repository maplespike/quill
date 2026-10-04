/**
 * Health Canada Ingestion — Quill
 *
 * Orchestrates the ingestion pipeline for Health Canada regulated product records:
 *   - Drug Product Database (DPD) — approved pharmaceutical drugs
 *   - Medical Devices Active License Listing (MDALL) — licensed medical devices
 *   - Licensed Natural Health Products (LNHP) — licensed natural health products
 *   - Recalls and Safety Alerts — product recalls and safety advisories
 *
 * Pipeline:
 *   1. Fetch product records from Health Canada APIs / RSS
 *   2. Parse and normalize records into unified HealthCanadaRecord schema
 *   3. Persist to D1 database with deduplication
 *   4. Enable search and query functions
 *
 * Cross-reference opportunities:
 *   - Corporate: manufacturers linked to lobbying/procurement
 *   - Influence: pharmaceutical company influence on policy
 *   - Committees: parliamentary testimony on drug safety/pricing
 *   - Gazette: proposed regulations under Food and Drugs Act
 */

import {
  fetchHealthCanadaProducts,
  fetchAllHealthCanadaProducts,
} from './fetcher.js';
import {
  parseProductRecord,
  parseProductBatch,
  normalizeLicenseStatus,
  normalizeProductType,
} from './parser.js';
import {
  HEALTH_CANADA_DDL,
  HC_SOURCES,
  HC_PRODUCT_TYPE_CONFIG,
  HC_LICENSE_STATUS_MAP,
  ALL_HC_PRODUCT_TYPES,
  DEFAULT_MAX_RECORDS,
  HealthCanadaError,
} from './constants.js';
import type {
  HealthCanadaRecord,
  HealthCanadaProductType,
  HealthCanadaLicenseStatus,
  HealthCanadaIngestionOptions,
  HealthCanadaIngestionResult,
  RawHealthCanadaRecord,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Re-exports for barrel                                              */
/* ------------------------------------------------------------------ */

export {
  fetchHealthCanadaProducts,
  fetchAllHealthCanadaProducts,
} from './fetcher.js';

export {
  parseProductRecord,
  parseProductBatch,
  normalizeLicenseStatus,
  normalizeProductType,
} from './parser.js';

export {
  HEALTH_CANADA_DDL,
  HC_SOURCES,
  HC_PRODUCT_TYPE_CONFIG,
  HC_LICENSE_STATUS_MAP,
  ALL_HC_PRODUCT_TYPES,
  DEFAULT_MAX_RECORDS,
  HealthCanadaError,
} from './constants.js';

export type {
  HealthCanadaRecord,
  HealthCanadaProductType,
  HealthCanadaLicenseStatus,
  HealthCanadaIngestionOptions,
  HealthCanadaIngestionResult,
  RawHealthCanadaRecord,
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
 * Initialize the health_canada_records table.
 */
export async function initializeHealthCanadaTable(db: D1Database): Promise<void> {
  await db.exec(HEALTH_CANADA_DDL);
}

/**
 * Upsert (insert or ignore) a Health Canada record.
 *
 * @returns true if inserted, false if skipped (duplicate)
 */
async function upsertHealthCanadaRecord(
  db: D1Database,
  record: HealthCanadaRecord,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO health_canada_records
      (id, product_name, product_type, license_number, license_status,
       manufacturer, therapeutic_area, active_ingredient, din, npn,
       license_date, expiry_date, recall_severity, recall_reason,
       recall_classification, dosage_form, route_of_administration,
       company_status, source_url, source_system, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    record.productName,
    record.productType,
    record.licenseNumber,
    record.licenseStatus,
    record.manufacturer,
    record.therapeuticArea,
    record.activeIngredient,
    record.din,
    record.npn,
    record.licenseDate,
    record.expiryDate,
    record.recallSeverity,
    record.recallReason,
    record.recallClassification,
    record.dosageForm,
    record.routeOfAdministration,
    record.companyStatus,
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
export async function healthCanadaRecordExists(
  db: D1Database,
  id: string,
): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 FROM health_canada_records WHERE id = ? LIMIT 1`,
  ).bind(id).first();

  return row !== null;
}

/**
 * Check if the health_canada_records table exists.
 */
export async function healthCanadaTableExists(db: D1Database): Promise<boolean> {
  try {
    const row = await db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='health_canada_records'`,
    ).first();
    return row !== null;
  } catch {
    return false;
  }
}

/**
 * Get the latest ingestion date from the health_canada_records table.
 */
export async function getLatestHealthCanadaIngestionDate(db: D1Database): Promise<string | null> {
  const row = await db.prepare(
    'SELECT ingested_at FROM health_canada_records ORDER BY ingested_at DESC LIMIT 1',
  ).first<{ ingested_at: string }>();
  return row?.ingested_at ?? null;
}

/* ------------------------------------------------------------------ */
/*  Search Functions                                                   */
/* ------------------------------------------------------------------ */

/**
 * Search Health Canada records by keyword across multiple fields.
 */
export async function searchHealthCanadaRecords(
  db: D1Database,
  query: string,
  options: {
    limit?: number;
    productType?: HealthCanadaProductType;
    licenseStatus?: HealthCanadaLicenseStatus;
    manufacturer?: string;
  } = {},
): Promise<HealthCanadaRecord[]> {
  let sql = `SELECT * FROM health_canada_records WHERE 1=1`;
  const params: unknown[] = [];

  if (query) {
    sql += ` AND (
      product_name LIKE ? OR
      manufacturer LIKE ? OR
      active_ingredient LIKE ? OR
      license_number LIKE ? OR
      therapeutic_area LIKE ?
    )`;
    const q = `%${query}%`;
    params.push(q, q, q, q, q);
  }

  if (options.productType) {
    sql += ' AND product_type = ?';
    params.push(options.productType);
  }

  if (options.licenseStatus) {
    sql += ' AND license_status = ?';
    params.push(options.licenseStatus);
  }

  if (options.manufacturer) {
    sql += ' AND manufacturer LIKE ?';
    params.push(`%${options.manufacturer}%`);
  }

  sql += ' ORDER BY license_date DESC NULLS LAST LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<HealthCanadaRecord>();
  return result.results ?? [];
}

/**
 * Get Health Canada records by product type.
 */
export async function getHealthCanadaByType(
  db: D1Database,
  productType: HealthCanadaProductType,
  options: {
    limit?: number;
    licenseStatus?: HealthCanadaLicenseStatus;
  } = {},
): Promise<HealthCanadaRecord[]> {
  return searchHealthCanadaRecords(db, '', {
    productType,
    licenseStatus: options.licenseStatus,
    limit: options.limit ?? 100,
  });
}

/**
 * Get Health Canada records by manufacturer.
 */
export async function getHealthCanadaByManufacturer(
  db: D1Database,
  manufacturer: string,
  options: {
    limit?: number;
    productType?: HealthCanadaProductType;
  } = {},
): Promise<HealthCanadaRecord[]> {
  return searchHealthCanadaRecords(db, manufacturer, {
    productType: options.productType,
    limit: options.limit ?? 100,
  });
}

/**
 * Get recalls filtered by severity.
 */
export async function getHealthCanadaRecallsBySeverity(
  db: D1Database,
  severity: string,
  options: {
    limit?: number;
  } = {},
): Promise<HealthCanadaRecord[]> {
  const sql = `SELECT * FROM health_canada_records
    WHERE product_type = 'recall' AND recall_severity LIKE ?
    ORDER BY license_date DESC NULLS LAST LIMIT ?`;
  const stmt = db.prepare(sql).bind(`%${severity}%`, options.limit ?? 50);
  const result = await stmt.all<HealthCanadaRecord>();
  return result.results ?? [];
}

/**
 * Get active (currently licensed) products.
 */
export async function getActiveHealthCanadaProducts(
  db: D1Database,
  options: {
    productType?: HealthCanadaProductType;
    limit?: number;
  } = {},
): Promise<HealthCanadaRecord[]> {
  return searchHealthCanadaRecords(db, '', {
    productType: options.productType,
    licenseStatus: 'active',
    limit: options.limit ?? 100,
  });
}

/**
 * Get products expiring soon (within a given number of days).
 */
export async function getExpiringHealthCanadaProducts(
  db: D1Database,
  daysAhead: number = 90,
  options: {
    productType?: HealthCanadaProductType;
    limit?: number;
  } = {},
): Promise<HealthCanadaRecord[]> {
  let sql = `SELECT * FROM health_canada_records
    WHERE expiry_date IS NOT NULL
    AND date(expiry_date) BETWEEN date('now') AND date('now', '+${daysAhead} days')`;
  const params: unknown[] = [];

  if (options.productType) {
    sql += ' AND product_type = ?';
    params.push(options.productType);
  }

  sql += ' ORDER BY expiry_date ASC LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<HealthCanadaRecord>();
  return result.results ?? [];
}

/* ------------------------------------------------------------------ */
/*  Ingestion Orchestrator                                             */
/* ------------------------------------------------------------------ */

/**
 * Ingest Health Canada regulated product records into the database.
 *
 * Orchestrates:
 *   1. Initialize table (if requested)
 *   2. Fetch product records from Health Canada APIs / RSS
 *   3. Parse and normalize records into unified schema
 *   4. Deduplicate and persist to D1
 *
 * @param db - D1 database instance (null to dry-run)
 * @param options - Ingestion options
 * @returns Ingestion result with counts and errors
 */
export async function ingestHealthCanada(
  db: D1Database | null,
  options: HealthCanadaIngestionOptions = {},
): Promise<HealthCanadaIngestionResult> {
  const startTime = Date.now();
  const result: HealthCanadaIngestionResult = {
    recordsFound: 0,
    recordsIngested: 0,
    newRecords: 0,
    errors: [],
    perType: {},
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  const productTypes = options.productTypes ?? ALL_HC_PRODUCT_TYPES;

  // Initialize per-type counters
  for (const pt of productTypes) {
    result.perType[pt] = { recordsFound: 0, recordsIngested: 0 };
  }

  try {
    // Phase 0: Initialize table if requested
    if (db && options.initializeTable) {
      log('[HC] Initializing health_canada_records table...');
      await initializeHealthCanadaTable(db);
    }

    // Phase 1: Fetch and process each product type
    for (const productType of productTypes) {
      log(`[HC] Fetching ${productType} records...`);

      try {
        const { records: rawRecords, errors: fetchErrors } = await fetchHealthCanadaProducts(
          productType,
          { limit: maxRecords },
        );

        result.errors.push(...fetchErrors);
        log(`[HC] Found ${rawRecords.length} raw ${productType} records`);

        // Get the configured source system for this type
        const sourceSystem = HC_PRODUCT_TYPE_CONFIG[productType].sourceSystem;

        // Phase 2-4: Parse and persist
        const records = await parseProductBatch(rawRecords, {
          sourceSystem,
          productType,
        });

        for (const record of records) {
          result.recordsFound++;
          result.perType[productType].recordsFound++;

          // Persist to database
          if (db) {
            const inserted = await upsertHealthCanadaRecord(db, record);
            if (inserted) {
              result.newRecords++;
            }
            result.recordsIngested++;
            result.perType[productType].recordsIngested++;
          }
        }
      } catch (err) {
        const msg = `HC ${productType} fetch/parse failed: ${(err as Error).message}`;
        result.errors.push(msg);
        log(`[HC] ${msg}`);
      }
    }
  } catch (err) {
    const msg = `HC ingestion failed: ${(err as Error).message}`;
    result.errors.push(msg);
    log(`[HC] ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[HC] Done: ${result.recordsFound} found, ${result.recordsIngested} ingested, ${result.newRecords} new in ${result.durationMs}ms`);

  return result;
}
