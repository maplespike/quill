// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Crown Corporations Ingestion — Quill
 *
 * Orchestrates the ingestion pipeline for Canadian crown corporation data:
 *   1. Fetch report links from crown corporation website listing pages
 *   2. Parse and normalize report metadata into unified schema
 *   3. Persist to D1 database with deduplication
 *   4. Provide query/search functions
 *
 * Tracked crown corporations:
 *   - CBC/Radio-Canada (public broadcaster)
 *   - Canada Post Corporation (postal service)
 *   - CN Rail (privatized 1995, legacy tracking)
 *   - Via Rail Canada (passenger rail)
 *   - Export Development Canada (trade financing)
 *   - Business Development Bank of Canada (SME lending)
 *   - CMHC (mortgage insurance/housing)
 *   - Canada Council for the Arts (arts funding)
 *   - National Arts Centre (performing arts)
 *   - Farm Credit Canada (agricultural finance)
 *   - PSP Investments (public service pensions)
 *
 * Cross-referencing opportunities:
 *   - Corporate module: match crown corp procurement spending
 *   - GIC appointments: board members are GIC appointees
 *   - Influence tracking: crown corp funding flows to NGOs/consultancies
 *   - Oversight: OAG/PBO audits of crown corporations
 */

import { fetchCrownCorpReport, fetchAllCrownCorps } from './fetcher.js';
import { upsertOrganization } from '../../shared-db.js';
import { parseReport, parseRecords } from './parser.js';
import {
  CROWN_CORP_CONFIGS,
  CURRENT_CROWN_CORPS,
  CrownCorporationError,
} from './constants.js';
import type {
  CrownCorporationRecord,
  CrownCorporationCode,
  ReportType,
  CrownCorporationIngestionOptions,
  CrownCorporationIngestionResult,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Re-exports for barrel                                              */
/* ------------------------------------------------------------------ */

export {
  fetchCrownCorpReport,
  fetchAllCrownCorps,
} from './fetcher.js';
export {
  fetchCBCReports,
  fetchCanadaPostReports,
  fetchCMHCReports,
  fetchEDCReports,
  fetchViaRailReports,
  fetchBDCReports,
} from './fetcher.js';

export {
  parseReport,
  parseRecords,
  detectReportType,
  detectQuarter,
  extractFiscalYear,
  normalizeOrgCode,
} from './parser.js';

export {
  CROWN_CORP_CONFIGS,
  ALL_CROWN_CORPS,
  CURRENT_CROWN_CORPS,
  QUARTERLY_REPORTING_CORPS,
  RSS_FEED_CORPS,
  ANNUAL_REPORT_URL_PATTERNS,
  DEFAULT_MAX_RECORDS,
  CrownCorporationError,
} from './constants.js';

export type {
  CrownCorporationRecord,
  CrownCorporationCode,
  ReportType,
  CrownCorporationConfig,
  CrownCorporationIngestionOptions,
  CrownCorporationIngestionResult,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  D1Database Interface                                               */
/* ------------------------------------------------------------------ */

/**
 * Minimal D1Database interface matching Cloudflare D1 API.
 */
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
/*  DDL — Database Schema Definition                                  */
/* ------------------------------------------------------------------ */

/**
 * DDL for the crown_corporations table.
 *
 * Stores metadata about crown corporation reports (annual reports,
 * quarterly financials, corporate plans, board minutes, etc.).
 *
 * The primary key is a SHA-256 hash of the record content for
 * deduplication. Indexes support key query patterns:
 *   - By org (find all records for a crown corp)
 *   - By fiscal year (chronological queries)
 *   - By report type (filter by document type)
 *   - By revenue/income range (financial analysis)
 *   - By date (recent publications)
 */
export const CROWN_CORPORATIONS_DDL = `
-- Crown corporation reports and financial data
CREATE TABLE IF NOT EXISTS crown_corporations (
  id TEXT PRIMARY KEY,

  -- Organization
  org TEXT NOT NULL CHECK(org IN ('CBC','CPC','CN','VIA','EDC','BDC','CMHC','CCC','NAC','NRC','CBCL','FCC','PBC','C.D.C.','OTHER')),
  org_name TEXT NOT NULL,

  -- Report metadata
  report_type TEXT NOT NULL CHECK(report_type IN ('annual-report','quarterly-financials','corporate-plan','board-minutes','executive-compensation','sustainability-report','diversity-report','other')),
  fiscal_year TEXT NOT NULL,
  fiscal_quarter TEXT,
  title TEXT,
  summary TEXT,

  -- Financial data
  revenue REAL,
  expenses REAL,
  net_income REAL,
  government_funding REAL,
  total_assets REAL,
  total_liabilities REAL,
  employee_count INTEGER,

  -- Governance
  executive_compensation TEXT,
  board_members TEXT,
  board_chair TEXT,
  ceo_name TEXT,

  -- Document references
  report_url TEXT,
  published_date TEXT,
  language TEXT DEFAULT 'en',

  -- Provenance
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL,

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  -- Deduplication constraint
  UNIQUE(org, fiscal_year, report_type, source_url)
);

CREATE INDEX IF NOT EXISTS idx_cc_org ON crown_corporations(org);
CREATE INDEX IF NOT EXISTS idx_cc_report_type ON crown_corporations(report_type);
CREATE INDEX IF NOT EXISTS idx_cc_fiscal_year ON crown_corporations(fiscal_year DESC);
CREATE INDEX IF NOT EXISTS idx_cc_published_date ON crown_corporations(published_date DESC);
CREATE INDEX IF NOT EXISTS idx_cc_org_fiscal ON crown_corporations(org, fiscal_year DESC);
CREATE INDEX IF NOT EXISTS idx_cc_org_type ON crown_corporations(org, report_type);
CREATE INDEX IF NOT EXISTS idx_cc_revenue ON crown_corporations(revenue DESC);
CREATE INDEX IF NOT EXISTS idx_cc_net_income ON crown_corporations(net_income DESC);
CREATE INDEX IF NOT EXISTS idx_cc_gov_funding ON crown_corporations(government_funding DESC);
CREATE INDEX IF NOT EXISTS idx_cc_ceo ON crown_corporations(ceo_name);
CREATE INDEX IF NOT EXISTS idx_cc_org_fiscal_type ON crown_corporations(org, fiscal_year, report_type);
CREATE INDEX IF NOT EXISTS idx_cc_ingested ON crown_corporations(ingested_at DESC);
`;

/* ------------------------------------------------------------------ */
/*  Database Operations                                                */
/* ------------------------------------------------------------------ */

/**
 * Initialize the crown_corporations table.
 */
export async function initializeCrownCorporationsTable(db: D1Database): Promise<void> {
  await db.exec(CROWN_CORPORATIONS_DDL);
}

/**
 * Insert (or ignore) a crown corporation record.
 *
 * @returns true if inserted, false if skipped (duplicate)
 */
async function upsertRecord(
  db: D1Database,
  record: CrownCorporationRecord,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO crown_corporations
      (id, org, org_name, report_type, fiscal_year, fiscal_quarter,
       title, summary, revenue, expenses, net_income, government_funding,
       total_assets, total_liabilities, employee_count,
       executive_compensation, board_members, board_chair, ceo_name,
       report_url, published_date, language, source_url, source_system,
       ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    record.org,
    record.orgName,
    record.reportType,
    record.fiscalYear,
    record.fiscalQuarter,
    record.title,
    record.summary,
    record.revenue,
    record.expenses,
    record.netIncome,
    record.governmentFunding,
    record.totalAssets,
    record.totalLiabilities,
    record.employeeCount,
    record.executiveCompensation,
    record.boardMembers,
    record.boardChair,
    record.ceoName,
    record.reportUrl,
    record.publishedDate,
    record.language,
    record.sourceUrl,
    record.sourceSystem,
    record.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}

/**
 * Check if a record already exists by org, fiscal year, report type, and URL.
 */
export async function recordExists(
  db: D1Database,
  record: CrownCorporationRecord,
): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 FROM crown_corporations
     WHERE org = ? AND fiscal_year = ? AND report_type = ? AND source_url = ?
     LIMIT 1`,
  ).bind(
    record.org,
    record.fiscalYear,
    record.reportType,
    record.sourceUrl,
  ).first();

  return row !== null;
}

/**
 * Get the latest published date in the database for an org.
 */
export async function getLatestPublishedDate(
  db: D1Database,
  org?: CrownCorporationCode,
): Promise<string | null> {
  let sql = 'SELECT published_date FROM crown_corporations';
  const params: unknown[] = [];

  if (org) {
    sql += ' WHERE org = ?';
    params.push(org);
  }

  sql += ' ORDER BY published_date DESC LIMIT 1';

  const row = await db.prepare(sql).bind(...params).first<{ published_date: string }>();
  return row?.published_date ?? null;
}

/**
 * Check if the crown_corporations table exists.
 */
export async function crownCorporationsTableExists(db: D1Database): Promise<boolean> {
  try {
    const row = await db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='crown_corporations'`,
    ).first();
    return row !== null;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Ingestion Orchestrator                                             */
/* ------------------------------------------------------------------ */

/**
 * Ingest crown corporation records into the database.
 *
 * Orchestrates:
 *   1. Initialize table (if requested)
 *   2. Fetch report links from each crown corp's listing page
 *   3. Parse and normalize records into unified schema
 *   4. Deduplicate and persist to D1
 *
 * @param db - D1 database instance (null to dry-run)
 * @param options - Ingestion options
 * @returns Ingestion result with counts and errors
 */
export async function ingestCrownCorporations(
  db: D1Database | null,
  options: CrownCorporationIngestionOptions = {},
): Promise<CrownCorporationIngestionResult> {
  const startTime = Date.now();
  const result: CrownCorporationIngestionResult = {
    recordsFound: 0,
    recordsIngested: 0,
    newRecords: 0,
    errors: [],
    perOrg: {},
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});
  const maxRecordsPerOrg = options.maxRecordsPerOrg ?? 100;
  const orgs = options.orgs ?? CURRENT_CROWN_CORPS.map((c) => c.code);

  try {
    // Phase 0: Initialize table if requested
    if (db && options.initializeTable) {
      log('[CrownCorp] Initializing table...');
      await initializeCrownCorporationsTable(db);
    }

    // Phase 1-3: For each org, fetch, parse, persist
    for (const org of orgs) {
      const orgStart = Date.now();
      const orgResult = {
        recordsFound: 0,
        recordsIngested: 0,
        newRecords: 0,
        errors: [] as string[],
      };

      const config = CROWN_CORP_CONFIGS[org];
      const orgLabel = config?.shortName ?? org;

      log(`[CrownCorp] Processing ${orgLabel}...`);

      try {
        // Phase 1: Fetch raw records
        const rawRecords = await fetchCrownCorpReport(org, {
          reportTypes: options.reportTypes,
          fiscalYear: options.fiscalYear,
          dateFrom: options.dateFrom,
          dateTo: options.dateTo,
          maxRecords: maxRecordsPerOrg,
        });

        orgResult.recordsFound = rawRecords.length;
        log(`[CrownCorp] ${orgLabel}: Found ${rawRecords.length} records`);

        if (rawRecords.length === 0) {
          result.perOrg[org] = orgResult;
          continue;
        }

        // Phase 2: Parse (records from fetcher are already CrownCorporationRecord objects)
        const parsedRecords = await parseRecords(
          rawRecords,
          org,
        );

        log(`[CrownCorp] ${orgLabel}: Parsed ${parsedRecords.length} unique records`);

        // Phase 3: Persist to database
        if (db) {
          for (const record of parsedRecords) {
            try {
              if (!options.force) {
                const exists = await recordExists(db, record);
                if (exists) continue;
              }

              const inserted = await upsertRecord(db, record);
              if (inserted) {
                orgResult.newRecords++;
              }
              orgResult.recordsIngested++;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              orgResult.errors.push(`Record ${record.id?.substring(0, 12) ?? 'unknown'}: ${msg}`);
            }
          }
        } else {
          // Dry run — count all as ingested
          orgResult.recordsIngested = parsedRecords.length;
          orgResult.newRecords = parsedRecords.length;
        }

        log(`[CrownCorp] ${orgLabel}: ${orgResult.recordsIngested}/${orgResult.recordsFound} records` +
          (orgResult.newRecords > 0 ? ` (${orgResult.newRecords} new)` : '') +
          (orgResult.errors.length > 0 ? `, ${orgResult.errors.length} errors` : ''));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        orgResult.errors.push(`FATAL: ${msg}`);
        log(`[CrownCorp] ${orgLabel}: FATAL — ${msg}`);
      }

      result.perOrg[org] = orgResult;

      // Also upsert crown corp as organization in shared tables
      if (config) {
        try {
          upsertOrganization(config.name, {
            type: "crown_corporation",
            province: undefined,
            website: config.homepageUrl,
            source: "crown-corporations",
            rawData: {
              code: config.code,
              shortName: config.shortName,
              annualReportsUrl: config.annualReportsUrl,
              quarterlyReportsUrl: config.quarterlyReportsUrl,
            },
          });
        } catch { /* non-fatal */ }
      }

      // Accumulate totals
      result.recordsFound += orgResult.recordsFound;
      result.recordsIngested += orgResult.recordsIngested;
      result.newRecords += orgResult.newRecords;
      result.errors.push(...orgResult.errors.map((e) => `[${org}] ${e}`));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`GLOBAL FATAL: ${msg}`);
    log(`[CrownCorp] GLOBAL FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(
    `[CrownCorp] Done in ${result.durationMs}ms: ${result.recordsIngested}/${result.recordsFound} records` +
    (result.newRecords > 0 ? ` (${result.newRecords} new)` : '') +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''),
  );

  return result;
}

/**
 * Ingest all crown corporations at once.
 * Convenience wrapper for ingestCrownCorporations with all current corps.
 */
export async function ingestAllCrownCorporations(
  db: D1Database | null,
  options: CrownCorporationIngestionOptions = {},
): Promise<CrownCorporationIngestionResult> {
  return ingestCrownCorporations(db, {
    ...options,
    orgs: options.orgs ?? CURRENT_CROWN_CORPS.map((c) => c.code),
  });
}

/* ------------------------------------------------------------------ */
/*  Query Functions                                                    */
/* ------------------------------------------------------------------ */

/**
 * Search crown corporation records by keyword across multiple fields.
 *
 * @param db - D1 database instance
 * @param query - Search terms
 * @param limit - Maximum results (default: 50)
 */
export async function searchCrownCorporations(
  db: D1Database,
  query: string,
  limit: number = 50,
): Promise<CrownCorporationRecord[]> {
  const searchTerm = `%${query.toLowerCase()}%`;

  const stmt = db.prepare(`
    SELECT * FROM crown_corporations
    WHERE LOWER(org_name) LIKE ?
       OR LOWER(title) LIKE ?
       OR LOWER(summary) LIKE ?
       OR LOWER(ceo_name) LIKE ?
       OR LOWER(board_chair) LIKE ?
       OR LOWER(fiscal_year) LIKE ?
    ORDER BY published_date DESC, fiscal_year DESC
    LIMIT ?
  `).bind(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, limit);

  const result = await stmt.all<CrownCorporationRecord>();
  return result.results ?? [];
}

/**
 * Get records by crown corporation.
 *
 * @param db - D1 database instance
 * @param org - Crown corporation code
 * @param reportType - Optional report type filter
 * @param limit - Maximum results (default: 50)
 */
export async function getByOrg(
  db: D1Database,
  org: CrownCorporationCode,
  reportType?: ReportType,
  limit: number = 50,
): Promise<CrownCorporationRecord[]> {
  const conditions: string[] = ['org = ?'];
  const params: unknown[] = [org];

  if (reportType) {
    conditions.push('report_type = ?');
    params.push(reportType);
  }

  const sql = `SELECT * FROM crown_corporations
    WHERE ${conditions.join(' AND ')}
    ORDER BY fiscal_year DESC, published_date DESC
    LIMIT ?`;
  params.push(limit);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<CrownCorporationRecord>();
  return result.results ?? [];
}

/**
 * Get records by fiscal year.
 *
 * @param db - D1 database instance
 * @param fiscalYear - Fiscal year (e.g. "2024", "2023-24")
 * @param org - Optional org filter
 * @param limit - Maximum results (default: 50)
 */
export async function getByFiscalYear(
  db: D1Database,
  fiscalYear: string,
  org?: CrownCorporationCode,
  limit: number = 50,
): Promise<CrownCorporationRecord[]> {
  const conditions: string[] = ['fiscal_year = ?'];
  const params: unknown[] = [fiscalYear];

  if (org) {
    conditions.push('org = ?');
    params.push(org);
  }

  const sql = `SELECT * FROM crown_corporations
    WHERE ${conditions.join(' AND ')}
    ORDER BY org, report_type
    LIMIT ?`;
  params.push(limit);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<CrownCorporationRecord>();
  return result.results ?? [];
}

/**
 * Get the most recent records across all crown corporations.
 *
 * @param db - D1 database instance
 * @param limit - Maximum results (default: 20)
 */
export async function getRecentRecords(
  db: D1Database,
  limit: number = 20,
): Promise<CrownCorporationRecord[]> {
  const stmt = db.prepare(`
    SELECT * FROM crown_corporations
    ORDER BY published_date DESC, ingested_at DESC
    LIMIT ?
  `).bind(limit);

  const result = await stmt.all<CrownCorporationRecord>();
  return result.results ?? [];
}

/**
 * Get aggregate financial stats by fiscal year.
 *
 * @param db - D1 database instance
 * @param fiscalYear - Fiscal year to aggregate
 */
export async function getAnnualFinancials(
  db: D1Database,
  fiscalYear: string,
): Promise<Array<{
  org: string;
  org_name: string;
  revenue: number | null;
  expenses: number | null;
  net_income: number | null;
  government_funding: number | null;
  employee_count: number | null;
}>> {
  const stmt = db.prepare(`
    SELECT org, org_name,
           revenue, expenses, net_income,
           government_funding, employee_count
    FROM crown_corporations
    WHERE fiscal_year = ? AND report_type = 'annual-report'
    ORDER BY org
  `).bind(fiscalYear);

  const result = await stmt.all<{
    org: string;
    org_name: string;
    revenue: number | null;
    expenses: number | null;
    net_income: number | null;
    government_funding: number | null;
    employee_count: number | null;
  }>();
  return result.results ?? [];
}
