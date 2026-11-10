// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Species at Risk Registry Ingestion — Quill
 *
 * Orchestrates the ingestion pipeline for Canada's Species at Risk Act (SARA)
 * registry data from the JSON API at species-registry.canada.ca.
 *
 * Pipeline:
 *   1. Fetch species data from the SARA JSON API
 *   2. Parse and normalize records into unified SpeciesAtRiskRecord schema
 *   3. Persist to D1 database with deduplication
 *   4. Enable search and query functions
 *
 * Sources:
 *   - SARA JSON API: https://species-registry.canada.ca/registre-especes/api/v1/
 *   - Species Registry Portal: https://species-registry.canada.ca/index-en.html
 *
 * Cross-reference opportunities:
 *   - Geospatial: critical habitat mapping
 *   - NPRI: pollutant releases in species habitat areas
 *   - Impact Assessment: federal project assessments affecting species
 */

import {
  fetchSaraSpecies,
  fetchAllSaraSpecies,
  fetchSaraSpeciesDetail,
  fetchSaraRecoveryStrategies,
  fetchSaraListingDecisions,
} from './fetcher.js';
import {
  parseSaraSpecies,
  parseSaraBatch,
  parseSaraResponse,
  normalizeStatus,
} from './parser.js';
import {
  SARA_SPECIES_DDL,
  SARA_SOURCES,
  SARA_STATUS_MAP,
  SARA_TAXONOMIC_GROUPS,
  DEFAULT_MAX_RECORDS,
  SaraError,
} from './constants.js';
import type {
  SpeciesAtRiskRecord,
  SpeciesStatus,
  SaraIngestionOptions,
  SaraIngestionResult,
  RawSaraSpecies,
  SaraApiResponse,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Re-exports for barrel                                              */
/* ------------------------------------------------------------------ */

export {
  fetchSaraSpecies,
  fetchAllSaraSpecies,
  fetchSaraSpeciesDetail,
  fetchSaraRecoveryStrategies,
  fetchSaraListingDecisions,
} from './fetcher.js';

export {
  parseSaraSpecies,
  parseSaraBatch,
  parseSaraResponse,
  normalizeStatus,
} from './parser.js';

export {
  SARA_SPECIES_DDL,
  SARA_SOURCES,
  SARA_STATUS_MAP,
  SARA_TAXONOMIC_GROUPS,
  DEFAULT_MAX_RECORDS,
  SaraError,
} from './constants.js';

export type {
  SpeciesAtRiskRecord,
  SpeciesStatus,
  SaraIngestionOptions,
  SaraIngestionResult,
  RawSaraSpecies,
  SaraApiResponse,
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
 * Initialize the species_at_risk_records table.
 */
export async function initializeSaraTable(db: D1Database): Promise<void> {
  await db.exec(SARA_SPECIES_DDL);
}

/**
 * Insert (or ignore) a Species at Risk record.
 *
 * @returns true if inserted, false if skipped (duplicate)
 */
async function upsertSaraRecord(
  db: D1Database,
  record: SpeciesAtRiskRecord,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO species_at_risk_records
      (id, species_name, scientific_name, taxonomic_group, status,
       assessment_date, listing_date, recovery_strategy_url,
       critical_habitat, province_territory, sara_species_id,
       source_url, source_system, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    record.speciesName,
    record.scientificName,
    record.taxonomicGroup,
    record.status,
    record.assessmentDate,
    record.listingDate,
    record.recoveryStrategyUrl,
    record.criticalHabitat === null ? null : record.criticalHabitat ? 1 : 0,
    record.provinceTerritory,
    record.saraSpeciesId,
    record.sourceUrl,
    record.sourceSystem,
    record.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}

/**
 * Check if a record already exists.
 */
export async function saraRecordExists(
  db: D1Database,
  record: SpeciesAtRiskRecord,
): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 FROM species_at_risk_records
     WHERE species_name = ? AND status = ? AND source_url = ?
     LIMIT 1`,
  ).bind(
    record.speciesName,
    record.status,
    record.sourceUrl,
  ).first();

  return row !== null;
}

/**
 * Check if the species_at_risk_records table exists.
 */
export async function saraTableExists(db: D1Database): Promise<boolean> {
  try {
    const row = await db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='species_at_risk_records'`,
    ).first();
    return row !== null;
  } catch {
    return false;
  }
}

/**
 * Get the latest ingestion date from the species_at_risk_records table.
 */
export async function getLatestSaraIngestionDate(db: D1Database): Promise<string | null> {
  const row = await db.prepare(
    'SELECT ingested_at FROM species_at_risk_records ORDER BY ingested_at DESC LIMIT 1',
  ).first<{ ingested_at: string }>();
  return row?.ingested_at ?? null;
}

/* ------------------------------------------------------------------ */
/*  Search Functions                                                   */
/* ------------------------------------------------------------------ */

/**
 * Search Species at Risk records by keyword across multiple fields.
 *
 * @param db - D1 database instance
 * @param query - Search terms
 * @param options - Search options (limit, status, taxonomicGroup)
 * @returns Matching SpeciesAtRiskRecord array
 */
export async function searchSaraRecords(
  db: D1Database,
  query: string,
  options: {
    limit?: number;
    status?: SpeciesStatus;
    taxonomicGroup?: string;
  } = {},
): Promise<SpeciesAtRiskRecord[]> {
  let sql = `SELECT * FROM species_at_risk_records WHERE 1=1`;
  const params: unknown[] = [];

  if (query) {
    sql += ` AND (
      species_name LIKE ? OR
      scientific_name LIKE ? OR
      taxonomic_group LIKE ? OR
      province_territory LIKE ?
    )`;
    const q = `%${query}%`;
    params.push(q, q, q, q);
  }

  if (options.status) {
    sql += ' AND status = ?';
    params.push(options.status);
  }

  if (options.taxonomicGroup) {
    sql += ' AND taxonomic_group = ?';
    params.push(options.taxonomicGroup);
  }

  sql += ' ORDER BY species_name ASC LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<SpeciesAtRiskRecord>();
  return result.results ?? [];
}

/**
 * Get Species at Risk records by status.
 */
export async function getSaraByStatus(
  db: D1Database,
  status: SpeciesStatus,
  options: {
    limit?: number;
    taxonomicGroup?: string;
  } = {},
): Promise<SpeciesAtRiskRecord[]> {
  return searchSaraRecords(db, '', {
    status,
    taxonomicGroup: options.taxonomicGroup,
    limit: options.limit ?? 100,
  });
}

/**
 * Get Species at Risk records by taxonomic group.
 */
export async function getSaraByGroup(
  db: D1Database,
  taxonomicGroup: string,
  options: {
    limit?: number;
    status?: SpeciesStatus;
  } = {},
): Promise<SpeciesAtRiskRecord[]> {
  return searchSaraRecords(db, '', {
    taxonomicGroup,
    status: options.status,
    limit: options.limit ?? 100,
  });
}

/**
 * Get Species at Risk records by province/territory.
 */
export async function getSaraByProvince(
  db: D1Database,
  province: string,
  options: {
    limit?: number;
    status?: SpeciesStatus;
  } = {},
): Promise<SpeciesAtRiskRecord[]> {
  return searchSaraRecords(db, province, {
    limit: options.limit ?? 100,
    status: options.status,
  });
}

/* ------------------------------------------------------------------ */
/*  Ingestion Orchestrator                                             */
/* ------------------------------------------------------------------ */

/**
 * Ingest Species at Risk records into the database.
 *
 * Orchestrates:
 *   1. Initialize table (if requested)
 *   2. Fetch species from SARA JSON API
 *   3. Parse and normalize records into unified schema
 *   4. Deduplicate and persist to D1
 *
 * @param db - D1 database instance (null to dry-run)
 * @param options - Ingestion options
 * @returns Ingestion result with counts and errors
 */
export async function ingestSaraSpecies(
  db: D1Database | null,
  options: SaraIngestionOptions = {},
): Promise<SaraIngestionResult> {
  const startTime = Date.now();
  const result: SaraIngestionResult = {
    recordsFound: 0,
    recordsIngested: 0,
    newRecords: 0,
    errors: [],
    perStatus: {},
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;

  try {
    // Phase 0: Initialize table if requested
    if (db && options.initializeTable) {
      log('[SARA] Initializing species_at_risk_records table...');
      await initializeSaraTable(db);
    }

    // Phase 1: Fetch all species from SARA API
    log('[SARA] Fetching species from SARA JSON API...');
    try {
      const speciesList = await fetchAllSaraSpecies({
        maxRecords,
      });

      log(`[SARA] Found ${speciesList.length} species via SARA API`);

      // Phase 2-4: Parse and persist
      const records = await parseSaraBatch(speciesList, {
        sourceSystem: 'sara-api',
      });

      for (const record of records) {
        result.recordsFound++;

        const statusKey = record.status;
        if (!result.perStatus[statusKey]) {
          result.perStatus[statusKey] = { recordsFound: 0, recordsIngested: 0 };
        }
        result.perStatus[statusKey].recordsFound++;

        // Persist to database
        if (db) {
          const inserted = await upsertSaraRecord(db, record);
          if (inserted) {
            result.newRecords++;
          }
          result.recordsIngested++;
        }
      }
    } catch (err) {
      const msg = `SARA API fetch/parse failed: ${(err as Error).message}`;
      result.errors.push(msg);
      log(`[SARA] ${msg}`);
    }
  } catch (err) {
    const msg = `SARA ingestion failed: ${(err as Error).message}`;
    result.errors.push(msg);
    log(`[SARA] ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[SARA] Done: ${result.recordsFound} found, ${result.recordsIngested} ingested, ${result.newRecords} new in ${result.durationMs}ms`);

  return result;
}
