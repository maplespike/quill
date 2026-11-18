// SPDX-License-Identifier: AGPL-3.0-only
/**
export { parseHealthDataRecord, parseHealthDataRecords } from './parser.js';
 * Health Data Ingestion — Quill
 *
 * Unified orchestration module for deep health-data ingestion from:
 *   - PHAC  — Public Health Agency of Canada (disease surveillance, opioids, immunization, drug shortages)
 *   - CFIA  — Canadian Food Inspection Agency (food recalls, import refusals, inspections)
 *   - CIHI  — Canadian Institute for Health Information (wait times, health spending)
 *   - CADTH — Canadian Agency for Drugs and Technologies in Health (drug recommendations)
 *   - PMPRB — Patented Medicine Prices Review Board (drug pricing decisions)
 *
 * This module provides deep data ingestion from
 * CKAN open data portals and the following health agencies' public websites:
 *   - Health Infobase API (PHAC)
 *   - CIHI website (wait times, health spending)
 *   - CADTH website (drug recommendations)
 *   - PMPRB website (annual reports)
 *
 * Pipeline:
 *   1. Initialize D1 tables (if requested)
 *   2. Fetch records from each data source (CKAN, HTML, RSS)
 *   3. Parse and normalize into typed records
 *   4. Deduplicate and persist to D1
 *   5. Return aggregated ingestion results
 *
 * Cross-source analytics:
 *   - PHAC opioids → CADTH recommendations (opioid therapies)
 *   - PMPRB pricing → CADTH recommendations (review → pricing pipeline)
 *   - CFIA recalls → Health Canada recalls (overlapping product safety data)
 *   - CIHI wait times → provincial health spending (resource allocation)
 */

import {
  ingestAllPhac,
  ingestPhacDiseaseSurveillance,
  ingestPhacOpioidDeaths,
  ingestPhacImmunization,
  ingestPhacDrugShortages,
  initializePhacTables,
} from './phac.js';

import {
  ingestAllCfia,
  ingestCfiaRecalls,
  ingestCfiaImportRefusals,
  ingestCfiaInspections,
  initializeCfiaTables,
} from './cfia.js';

import {
  ingestAllCihi,
  ingestCihiWaitTimes,
  ingestCihiHealthSpending,
  initializeCihiTables,
} from './cihi.js';

import {
  ingestAllCadth,
  ingestCadthRecommendations,
  initializeCadthTables,
} from './cadth.js';

import {
  ingestAllPmprb,
  ingestPmprbPricing,
  initializePmprbTables,
} from './pmpb.js';

import {
  ALL_HEALTH_DATA_SOURCES,
  SOURCE_CATEGORIES,
  DEFAULT_MAX_RECORDS,
  HEALTH_DATA_DDL,
  HealthDataError,
} from './constants.js';

import type {
  HealthDataSource,
  HealthDataCategory,
  HealthDataIngestionOptions,
  HealthDataIngestionResult,
  HealthDataRecord,
  PhacDiseaseSurveillance,
  PhacOpioidDeath,
  PhacImmunization,
  CfiaRecall,
  CfiaImportRefusal,
  CfiaInspection,
  CihiWaitTime,
  CihiHealthSpending,
  CadthRecommendation,
  PmprbPricing,
  DrugShortage,
  LongTermCareInspection,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Re-exports for barrel                                              */
/* ------------------------------------------------------------------ */

// Types
export type {
  HealthDataSource,
  HealthDataCategory,
  HealthDataIngestionOptions,
  HealthDataIngestionResult,
  HealthDataRecord,
  PhacDiseaseSurveillance,
  PhacOpioidDeath,
  PhacImmunization,
  CfiaRecall,
  CfiaImportRefusal,
  CfiaInspection,
  CihiWaitTime,
  CihiHealthSpending,
  CadthRecommendation,
  PmprbPricing,
  DrugShortage,
  LongTermCareInspection,
} from './types.js';

// PHAC functions
export {
  ingestPhacDiseaseSurveillance,
  ingestPhacOpioidDeaths,
  ingestPhacImmunization,
  ingestPhacDrugShortages,
  ingestAllPhac,
  initializePhacTables,
} from './phac.js';

// CFIA functions
export {
  ingestCfiaRecalls,
  ingestCfiaImportRefusals,
  ingestCfiaInspections,
  ingestAllCfia,
  initializeCfiaTables,
} from './cfia.js';

// CIHI functions
export {
  ingestCihiWaitTimes,
  ingestCihiHealthSpending,
  ingestAllCihi,
  initializeCihiTables,
} from './cihi.js';

// CADTH functions
export {
  ingestCadthRecommendations,
  ingestAllCadth,
  initializeCadthTables,
} from './cadth.js';

// PMPRB functions
export {
  ingestPmprbPricing,
  ingestAllPmprb,
  initializePmprbTables,
} from './pmpb.js';

/* ------------------------------------------------------------------ */
/*  D1Database Interface                                               */
/* ------------------------------------------------------------------ */

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
/*  Table Initialization                                               */
/* ------------------------------------------------------------------ */

/**
 * Initialize all health-data D1 tables.
 */
export async function initializeHealthDataTables(db: D1Database): Promise<void> {
  for (const ddl of HEALTH_DATA_DDL) {
    await db.exec(ddl);
  }
}

/* ------------------------------------------------------------------ */
/*  Health-Data Ingestion Options Defaults                             */
/* ------------------------------------------------------------------ */

export { ALL_HEALTH_DATA_SOURCES, HEALTH_DATA_DDL, DEFAULT_MAX_RECORDS as HEALTH_DATA_DEFAULT_MAX_RECORDS } from './constants.js';
export { HealthDataError } from './constants.js';

/* ------------------------------------------------------------------ */
/*  Source-Specific Ingestion                                          */
/* ------------------------------------------------------------------ */

/** Source-level ingestion dispatcher. */
async function ingestSource(
  db: D1Database | null,
  source: HealthDataSource,
  maxRecords: number,
): Promise<{ found: number; inserted: number; errors: string[] }> {
  switch (source) {
    case 'phac':
      return ingestAllPhac(db, maxRecords);
    case 'cfia':
      return ingestAllCfia(db, maxRecords);
    case 'cihi':
      return ingestAllCihi(db, maxRecords);
    case 'cadth':
      return ingestAllCadth(db, maxRecords);
    case 'pmpb':
      return ingestAllPmprb(db, maxRecords);
    default:
      return { found: 0, inserted: 0, errors: [`Unknown source: ${source}`] };
  }
}

/* ------------------------------------------------------------------ */
/*  Ingestion Orchestrator                                             */
/* ------------------------------------------------------------------ */

/**
 * Ingest comprehensive health-data records into the database.
 *
 * Orchestrates ingestion across all configured health data sources:
 *   1. Initialize D1 tables (if requested)
 *   2. Fetch records from each data source
 *   3. Parse and normalize records
 *   4. Deduplicate and persist to D1
 *
 * @param db - D1 database instance (null to dry-run)
 * @param options - Ingestion options
 * @returns Aggregated ingestion result with per-source counts and errors
 */
export async function ingestHealthData(
  db: D1Database | null,
  options: HealthDataIngestionOptions = {},
): Promise<HealthDataIngestionResult> {
  const startTime = Date.now();
  const result: HealthDataIngestionResult = {
    recordsFound: 0,
    recordsIngested: 0,
    newRecords: 0,
    errors: [],
    perSource: {},
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  const sources = options.sources ?? ALL_HEALTH_DATA_SOURCES;

  // Initialize per-source counters
  for (const src of sources) {
    result.perSource[src] = { recordsFound: 0, recordsIngested: 0 };
  }

  try {
    // Phase 0: Initialize tables if requested
    if (db && options.initializeTable) {
      log('[HEALTH-DATA] Initializing all health-data tables...');
      await initializeHealthDataTables(db);
    }

    // Phase 1: Fetch and process each source
    for (const source of sources) {
      log(`[HEALTH-DATA] Fetching ${source} records...`);

      try {
        const { found, inserted, errors } = await ingestSource(db, source, maxRecords);

        result.errors.push(...errors);
        result.recordsFound += found;
        result.recordsIngested += inserted;
        result.perSource[source] = { recordsFound: found, recordsIngested: inserted };

        log(`[HEALTH-DATA] ${source}: ${found} found, ${inserted} ingested`);
      } catch (err) {
        const msg = `${source} ingestion failed: ${(err as Error).message}`;
        result.errors.push(msg);
        log(`[HEALTH-DATA] ${msg}`);
      }
    }
  } catch (err) {
    const msg = `Health-data ingestion orchestration failed: ${(err as Error).message}`;
    result.errors.push(msg);
    log(`[HEALTH-DATA] ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  result.newRecords = result.recordsIngested; // simplified — each insert is new

  log(
    `[HEALTH-DATA] Done: ${result.recordsFound} found, ` +
    `${result.recordsIngested} ingested, ${result.newRecords} new ` +
    `in ${result.durationMs}ms across ${sources.length} sources`,
  );

  return result;
}
