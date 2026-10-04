/**
 * Federal Budget Ingestion — Quill
 *
 * Orchestrates the ingestion pipeline for Canadian federal budget data:
 *   1. Fetch budget documents, public accounts, fiscal monitor, departmental plans
 *   2. Parse and normalize records into unified BudgetRecord schema
 *   3. Persist to D1 database with deduplication
 *   4. Provide query/search functions
 *
 * Sources:
 *   - Federal budget:        https://www.budget.canada.ca
 *   - Public accounts:       https://www.tpsgc-pwgsc.gc.ca/recgen/txt/72-eng.html
 *   - Fiscal monitor:        https://www.fin.gc.ca/fm-mf/index-eng.asp
 *   - Departmental plans:    https://www.canada.ca/en/government/system/departmental-plans.html
 *   - Open Canada CKAN:      https://open.canada.ca/data
 *
 * Cross-reference opportunities:
 *   - Crown corporations: match budget allocations to crown corp funding
 *   - Oversight: OAG audits of public accounts, PBO analysis of budget
 *   - Procurement: track budget vs. actual spending on contracts
 *   - Influence: government funding flows to tracked actors
 */

import {
  fetchAllBudgetData,
  fetchBudgetData,
  fetchPublicAccounts,
  fetchFiscalMonitor,
  fetchDepartmentalPlans,
} from './fetcher.js';
import {
  parseBudgetCSV,
  parsePublicAccounts,
  parseFiscalMonitorCSV,
  parseDepartmentalPlanRecords,
  parseDocumentLinks,
  parseCKANPackage,
} from './parser.js';
import {
  FEDERAL_DEPARTMENTS,
  ALL_BUDGET_RECORD_TYPES,
  ALL_BUDGET_CATEGORIES,
  RECENT_FISCAL_YEARS,
  BudgetError,
} from './constants.js';
import type {
  BudgetRecord,
  BudgetRecordType,
  BudgetCategory,
  BudgetIngestionOptions,
  BudgetIngestionResult,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Re-exports for barrel                                              */
/* ------------------------------------------------------------------ */

export {
  fetchBudgetData,
  fetchPublicAccounts,
  fetchFiscalMonitor,
  fetchDepartmentalPlans,
  fetchAllBudgetData,
} from './fetcher.js';

export {
  searchCKAN,
  fetchCKANPackage,
  fetchCKANResource,
  extractDocumentLinks,
  normalizeFiscalYear,
} from './fetcher.js';

export {
  parseBudgetCSV,
  parsePublicAccounts,
  parseFiscalMonitorCSV,
  parseDepartmentalPlanRecords,
  parseDocumentLinks,
  parseCKANPackage,
  detectCategory,
  detectRecordType,
  parseAmount,
  parseCSVLine,
} from './parser.js';

export {
  FEDERAL_DEPARTMENTS,
  DEPARTMENT_ACRONYM_MAP,
  DEPARTMENT_NAME_MAP,
  ALL_BUDGET_RECORD_TYPES,
  ALL_BUDGET_CATEGORIES,
  BUDGET_RECORD_TYPE_LABELS,
  BUDGET_CATEGORY_LABELS,
  RECENT_FISCAL_YEARS,
  AVAILABLE_BUDGET_YEARS,
  BUDGET_SOURCES,
  BUDGET_CKAN_PACKAGE_IDS,
  DEFAULT_MAX_RECORDS,
  BudgetError,
} from './constants.js';

export type {
  BudgetRecord,
  BudgetRecordType,
  BudgetCategory,
  BudgetIngestionOptions,
  BudgetIngestionResult,
  CKANPackageResponse,
  CKANPackage,
  CKANResource,
  RawPublicAccountsRow,
  RawFiscalMonitorRow,
  RawDepartmentalPlanRow,
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
 * DDL for the federal_budget table.
 *
 * Stores federal budget, public accounts, fiscal monitor, and departmental
 * plan records. Tracks the Canadian government's fiscal position across
 * multiple data sources.
 *
 * Primary key: SHA-256 hash of record content for deduplication.
 */
export const FEDERAL_BUDGET_DDL = `
-- Federal budget, public accounts, fiscal monitor, and departmental plan data
CREATE TABLE IF NOT EXISTS federal_budget (
  id TEXT PRIMARY KEY,

  -- Fiscal context
  fiscal_year TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK(record_type IN (
    'budget',
    'public_accounts',
    'fiscal_monitor',
    'departmental_plan',
    'fiscal_projections',
    'supplementary_estimates',
    'main_estimates',
    'other'
  )),

  -- Department / organization
  department TEXT,
  department_acronym TEXT,

  -- Financial data
  category TEXT NOT NULL CHECK(category IN (
    'revenue',
    'expense',
    'debt-service',
    'transfer',
    'capital',
    'operating',
    'defense',
    'healthcare',
    'social',
    'education',
    'infrastructure',
    'indigenous',
    'climate',
    'innovation',
    'immigration',
    'public-safety',
    'culture',
    'pension',
    'other-revenue',
    'other-expense',
    'total',
    'deficit',
    'debt',
    'gdp',
    'unallocated'
  )),
  amount REAL,
  currency TEXT DEFAULT 'CAD',

  -- Description
  description TEXT,
  title TEXT,

  -- Temporal
  published_date TEXT,
  fiscal_quarter TEXT,

  -- Provenance
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL,
  ckan_package_id TEXT,
  ckan_resource_id TEXT,
  language TEXT DEFAULT 'en',

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  -- Deduplication constraint
  UNIQUE(fiscal_year, record_type, category, source_url, amount)
);

CREATE INDEX IF NOT EXISTS idx_fb_fiscal_year ON federal_budget(fiscal_year DESC);
CREATE INDEX IF NOT EXISTS idx_fb_record_type ON federal_budget(record_type);
CREATE INDEX IF NOT EXISTS idx_fb_category ON federal_budget(category);
CREATE INDEX IF NOT EXISTS idx_fb_department ON federal_budget(department);
CREATE INDEX IF NOT EXISTS idx_fb_published_date ON federal_budget(published_date DESC);
CREATE INDEX IF NOT EXISTS idx_fb_amount ON federal_budget(amount DESC);
CREATE INDEX IF NOT EXISTS idx_fb_fiscal_type ON federal_budget(fiscal_year, record_type);
CREATE INDEX IF NOT EXISTS idx_fb_dept_fiscal ON federal_budget(department, fiscal_year DESC);
CREATE INDEX IF NOT EXISTS idx_fb_category_fiscal ON federal_budget(category, fiscal_year DESC);
CREATE INDEX IF NOT EXISTS idx_fb_source_system ON federal_budget(source_system);
CREATE INDEX IF NOT EXISTS idx_fb_ingested ON federal_budget(ingested_at DESC);
`;

/* ------------------------------------------------------------------ */
/*  Database Operations                                                */
/* ------------------------------------------------------------------ */

/**
 * Initialize the federal_budget table.
 */
export async function initializeFederalBudgetTable(db: D1Database): Promise<void> {
  await db.exec(FEDERAL_BUDGET_DDL);
}

/**
 * Insert (or ignore) a budget record.
 *
 * @returns true if inserted, false if skipped (duplicate)
 */
async function upsertRecord(
  db: D1Database,
  record: BudgetRecord,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO federal_budget
      (id, fiscal_year, record_type, department, department_acronym,
       category, amount, currency, description, title,
       published_date, fiscal_quarter, source_url, source_system,
       ckan_package_id, ckan_resource_id, language, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    record.fiscalYear,
    record.recordType,
    record.department,
    record.departmentAcronym,
    record.category,
    record.amount,
    record.currency,
    record.description,
    record.title,
    record.publishedDate,
    record.fiscalQuarter,
    record.sourceUrl,
    record.sourceSystem,
    record.ckanPackageId,
    record.ckanResourceId,
    record.language,
    record.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}

/**
 * Check if a record already exists by fiscal year, record type, category, and source URL.
 */
export async function recordExists(
  db: D1Database,
  record: BudgetRecord,
): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 FROM federal_budget
     WHERE fiscal_year = ? AND record_type = ? AND category = ? AND source_url = ?
     LIMIT 1`,
  ).bind(
    record.fiscalYear,
    record.recordType,
    record.category,
    record.sourceUrl,
  ).first();

  return row !== null;
}

/**
 * Check if the federal_budget table exists.
 */
export async function budgetTableExists(db: D1Database): Promise<boolean> {
  try {
    const row = await db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='federal_budget'`,
    ).first();
    return row !== null;
  } catch {
    return false;
  }
}

/**
 * Get the latest published date in the database for a record type.
 */
export async function getLatestPublishedDate(
  db: D1Database,
  recordType?: BudgetRecordType,
): Promise<string | null> {
  let sql = 'SELECT published_date FROM federal_budget';
  const params: unknown[] = [];

  if (recordType) {
    sql += ' WHERE record_type = ?';
    params.push(recordType);
  }

  sql += ' ORDER BY published_date DESC LIMIT 1';

  const row = await db.prepare(sql).bind(...params).first<{ published_date: string }>();
  return row?.published_date ?? null;
}

/* ------------------------------------------------------------------ */
/*  Ingestion Orchestrator                                             */
/* ------------------------------------------------------------------ */

/**
 * Ingest federal budget data into the database.
 *
 * Orchestrates:
 *   1. Initialize table (if requested)
 *   2. Fetch budget data from multiple sources
 *   3. Parse and normalize records into unified schema
 *   4. Deduplicate and persist to D1
 *
 * @param db - D1 database instance (null to dry-run)
 * @param options - Ingestion options
 * @returns Ingestion result with counts and errors
 */
export async function ingestFederalBudget(
  db: D1Database | null,
  options: BudgetIngestionOptions = {},
): Promise<BudgetIngestionResult> {
  const startTime = Date.now();
  const result: BudgetIngestionResult = {
    recordsFound: 0,
    recordsIngested: 0,
    newRecords: 0,
    errors: [],
    perSource: {},
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? 1000;
  const fiscalYears = options.fiscalYears ?? RECENT_FISCAL_YEARS.slice(-3);

  try {
    // Phase 0: Initialize table if requested
    if (db && options.initializeTable) {
      log('[Federal Budget] Initializing table...');
      await initializeFederalBudgetTable(db);
    }

    // Phase 1-3: For each fiscal year, fetch, parse, persist
    for (const year of fiscalYears) {
      log(`[Federal Budget] Processing fiscal year ${year}...`);

      const sourceResults = await fetchAllBudgetData(year, {
        recordTypes: options.recordTypes,
        maxRecords,
        onProgress: log,
      });

      // Process each source
      for (const [sourceKey, records] of Object.entries(sourceResults)) {
        const sourceLabel = sourceKey.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const sourceResult = {
          recordsFound: records.length,
          recordsIngested: 0,
          newRecords: 0,
          errors: [] as string[],
        };

        if (records.length === 0) {
          result.perSource[sourceKey] = sourceResult;
          continue;
        }

        log(`[Federal Budget] ${sourceLabel}: Found ${records.length} records for ${year}`);

        // Persist to database
        if (db) {
          for (const record of records) {
            try {
              if (!options.force) {
                const exists = await recordExists(db, record);
                if (exists) {
                  sourceResult.recordsIngested++;
                  continue;
                }
              }

              const inserted = await upsertRecord(db, record);
              if (inserted) {
                sourceResult.newRecords++;
              }
              sourceResult.recordsIngested++;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              sourceResult.errors.push(`Record ${record.id?.substring(0, 12) ?? 'unknown'}: ${msg}`);
            }
          }
        } else {
          // Dry run — count all as ingested
          sourceResult.recordsIngested = records.length;
          sourceResult.newRecords = records.length;
        }

        log(`[Federal Budget] ${sourceLabel} (${year}): ${sourceResult.recordsIngested}/${sourceResult.recordsFound}` +
          (sourceResult.newRecords > 0 ? ` (${sourceResult.newRecords} new)` : '') +
          (sourceResult.errors.length > 0 ? `, ${sourceResult.errors.length} errors` : ''));

        result.perSource[sourceKey] = sourceResult;

        // Accumulate totals
        result.recordsFound += sourceResult.recordsFound;
        result.recordsIngested += sourceResult.recordsIngested;
        result.newRecords += sourceResult.newRecords;
        result.errors.push(...sourceResult.errors.map((e) => `[${sourceKey}/${year}] ${e}`));
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`GLOBAL FATAL: ${msg}`);
    log(`[Federal Budget] GLOBAL FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(
    `[Federal Budget] Done in ${result.durationMs}ms: ${result.recordsIngested}/${result.recordsFound} records` +
    (result.newRecords > 0 ? ` (${result.newRecords} new)` : '') +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''),
  );

  return result;
}

/**
 * Ingest all available federal budget data.
 * Convenience wrapper for ingestFederalBudget with default options.
 */
export async function ingestAllFederalBudget(
  db: D1Database | null,
  options: BudgetIngestionOptions = {},
): Promise<BudgetIngestionResult> {
  return ingestFederalBudget(db, {
    ...options,
    fiscalYears: options.fiscalYears ?? RECENT_FISCAL_YEARS,
  });
}

/* ------------------------------------------------------------------ */
/*  Query Functions                                                    */
/* ------------------------------------------------------------------ */

/**
 * Search federal budget records by keyword across multiple fields.
 *
 * @param db - D1 database instance
 * @param query - Search terms
 * @param limit - Maximum results (default: 50)
 */
export async function searchFederalBudget(
  db: D1Database,
  query: string,
  limit: number = 50,
): Promise<BudgetRecord[]> {
  const searchTerm = `%${query.toLowerCase()}%`;

  const stmt = db.prepare(`
    SELECT * FROM federal_budget
    WHERE LOWER(description) LIKE ?
       OR LOWER(title) LIKE ?
       OR LOWER(department) LIKE ?
       OR LOWER(department_acronym) LIKE ?
       OR LOWER(fiscal_year) LIKE ?
       OR LOWER(category) LIKE ?
    ORDER BY fiscal_year DESC, amount DESC
    LIMIT ?
  `).bind(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, limit);

  const result = await stmt.all<BudgetRecord>();
  return result.results ?? [];
}

/**
 * Get budget records by fiscal year.
 *
 * @param db - D1 database instance
 * @param fiscalYear - Fiscal year (e.g. "2024-25")
 * @param limit - Maximum results (default: 100)
 */
export async function getByFiscalYear(
  db: D1Database,
  fiscalYear: string,
  limit: number = 100,
): Promise<BudgetRecord[]> {
  const stmt = db.prepare(`
    SELECT * FROM federal_budget
    WHERE fiscal_year = ?
    ORDER BY amount DESC
    LIMIT ?
  `).bind(fiscalYear, limit);

  const result = await stmt.all<BudgetRecord>();
  return result.results ?? [];
}

/**
 * Get budget records by record type.
 *
 * @param db - D1 database instance
 * @param recordType - Record type
 * @param limit - Maximum results (default: 100)
 */
export async function getByRecordType(
  db: D1Database,
  recordType: BudgetRecordType,
  limit: number = 100,
): Promise<BudgetRecord[]> {
  const stmt = db.prepare(`
    SELECT * FROM federal_budget
    WHERE record_type = ?
    ORDER BY fiscal_year DESC, amount DESC
    LIMIT ?
  `).bind(recordType, limit);

  const result = await stmt.all<BudgetRecord>();
  return result.results ?? [];
}

/**
 * Get budget records by department.
 *
 * @param db - D1 database instance
 * @param department - Department name or acronym
 * @param limit - Maximum results (default: 100)
 */
export async function getByDepartment(
  db: D1Database,
  department: string,
  limit: number = 100,
): Promise<BudgetRecord[]> {
  const searchTerm = `%${department}%`;

  const stmt = db.prepare(`
    SELECT * FROM federal_budget
    WHERE department LIKE ? OR department_acronym LIKE ?
    ORDER BY fiscal_year DESC, amount DESC
    LIMIT ?
  `).bind(searchTerm, searchTerm, limit);

  const result = await stmt.all<BudgetRecord>();
  return result.results ?? [];
}

/**
 * Get budget records by spending category.
 *
 * @param db - D1 database instance
 * @param category - Budget category
 * @param limit - Maximum results (default: 100)
 */
export async function getByCategory(
  db: D1Database,
  category: BudgetCategory,
  limit: number = 100,
): Promise<BudgetRecord[]> {
  const stmt = db.prepare(`
    SELECT * FROM federal_budget
    WHERE category = ?
    ORDER BY fiscal_year DESC, amount DESC
    LIMIT ?
  `).bind(category, limit);

  const result = await stmt.all<BudgetRecord>();
  return result.results ?? [];
}

/**
 * Get deficit/surplus records across fiscal years.
 *
 * @param db - D1 database instance
 * @param limit - Maximum results (default: 20)
 */
export async function getDeficitHistory(
  db: D1Database,
  limit: number = 20,
): Promise<BudgetRecord[]> {
  const stmt = db.prepare(`
    SELECT * FROM federal_budget
    WHERE category = 'deficit'
    ORDER BY fiscal_year DESC
    LIMIT ?
  `).bind(limit);

  const result = await stmt.all<BudgetRecord>();
  return result.results ?? [];
}

/**
 * Get total federal debt records across fiscal years.
 *
 * @param db - D1 database instance
 * @param limit - Maximum results (default: 20)
 */
export async function getDebtHistory(
  db: D1Database,
  limit: number = 20,
): Promise<BudgetRecord[]> {
  const stmt = db.prepare(`
    SELECT * FROM federal_budget
    WHERE category = 'debt'
    ORDER BY fiscal_year DESC
    LIMIT ?
  `).bind(limit);

  const result = await stmt.all<BudgetRecord>();
  return result.results ?? [];
}
