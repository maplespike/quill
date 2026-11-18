// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Proactive Disclosure Ingestion — Quill
 *
 * Orchestrates the ingestion pipeline for federal proactive disclosure data:
 *   1. Fetch raw CKAN Solr search results (paginated)
 *   2. Parse and normalize across department schema variations
 *   3. Persist to D1 database
 *
 * Proactive disclosure is published by every department covering:
 *   - Contracts over $10K (primary focus)
 *   - Travel expenses of senior officials
 *   - Hospitality expenses
 *   - Reclassification of positions
 *
 * Cross-referencing opportunities:
 *   - Corporate module: match vendor names to known corporate entities
 *   - Lobbying: identify contractors that lobby the departments they sell to
 *   - Influence tracking: trace funding flows from government contracts
 */

import type { D1Database, D1PreparedStatement } from '../committees/db.js';
import { upsertOrganization, upsertContract } from '../../shared-db.js';
import {
  fetchProactiveDisclosure,
  fetchAllProactiveDisclosure,
  fetchByDepartment,
} from './fetcher.js';
import { parseCKAResults } from './parser.js';
import { MAJOR_DEPARTMENTS, PDError } from './constants.js';
import type {
  ProactiveDisclosureRecord,
  ProactiveDisclosureSearchOptions,
  ProactiveDisclosureIngestionResult,
  RawCKANProactiveDisclosureDoc,
} from './types.js';


export {
  fetchProactiveDisclosure,
  fetchAllProactiveDisclosure,
  fetchByDepartment,
} from './fetcher.js';

export {
  parseCKAResult,
  parseCKAResults,
  normalizeDate,
  extractFiscalYear,
  inferGoodsOrServices,
} from './parser.js';

export {
  MAJOR_DEPARTMENTS,
  CKAN_SOLR_SEARCH_URL,
  CKAN_API_BASE,
  DEFAULT_SEARCH_QUERY,
  DEPARTMENT_ACRONYM_MAP,
  OWNER_ORG_ACRONYM_MAP,
  PDError,
} from './constants.js';

export type {
  ProactiveDisclosureRecord,
  ProactiveDisclosureSearchOptions,
  ProactiveDisclosureIngestionResult,
  RawCKANProactiveDisclosureDoc,
  DepartmentInfo,
  CKANSearchResponse,
} from './types.js';


/* ------------------------------------------------------------------ */
/*  DDL — Database Schema Definition                                  */
/* ------------------------------------------------------------------ */

/**
 * DDL for the proactive_disclosure table.
 *
 * This table stores normalized proactive disclosure records from all
 * federal departments. The primary key is a SHA-256 hash of the
 * record content for deduplication.
 *
 * Indexes are designed for the key query patterns:
 *   - By vendor (find all contracts for a supplier)
 *   - By department (find all contracts from a department)
 *   - By date (sort by award date)
 *   - By value (find high-value contracts)
 *   - By fiscal year (government accountability reporting)
 */
export const PROACTIVE_DISCLOSURE_DDL = `
-- Federal proactive disclosure records (contracts over $10K, travel, hospitality, reclassification)
CREATE TABLE IF NOT EXISTS proactive_disclosure (
  id TEXT PRIMARY KEY,

  -- Department information
  department TEXT NOT NULL,
  department_acronym TEXT,

  -- Vendor / supplier
  vendor_name TEXT NOT NULL,

  -- Contract financials
  contract_value REAL,
  currency TEXT DEFAULT 'CAD',

  -- Dates
  award_date TEXT,
  contract_period_start TEXT,
  contract_period_end TEXT,

  -- Classification
  goods_or_services TEXT,
  procurement_method TEXT,

  -- Description
  description TEXT,
  comments TEXT,

  -- Provenance
  source_url TEXT NOT NULL,
  ckan_package_id TEXT,
  ckan_resource_id TEXT,

  -- Fiscal year
  fiscal_year TEXT,

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  -- Deduplication constraint
  UNIQUE(vendor_name, department, award_date, contract_value)
);

CREATE INDEX IF NOT EXISTS idx_pd_vendor ON proactive_disclosure(vendor_name);
CREATE INDEX IF NOT EXISTS idx_pd_department ON proactive_disclosure(department);
CREATE INDEX IF NOT EXISTS idx_pd_award_date ON proactive_disclosure(award_date DESC);
CREATE INDEX IF NOT EXISTS idx_pd_contract_value ON proactive_disclosure(contract_value DESC);
CREATE INDEX IF NOT EXISTS idx_pd_fiscal_year ON proactive_disclosure(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_pd_procurement_method ON proactive_disclosure(procurement_method);
CREATE INDEX IF NOT EXISTS idx_pd_goods_services ON proactive_disclosure(goods_or_services);
CREATE INDEX IF NOT EXISTS idx_pd_dept_date ON proactive_disclosure(department, award_date DESC);
CREATE INDEX IF NOT EXISTS idx_pd_vendor_dept ON proactive_disclosure(vendor_name, department);
CREATE INDEX IF NOT EXISTS idx_pd_ingested ON proactive_disclosure(ingested_at DESC);
`;


/* ------------------------------------------------------------------ */
/*  Database Operations                                                */
/* ------------------------------------------------------------------ */

/**
 * Initialize the proactive_disclosure table.
 */
export async function initializePDTable(db: D1Database): Promise<void> {
  await db.exec(PROACTIVE_DISCLOSURE_DDL);
}


/**
 * Insert (or ignore) a proactive disclosure record.
 *
 * @returns true if inserted, false if skipped (duplicate)
 */
async function upsertRecord(
  db: D1Database,
  record: ProactiveDisclosureRecord,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO proactive_disclosure
      (id, department, department_acronym, vendor_name, contract_value,
       currency, award_date, contract_period_start, contract_period_end,
       goods_or_services, procurement_method, description, comments,
       source_url, ckan_package_id, ckan_resource_id, fiscal_year, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    record.department,
    record.departmentAcronym,
    record.vendorName,
    record.contractValue,
    record.currency,
    record.awardDate,
    record.contractPeriodStart,
    record.contractPeriodEnd,
    record.goodsOrServices,
    record.procurementMethod,
    record.description,
    record.comments,
    record.sourceUrl,
    record.ckanPackageId,
    record.ckanResourceId,
    record.fiscalYear,
    record.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}


/**
 * Check if a record already exists by vendor/department/date/value.
 */
async function recordExists(
  db: D1Database,
  record: ProactiveDisclosureRecord,
): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 FROM proactive_disclosure
     WHERE vendor_name = ? AND department = ? AND award_date = ? AND contract_value = ?
     LIMIT 1`,
  ).bind(
    record.vendorName,
    record.department,
    record.awardDate,
    record.contractValue,
  ).first();

  return row !== null;
}


/**
 * Get the latest award date in the database.
 */
async function getLatestAwardDate(db: D1Database): Promise<string | null> {
  const row = await db.prepare(
    'SELECT award_date FROM proactive_disclosure ORDER BY award_date DESC LIMIT 1',
  ).first<{ award_date: string }>();

  return row?.award_date ?? null;
}


/* ------------------------------------------------------------------ */
/*  Ingestion Orchestrator                                             */
/* ------------------------------------------------------------------ */

/**
 * Ingest proactive disclosure records into the database.
 *
 * Orchestrates:
 *   1. Fetch raw CKAN Solr search results
 *   2. Parse across department schemas
 *   3. Deduplicate against existing records
 *   4. Persist new records to D1
 *
 * @param db - D1 database instance (null to dry-run)
 * @param options - Search and ingestion options
 * @returns Ingestion result with counts and errors
 */
export async function ingestProactiveDisclosure(
  db: D1Database | null,
  options: ProactiveDisclosureSearchOptions & {
    /** Max total records to fetch (default: 10_000) */
    maxRecords?: number;
    /** Progress callback */
    onProgress?: (msg: string) => void;
    /** Re-ingest already-ingested records */
    force?: boolean;
    /** Limit ingestion to a specific department by acronym */
    departmentAcronym?: string;
    /** Initialize table if it doesn't exist */
    initializeTable?: boolean;
  } = {},
): Promise<ProactiveDisclosureIngestionResult> {
  const startTime = Date.now();
  const result: ProactiveDisclosureIngestionResult = {
    recordsFound: 0,
    recordsIngested: 0,
    newRecords: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});
  const maxRecords = options.maxRecords ?? 10_000;

  try {
    // Phase 0: Initialize table if requested
    if (db && options.initializeTable) {
      log('[PD] Initializing table...');
      await initializePDTable(db);
    }

    // Phase 1: Fetch raw data
    log('[PD] Fetching proactive disclosure data...');

    let rawRecords: RawCKANProactiveDisclosureDoc[];
    let totalAvailable = 0;

    if (options.departmentAcronym) {
      // Fetch for a specific department
      result.department = options.departmentAcronym;
      log(`[PD] Fetching for department: ${options.departmentAcronym}`);

      const fetchResult = await fetchByDepartment(options.departmentAcronym, {
        query: options.query,
        rows: options.rows,
        fiscalYear: options.fiscalYear,
        minValue: options.minValue,
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
        sort: options.sort,
      });

      rawRecords = fetchResult.records;
      totalAvailable = fetchResult.total;
    } else {
      // General fetch with pagination
      const fetchResult = await fetchAllProactiveDisclosure(
        {
          query: options.query,
          rows: options.rows,
          departments: options.departments,
          fiscalYear: options.fiscalYear,
          minValue: options.minValue,
          dateFrom: options.dateFrom,
          dateTo: options.dateTo,
          sort: options.sort,
        },
        maxRecords,
      );

      rawRecords = fetchResult.records;
      totalAvailable = fetchResult.total;
    }

    result.recordsFound = rawRecords.length;
    log(`[PD] Found ${totalAvailable} total, fetched ${rawRecords.length} records`);

    if (rawRecords.length === 0) {
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Phase 2: Parse and normalize
    log('[PD] Parsing records...');
    const parsedRecords = await parseCKAResults(rawRecords);
    log(`[PD] Parsed ${parsedRecords.length} unique records`);

    // Phase 3: Persist to database
    if (db) {
      log('[PD] Persisting to database...');

      for (const record of parsedRecords) {
        try {
          // Check if already exists (unless force)
          if (!options.force) {
            const exists = await recordExists(db, record);
            if (exists) continue;
          }

          const inserted = await upsertRecord(db, record);
          if (inserted) {
            result.newRecords++;
          }
          result.recordsIngested++;

          // Also upsert to shared tables
          try {
            upsertOrganization(record.vendorName, {
              type: "other",
              source: "proactive-disclosure",
              rawData: { department: record.department, departmentAcronym: record.departmentAcronym },
            });
          } catch { /* non-fatal */ }
          try {
            upsertOrganization(record.department, {
              type: "government_agency",
              source: "proactive-disclosure",
              rawData: { acronym: record.departmentAcronym },
            });
          } catch { /* non-fatal */ }
          if (record.contractValue !== null && record.contractValue > 0) {
            try {
              upsertContract(
                record.id,
                record.description ?? "Proactive disclosure contract",
                record.description ?? "",
                record.vendorName,
                record.department,
                record.contractValue,
                {
                  startDate: record.awardDate ?? undefined,
                  isSoleSource: record.procurementMethod === "Non-Competitive" || record.procurementMethod === "Sole Source",
                  source: "proactive-disclosure",
                },
              );
            } catch { /* non-fatal */ }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Record ${record.id?.substring(0, 12) ?? 'unknown'}: ${msg}`);
        }
      }

      log(`[PD] Persisted ${result.recordsIngested}/${parsedRecords.length} records (${result.newRecords} new)`);
    } else {
      // No database — count all as ingested
      result.recordsIngested = parsedRecords.length;
      result.newRecords = parsedRecords.length;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`FATAL: ${msg}`);
    log(`[PD] FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(
    `[PD] Done in ${result.durationMs}ms: ${result.recordsIngested}/${result.recordsFound} records` +
    (result.newRecords > 0 ? ` (${result.newRecords} new)` : '') +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''),
  );

  return result;
}


/* ------------------------------------------------------------------ */
/*  Query Functions                                                    */
/* ------------------------------------------------------------------ */

/**
 * Search proactive disclosure records by keyword across multiple fields.
 *
 * @param db - D1 database instance
 * @param query - Search terms
 * @param limit - Maximum results (default: 50)
 */
export async function searchProactiveDisclosure(
  db: D1Database,
  query: string,
  limit: number = 50,
): Promise<ProactiveDisclosureRecord[]> {
  const searchTerm = `%${query.toLowerCase()}%`;

  const stmt = db.prepare(`
    SELECT * FROM proactive_disclosure
    WHERE LOWER(vendor_name) LIKE ?
       OR LOWER(description) LIKE ?
       OR LOWER(department) LIKE ?
       OR LOWER(comments) LIKE ?
    ORDER BY contract_value DESC, award_date DESC
    LIMIT ?
  `).bind(searchTerm, searchTerm, searchTerm, searchTerm, limit);

  const result = await stmt.all<ProactiveDisclosureRecord>();
  return result.results ?? [];
}


/**
 * Get all contracts for a specific vendor.
 *
 * @param db - D1 database instance
 * @param vendorName - Vendor name (case-insensitive partial match)
 * @param limit - Maximum results (default: 50)
 */
export async function getContractsByVendor(
  db: D1Database,
  vendorName: string,
  limit: number = 50,
): Promise<ProactiveDisclosureRecord[]> {
  const stmt = db.prepare(`
    SELECT * FROM proactive_disclosure
    WHERE LOWER(vendor_name) LIKE ?
    ORDER BY award_date DESC, contract_value DESC
    LIMIT ?
  `).bind(`%${vendorName.toLowerCase()}%`, limit);

  const result = await stmt.all<ProactiveDisclosureRecord>();
  return result.results ?? [];
}


/**
 * Get all contracts for a specific department.
 *
 * @param db - D1 database instance
 * @param departmentName - Department name or acronym (case-insensitive partial match)
 * @param limit - Maximum results (default: 50)
 */
export async function getContractsByDepartment(
  db: D1Database,
  departmentName: string,
  limit: number = 50,
): Promise<ProactiveDisclosureRecord[]> {
  const searchTerm = `%${departmentName.toLowerCase()}%`;

  const stmt = db.prepare(`
    SELECT * FROM proactive_disclosure
    WHERE LOWER(department) LIKE ?
       OR LOWER(department_acronym) LIKE ?
    ORDER BY award_date DESC, contract_value DESC
    LIMIT ?
  `).bind(searchTerm, searchTerm, limit);

  const result = await stmt.all<ProactiveDisclosureRecord>();
  return result.results ?? [];
}


/**
 * Get top contracts by value.
 *
 * @param db - D1 database instance
 * @param limit - Number of contracts (default: 20)
 * @param departmentAcronym - Optional department filter
 */
export async function getTopContracts(
  db: D1Database,
  limit: number = 20,
  departmentAcronym?: string,
): Promise<ProactiveDisclosureRecord[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (departmentAcronym) {
    conditions.push('LOWER(department_acronym) = ?');
    params.push(departmentAcronym.toLowerCase());
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const stmt = db.prepare(`
    SELECT * FROM proactive_disclosure
    ${where}
    ORDER BY contract_value DESC NULLS LAST
    LIMIT ?
  `).bind(...params, limit);

  const result = await stmt.all<ProactiveDisclosureRecord>();
  return result.results ?? [];
}


/**
 * Get contract statistics aggregated by department.
 *
 * @param db - D1 database instance
 * @param fiscalYear - Optional fiscal year filter
 */
export async function getDepartmentStats(
  db: D1Database,
  fiscalYear?: string,
): Promise<Array<{
  department: string;
  departmentAcronym: string | null;
  totalContracts: number;
  totalValue: number;
  avgValue: number;
  maxValue: number;
  soleSourceCount: number;
}>> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (fiscalYear) {
    conditions.push('fiscal_year = ?');
    params.push(fiscalYear);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const stmt = db.prepare(`
    SELECT
      department,
      department_acronym,
      COUNT(*) as total_contracts,
      SUM(COALESCE(contract_value, 0)) as total_value,
      AVG(COALESCE(contract_value, 0)) as avg_value,
      MAX(COALESCE(contract_value, 0)) as max_value,
      SUM(CASE WHEN LOWER(procurement_method) LIKE '%non-competitive%' OR LOWER(procurement_method) LIKE '%sole%' THEN 1 ELSE 0 END) as sole_source_count
    FROM proactive_disclosure
    ${where}
    GROUP BY department
    ORDER BY total_value DESC
  `).bind(...params);

  const result = await stmt.all<{
    department: string;
    department_acronym: string | null;
    total_contracts: number;
    total_value: number;
    avg_value: number;
    max_value: number;
    sole_source_count: number;
  }>();

  return (result.results ?? []).map((r) => ({
    department: r.department,
    departmentAcronym: r.department_acronym,
    totalContracts: r.total_contracts,
    totalValue: r.total_value,
    avgValue: r.avg_value,
    maxValue: r.max_value,
    soleSourceCount: r.sole_source_count,
  }));
}
