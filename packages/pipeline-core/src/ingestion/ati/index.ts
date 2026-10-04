/**
 * ATI (Access to Information) Ingestion — Quill
 *
 * Orchestrates the ingestion pipeline for completed ATI request data
 * from the Government of Canada's open.canada.ca portal and individual
 * department ATI pages.
 *
 * Pipeline:
 *   1. Fetch raw ATI records from CKAN (open.canada.ca) / department pages
 *   2. Parse and normalize records into unified AtiRecord schema
 *   3. Persist to D1 database with deduplication
 *   4. Enable search and query functions
 *
 * Sources:
 *   - open.canada.ca ATI portal (CKAN): https://open.canada.ca/en/ati
 *   - Individual department ATI completion pages
 *
 * Cross-reference opportunities:
 *   - Lobbying: are heavily lobbied departments also subject to more ATI requests?
 *   - Oversight: do OAG audit findings correlate with ATI request volumes?
 *   - Procurement: ATI releases about contract awards
 */

import {
  fetchAtiReleases,
  fetchAllAtiReleases,
  searchAtiCkanPackages,
  fetchAtiCkanPackage,
  fetchAtiResource,
} from './fetcher.js';
import {
  parseAtiRecord,
  parseAtiBatch,
  parseAtiCkanPackage,
  normalizeDisposition,
} from './parser.js';
import {
  ATI_DEPARTMENTS,
  ATI_DEPARTMENT_ACRONYM_MAP,
  ATI_SOURCES,
  ATI_CKAN_PACKAGE_IDS,
  RECENT_FISCAL_YEARS,
  DEFAULT_MAX_RECORDS,
  AtiError,
} from './constants.js';
import type {
  AtiRecord,
  AtiDisposition,
  AtiIngestionOptions,
  AtiIngestionResult,
  RawAtiRecord,
  RawAtiCkanPackage,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Re-exports for barrel                                              */
/* ------------------------------------------------------------------ */

export {
  fetchAtiReleases,
  fetchAllAtiReleases,
  searchAtiCkanPackages,
  fetchAtiCkanPackage,
  fetchAtiResource,
} from './fetcher.js';

export {
  parseAtiRecord,
  parseAtiBatch,
  parseAtiCkanPackage,
  normalizeDisposition,
} from './parser.js';

export {
  ATI_DEPARTMENTS,
  ATI_DEPARTMENT_ACRONYM_MAP,
  ATI_SOURCES,
  ATI_CKAN_PACKAGE_IDS,
  RECENT_FISCAL_YEARS,
  DEFAULT_MAX_RECORDS,
  AtiError,
} from './constants.js';

export type {
  AtiRecord,
  AtiDisposition,
  AtiIngestionOptions,
  AtiIngestionResult,
  RawAtiRecord,
  RawAtiCkanPackage,
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
/*  DDL — Database Schema Definition                                   */
/* ------------------------------------------------------------------ */

/**
 * DDL for the ati_records table.
 *
 * Stores completed Access to Information request records from federal
 * government departments. Tracks what was requested, how much was
 * disclosed, and how the department responded.
 *
 * Primary key: SHA-256 hash of record content for deduplication.
 */
export const ATI_RECORDS_DDL = `
-- Completed Access to Information (ATI) request records
CREATE TABLE IF NOT EXISTS ati_records (
  id TEXT PRIMARY KEY,

  -- Department / institution
  department TEXT NOT NULL,
  department_acronym TEXT,

  -- Request details
  request_number TEXT NOT NULL,
  summary TEXT,

  -- Outcome
  disposition TEXT NOT NULL CHECK(disposition IN (
    'disclosed',
    'disclosed-part',
    'exempted',
    'excluded',
    'no-records',
    'transferred',
    'abandoned',
    'pending',
    'unknown'
  )),

  -- Page counts
  pages_released INTEGER,
  pages_withheld INTEGER,

  -- Temporal
  date_completed TEXT,
  fiscal_year TEXT,

  -- Provenance
  source_url TEXT NOT NULL,
  ckan_package_id TEXT,
  ckan_resource_id TEXT,
  source_system TEXT NOT NULL DEFAULT 'open-canada-ckan',

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(request_number, department, disposition, source_url)
);

CREATE INDEX IF NOT EXISTS idx_ati_department ON ati_records(department);
CREATE INDEX IF NOT EXISTS idx_ati_disposition ON ati_records(disposition);
CREATE INDEX IF NOT EXISTS idx_ati_date ON ati_records(date_completed DESC);
CREATE INDEX IF NOT EXISTS idx_ati_fiscal_year ON ati_records(fiscal_year DESC);
CREATE INDEX IF NOT EXISTS idx_ati_request_number ON ati_records(request_number);
CREATE INDEX IF NOT EXISTS idx_ati_source_system ON ati_records(source_system);
CREATE INDEX IF NOT EXISTS idx_ati_department_disposition ON ati_records(department, disposition);
CREATE INDEX IF NOT EXISTS idx_ati_department_fiscal ON ati_records(department, fiscal_year DESC);
CREATE INDEX IF NOT EXISTS idx_ati_ingested ON ati_records(ingested_at DESC);
`;

/* ------------------------------------------------------------------ */
/*  Database Operations                                                */
/* ------------------------------------------------------------------ */

/**
 * Initialize the ati_records table.
 */
export async function initializeAtiTable(db: D1Database): Promise<void> {
  await db.exec(ATI_RECORDS_DDL);
}

/**
 * Insert (or ignore) an ATI record.
 *
 * @returns true if inserted, false if skipped (duplicate)
 */
async function upsertAtiRecord(
  db: D1Database,
  record: AtiRecord,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO ati_records
      (id, department, department_acronym, request_number, summary,
       disposition, pages_released, pages_withheld, date_completed,
       fiscal_year, source_url, ckan_package_id, ckan_resource_id,
       source_system, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    record.department,
    record.departmentAcronym,
    record.requestNumber,
    record.summary,
    record.disposition,
    record.pagesReleased,
    record.pagesWithheld,
    record.dateCompleted,
    record.fiscalYear,
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
export async function atiRecordExists(
  db: D1Database,
  record: AtiRecord,
): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 FROM ati_records
     WHERE request_number = ? AND department = ? AND disposition = ? AND source_url = ?
     LIMIT 1`,
  ).bind(
    record.requestNumber,
    record.department,
    record.disposition,
    record.sourceUrl,
  ).first();

  return row !== null;
}

/**
 * Check if the ati_records table exists.
 */
export async function atiTableExists(db: D1Database): Promise<boolean> {
  try {
    const row = await db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='ati_records'`,
    ).first();
    return row !== null;
  } catch {
    return false;
  }
}

/**
 * Get the latest ingestion date from the ati_records table.
 */
export async function getLatestAtiIngestionDate(db: D1Database): Promise<string | null> {
  const row = await db.prepare(
    'SELECT ingested_at FROM ati_records ORDER BY ingested_at DESC LIMIT 1',
  ).first<{ ingested_at: string }>();
  return row?.ingested_at ?? null;
}

/* ------------------------------------------------------------------ */
/*  Search Functions                                                   */
/* ------------------------------------------------------------------ */

/**
 * Search ATI records by keyword across multiple fields.
 *
 * @param db - D1 database instance
 * @param query - Search terms
 * @param options - Search options (limit, department, disposition)
 * @returns Matching AtiRecord array
 */
export async function searchAtiRecords(
  db: D1Database,
  query: string,
  options: {
    limit?: number;
    department?: string;
    disposition?: AtiDisposition;
    fiscalYear?: string;
  } = {},
): Promise<AtiRecord[]> {
  let sql = `SELECT * FROM ati_records WHERE 1=1`;
  const params: unknown[] = [];

  if (query) {
    sql += ` AND (
      department LIKE ? OR
      request_number LIKE ? OR
      summary LIKE ? OR
      source_url LIKE ?
    )`;
    const q = `%${query}%`;
    params.push(q, q, q, q);
  }

  if (options.department) {
    sql += ' AND (department = ? OR department_acronym = ?)';
    params.push(options.department, options.department);
  }

  if (options.disposition) {
    sql += ' AND disposition = ?';
    params.push(options.disposition);
  }

  if (options.fiscalYear) {
    sql += ' AND fiscal_year = ?';
    params.push(options.fiscalYear);
  }

  sql += ' ORDER BY date_completed DESC NULLS LAST LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<AtiRecord>();
  return result.results ?? [];
}

/**
 * Get ATI records by department.
 */
export async function getAtiByDepartment(
  db: D1Database,
  department: string,
  options: {
    limit?: number;
    fiscalYear?: string;
  } = {},
): Promise<AtiRecord[]> {
  return searchAtiRecords(db, '', {
    department,
    limit: options.limit ?? 100,
    fiscalYear: options.fiscalYear,
  });
}

/**
 * Get ATI records by disposition type.
 */
export async function getAtiByDisposition(
  db: D1Database,
  disposition: AtiDisposition,
  options: {
    limit?: number;
    department?: string;
  } = {},
): Promise<AtiRecord[]> {
  return searchAtiRecords(db, '', {
    disposition,
    department: options.department,
    limit: options.limit ?? 50,
  });
}

/**
 * Get department-level ATI statistics.
 *
 * @param db - D1 database instance
 * @returns Array of department stats
 */
export async function getAtiDepartmentStats(
  db: D1Database,
): Promise<Array<{
  department: string;
  total: number;
  disclosed: number;
  exempted: number;
  excluded: number;
  noRecords: number;
  pagesReleased: number;
  pagesWithheld: number;
  latestDate: string | null;
}>> {
  const sql = `
    SELECT
      department,
      COUNT(*) as total,
      SUM(CASE WHEN disposition = 'disclosed' OR disposition = 'disclosed-part' THEN 1 ELSE 0 END) as disclosed,
      SUM(CASE WHEN disposition = 'exempted' THEN 1 ELSE 0 END) as exempted,
      SUM(CASE WHEN disposition = 'excluded' THEN 1 ELSE 0 END) as excluded,
      SUM(CASE WHEN disposition = 'no-records' THEN 1 ELSE 0 END) as no_records,
      COALESCE(SUM(pages_released), 0) as pages_released,
      COALESCE(SUM(pages_withheld), 0) as pages_withheld,
      MAX(date_completed) as latest_date
    FROM ati_records
    GROUP BY department
    ORDER BY total DESC
  `;

  const result = await db.prepare(sql).all<{
    department: string;
    total: number;
    disclosed: number;
    exempted: number;
    excluded: number;
    no_records: number;
    pages_released: number;
    pages_withheld: number;
    latest_date: string | null;
  }>();

  return (result.results ?? []).map(r => ({
    department: r.department,
    total: r.total,
    disclosed: r.disclosed,
    exempted: r.exempted,
    excluded: r.excluded,
    noRecords: r.no_records,
    pagesReleased: r.pages_released,
    pagesWithheld: r.pages_withheld,
    latestDate: r.latest_date,
  }));
}

/* ------------------------------------------------------------------ */
/*  Ingestion Orchestrator                                             */
/* ------------------------------------------------------------------ */

/**
 * Ingest ATI records into the database.
 *
 * Orchestrates:
 *   1. Initialize table (if requested)
 *   2. Fetch ATI completions from CKAN and department pages
 *   3. Parse and normalize records into unified schema
 *   4. Deduplicate and persist to D1
 *
 * @param db - D1 database instance (null to dry-run)
 * @param options - Ingestion options
 * @returns Ingestion result with counts and errors
 */
export async function ingestAti(
  db: D1Database | null,
  options: AtiIngestionOptions = {},
): Promise<AtiIngestionResult> {
  const startTime = Date.now();
  const result: AtiIngestionResult = {
    recordsFound: 0,
    recordsIngested: 0,
    newRecords: 0,
    errors: [],
    perDepartment: {},
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;

  try {
    // Phase 0: Initialize table if requested
    if (db && options.initializeTable) {
      log('[ATI] Initializing ati_records table...');
      await initializeAtiTable(db);
    }

    // Determine which departments to process
    const deptsToProcess = options.departments
      ? ATI_DEPARTMENTS.filter(d => options.departments!.includes(d.acronym))
      : ATI_DEPARTMENTS;

    const fiscalYears = options.fiscalYears ?? RECENT_FISCAL_YEARS.slice(-3);

    log(`[ATI] Processing ${deptsToProcess.length} departments across ${fiscalYears.length} fiscal years`);

    // Phase 1: Fetch from CKAN (broad search across all departments)
    log('[ATI] Searching CKAN for ATI packages...');
    try {
      const ckanPackages = await searchAtiCkanPackages(
        ATI_SOURCES.ATI_CKAN_QUERY,
        maxRecords,
      );

      log(`[ATI] Found ${ckanPackages.length} ATI packages via CKAN search`);

      // Phase 2-4: For each CKAN package, parse and persist
      for (const pkg of ckanPackages) {
        const records = await parseAtiCkanPackage(pkg, {
          sourceSystem: 'open-canada-ckan',
        });

        if (records.length === 0) continue;

        // Group by department for per-department tracking
        for (const record of records) {
          const deptKey = record.departmentAcronym ?? record.department;
          if (!result.perDepartment[deptKey]) {
            result.perDepartment[deptKey] = {
              recordsFound: 0,
              recordsIngested: 0,
              errors: [],
            };
          }

          result.perDepartment[deptKey].recordsFound++;
          result.recordsFound++;

          if (db) {
            try {
              if (!options.force) {
                const exists = await atiRecordExists(db, record);
                if (exists) {
                  result.perDepartment[deptKey].recordsIngested++;
                  result.recordsIngested++;
                  continue;
                }
              }

              const inserted = await upsertAtiRecord(db, record);
              if (inserted) {
                result.newRecords++;
              }
              result.perDepartment[deptKey].recordsIngested++;
              result.recordsIngested++;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              result.perDepartment[deptKey].errors.push(`Record ${record.id.substring(0, 12)}: ${msg}`);
              result.errors.push(`[${deptKey}] ${msg}`);
            }
          } else {
            // Dry run
            result.perDepartment[deptKey].recordsIngested++;
            result.recordsIngested++;
            result.newRecords++;
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`CKAN search/parse: ${msg}`);
      log(`[ATI] CKAN processing error: ${msg}`);
    }

    // Phase 2b: Per-department CKAN fetching for more targeted data
    for (const dept of deptsToProcess) {
      const deptKey = dept.acronym;
      log(`[ATI] Fetching ${deptKey} (${dept.name})...`);

      for (const year of fiscalYears) {
        try {
          const fetched = await fetchAtiReleases(deptKey, {
            fiscalYear: year,
            limit: Math.ceil(maxRecords / deptsToProcess.length),
            ckanOrgName: dept.ckanOrgName,
          });

          if (!result.perDepartment[deptKey]) {
            result.perDepartment[deptKey] = {
              recordsFound: 0,
              recordsIngested: 0,
              errors: [],
            };
          }

          result.perDepartment[deptKey].recordsFound += fetched.records.length;
          result.recordsFound += fetched.records.length;

          for (const err of fetched.errors) {
            result.perDepartment[deptKey].errors.push(err);
            result.errors.push(`[${deptKey}/${year}] ${err}`);
          }

          if (fetched.records.length === 0) continue;

          // Parse raw records
          const parsed = await parseAtiBatch(fetched.records, {
            sourceSystem: fetched.source === 'ckan' ? 'open-canada-ckan' : 'department-ati-page',
          });

          log(`[ATI] ${deptKey} (${year}): ${parsed.length} parsed records from ${fetched.source}`);

          // Persist to database
          if (db) {
            for (const record of parsed) {
              try {
                if (!options.force) {
                  const exists = await atiRecordExists(db, record);
                  if (exists) continue;
                }

                const inserted = await upsertAtiRecord(db, record);
                if (inserted) {
                  result.newRecords++;
                }
                result.perDepartment[deptKey].recordsIngested++;
                result.recordsIngested++;
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                result.perDepartment[deptKey].errors.push(`Insert ${record.id.substring(0, 12)}: ${msg}`);
              }
            }
          } else {
            // Dry run
            result.perDepartment[deptKey].recordsIngested += parsed.length;
            result.recordsIngested += parsed.length;
            result.newRecords += parsed.length;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.perDepartment[deptKey] = result.perDepartment[deptKey] ?? {
            recordsFound: 0,
            recordsIngested: 0,
            errors: [],
          };
          result.perDepartment[deptKey].errors.push(msg);
          result.errors.push(`[${deptKey}/${year}] ${msg}`);
          log(`[ATI] ${deptKey} (${year}) error: ${msg}`);
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`GLOBAL FATAL: ${msg}`);
    log(`[ATI] GLOBAL FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(
    `[ATI] Done in ${result.durationMs}ms: ${result.recordsIngested}/${result.recordsFound} records` +
    (result.newRecords > 0 ? ` (${result.newRecords} new)` : '') +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''),
  );

  return result;
}

/**
 * Ingest ATI records for all available departments and fiscal years.
 * Convenience wrapper for ingestAti with default options.
 */
export async function ingestAllAti(
  db: D1Database | null,
  options: AtiIngestionOptions = {},
): Promise<AtiIngestionResult> {
  return ingestAti(db, {
    ...options,
    departments: options.departments ?? ATI_DEPARTMENTS.map(d => d.acronym),
    fiscalYears: options.fiscalYears ?? RECENT_FISCAL_YEARS,
  });
}
