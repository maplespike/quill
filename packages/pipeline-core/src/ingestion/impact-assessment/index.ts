/**
 * Impact Assessment Agency of Canada Ingestion — Quill
 *
 * Orchestrates the ingestion pipeline for federal project impact assessments
 * from the Impact Assessment Agency of Canada (IAAC).
 *
 * Pipeline:
 *   1. Fetch project assessment records from IAAC registry / CKAN
 *   2. Parse and normalize records into unified ImpactAssessmentRecord schema
 *   3. Persist to D1 database with deduplication
 *   4. Enable search and query functions
 *
 * Sources:
 *   - IAAC Project Registry: https://iaac-aeic.gc.ca/050/evaluations/search
 *   - open.canada.ca CKAN
 *
 * Cross-reference opportunities:
 *   - NPRI: facility pollution in areas under assessment
 *   - Species at Risk: assessments affecting species habitat
 *   - Corporate: proponents with lobbying/procurement records
 *   - Oversight: follow-up programs and compliance
 */

import {
  fetchIaacProjects,
  fetchIaacAssessmentDetail,
} from './fetcher.js';
import {
  parseIaacRecord,
  parseIaacBatch,
  normalizeDecision,
  normalizeAssessmentType,
} from './parser.js';
import {
  IAAC_ASSESSMENTS_DDL,
  IAAC_SOURCES,
  IAAC_DECISION_MAP,
  IAAC_ASSESSMENT_TYPE_MAP,
  IAAC_PROJECT_TYPES,
  DEFAULT_MAX_RECORDS,
  IaacError,
} from './constants.js';
import type {
  ImpactAssessmentRecord,
  ImpactAssessmentDecision,
  AssessmentType,
  IaacIngestionOptions,
  IaacIngestionResult,
  RawImpactAssessmentRecord,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Re-exports for barrel                                              */
/* ------------------------------------------------------------------ */

export {
  fetchIaacProjects,
  fetchIaacAssessmentDetail,
} from './fetcher.js';

export {
  parseIaacRecord,
  parseIaacBatch,
  normalizeDecision,
  normalizeAssessmentType,
} from './parser.js';

export {
  IAAC_ASSESSMENTS_DDL,
  IAAC_SOURCES,
  IAAC_DECISION_MAP,
  IAAC_ASSESSMENT_TYPE_MAP,
  IAAC_PROJECT_TYPES,
  DEFAULT_MAX_RECORDS,
  IaacError,
} from './constants.js';

export type {
  ImpactAssessmentRecord,
  ImpactAssessmentDecision,
  AssessmentType,
  IaacIngestionOptions,
  IaacIngestionResult,
  RawImpactAssessmentRecord,
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
 * Initialize the impact_assessment_records table.
 */
export async function initializeIaacTable(db: D1Database): Promise<void> {
  await db.exec(IAAC_ASSESSMENTS_DDL);
}

/**
 * Insert (or ignore) an Impact Assessment record.
 *
 * @returns true if inserted, false if skipped (duplicate)
 */
async function upsertIaacRecord(
  db: D1Database,
  record: ImpactAssessmentRecord,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO impact_assessment_records
      (id, project_name, proponent, project_type, location, province,
       decision, decision_date, assessment_type, conditions_url,
       assessment_report_url, iaac_reference_number, ceaa_reference_number,
       federal_provincial_agreement, source_url, source_system, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    record.projectName,
    record.proponent,
    record.projectType,
    record.location,
    record.province,
    record.decision,
    record.decisionDate,
    record.assessmentType,
    record.conditionsUrl,
    record.assessmentReportUrl,
    record.iaacReferenceNumber,
    record.ceaaReferenceNumber,
    record.federalProvincialAgreement === null ? null : record.federalProvincialAgreement ? 1 : 0,
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
export async function iaacRecordExists(
  db: D1Database,
  record: ImpactAssessmentRecord,
): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 FROM impact_assessment_records
     WHERE project_name = ? AND decision = ? AND source_url = ?
     LIMIT 1`,
  ).bind(
    record.projectName,
    record.decision,
    record.sourceUrl,
  ).first();

  return row !== null;
}

/**
 * Check if the impact_assessment_records table exists.
 */
export async function iaacTableExists(db: D1Database): Promise<boolean> {
  try {
    const row = await db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='impact_assessment_records'`,
    ).first();
    return row !== null;
  } catch {
    return false;
  }
}

/**
 * Get the latest ingestion date from the impact_assessment_records table.
 */
export async function getLatestIaacIngestionDate(db: D1Database): Promise<string | null> {
  const row = await db.prepare(
    'SELECT ingested_at FROM impact_assessment_records ORDER BY ingested_at DESC LIMIT 1',
  ).first<{ ingested_at: string }>();
  return row?.ingested_at ?? null;
}

/* ------------------------------------------------------------------ */
/*  Search Functions                                                   */
/* ------------------------------------------------------------------ */

/**
 * Search Impact Assessment records by keyword across multiple fields.
 *
 * @param db - D1 database instance
 * @param query - Search terms
 * @param options - Search options (limit, decision, projectType, province)
 * @returns Matching ImpactAssessmentRecord array
 */
export async function searchIaacRecords(
  db: D1Database,
  query: string,
  options: {
    limit?: number;
    decision?: ImpactAssessmentDecision;
    projectType?: string;
    province?: string;
  } = {},
): Promise<ImpactAssessmentRecord[]> {
  let sql = `SELECT * FROM impact_assessment_records WHERE 1=1`;
  const params: unknown[] = [];

  if (query) {
    sql += ` AND (
      project_name LIKE ? OR
      proponent LIKE ? OR
      project_type LIKE ? OR
      location LIKE ? OR
      province LIKE ?
    )`;
    const q = `%${query}%`;
    params.push(q, q, q, q, q);
  }

  if (options.decision) {
    sql += ' AND decision = ?';
    params.push(options.decision);
  }

  if (options.projectType) {
    sql += ' AND project_type LIKE ?';
    params.push(`%${options.projectType}%`);
  }

  if (options.province) {
    sql += ' AND province = ?';
    params.push(options.province);
  }

  sql += ' ORDER BY decision_date DESC NULLS LAST LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<ImpactAssessmentRecord>();
  return result.results ?? [];
}

/**
 * Get Impact Assessment records by decision.
 */
export async function getIaacByDecision(
  db: D1Database,
  decision: ImpactAssessmentDecision,
  options: {
    limit?: number;
    province?: string;
  } = {},
): Promise<ImpactAssessmentRecord[]> {
  return searchIaacRecords(db, '', {
    decision,
    province: options.province,
    limit: options.limit ?? 100,
  });
}

/**
 * Get Impact Assessment records by proponent.
 */
export async function getIaacByProponent(
  db: D1Database,
  proponent: string,
  options: {
    limit?: number;
    decision?: ImpactAssessmentDecision;
  } = {},
): Promise<ImpactAssessmentRecord[]> {
  return searchIaacRecords(db, proponent, {
    decision: options.decision,
    limit: options.limit ?? 100,
  });
}

/**
 * Get Impact Assessment records by project type.
 */
export async function getIaacByProjectType(
  db: D1Database,
  projectType: string,
  options: {
    limit?: number;
    province?: string;
  } = {},
): Promise<ImpactAssessmentRecord[]> {
  return searchIaacRecords(db, '', {
    projectType,
    province: options.province,
    limit: options.limit ?? 100,
  });
}

/* ------------------------------------------------------------------ */
/*  Ingestion Orchestrator                                             */
/* ------------------------------------------------------------------ */

/**
 * Ingest Impact Assessment records into the database.
 *
 * Orchestrates:
 *   1. Initialize table (if requested)
 *   2. Fetch project assessments from IAAC registry / CKAN
 *   3. Parse and normalize records into unified schema
 *   4. Deduplicate and persist to D1
 *
 * @param db - D1 database instance (null to dry-run)
 * @param options - Ingestion options
 * @returns Ingestion result with counts and errors
 */
export async function ingestIaacAssessments(
  db: D1Database | null,
  options: IaacIngestionOptions = {},
): Promise<IaacIngestionResult> {
  const startTime = Date.now();
  const result: IaacIngestionResult = {
    recordsFound: 0,
    recordsIngested: 0,
    newRecords: 0,
    errors: [],
    perDecision: {},
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;

  try {
    // Phase 0: Initialize table if requested
    if (db && options.initializeTable) {
      log('[IAAC] Initializing impact_assessment_records table...');
      await initializeIaacTable(db);
    }

    // Phase 1: Fetch from IAAC sources
    log('[IAAC] Fetching project assessments from IAAC registry...');
    try {
      const { records: rawRecords, errors: fetchErrors } = await fetchIaacProjects({
        limit: maxRecords,
      });

      result.errors.push(...fetchErrors);
      log(`[IAAC] Found ${rawRecords.length} raw records`);

      // Phase 2-4: Parse and persist
      const records = await parseIaacBatch(rawRecords, {
        sourceSystem: 'iaac-web',
      });

      for (const record of records) {
        result.recordsFound++;

        const decisionKey = record.decision;
        if (!result.perDecision[decisionKey]) {
          result.perDecision[decisionKey] = { recordsFound: 0, recordsIngested: 0 };
        }
        result.perDecision[decisionKey].recordsFound++;

        // Persist to database
        if (db) {
          const inserted = await upsertIaacRecord(db, record);
          if (inserted) {
            result.newRecords++;
          }
          result.recordsIngested++;
        }
      }
    } catch (err) {
      const msg = `IAAC fetch/parse failed: ${(err as Error).message}`;
      result.errors.push(msg);
      log(`[IAAC] ${msg}`);
    }
  } catch (err) {
    const msg = `IAAC ingestion failed: ${(err as Error).message}`;
    result.errors.push(msg);
    log(`[IAAC] ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[IAAC] Done: ${result.recordsFound} found, ${result.recordsIngested} ingested, ${result.newRecords} new in ${result.durationMs}ms`);

  return result;
}
