/**
 * CRA Charity T3010 Ingestion — Quill
 *
 * Orchestrates the CRA List of Charities (T3010) ingestion pipeline:
 *   1. Discover available resources for a given year
 *   2. Download identification CSV + financial CSV + programs CSV
 *   3. Parse CSVs and join by BN into CraCharityT3010 records
 *   4. Persist to D1 database (when available)
 *
 * News / intelligence value:
 *   - Track funding of advocacy groups, think tanks, and NGOs
 *   - Identify organizations engaged in political activities
 *   - Cross-reference with lobbying registry, procurement, committee testimony
 *   - Reveal who funds organizations that influence Canadian policy
 *
 * Data source:
 *   - CRA List of Charities: yearly datasets on open.canada.ca (1991–2024)
 *   - Each year has separate CSVs for identification, financials, programs
 *   - Check the specific publisher terms and dataset-level license metadata
 *
 * Designed to run as a cron job (yearly) or ad-hoc per year.
 */

import type { D1Database } from '../committees/db.js';
import {
  fetchCraIdentCsv,
  fetchCraFinancialCsv,
  fetchCraGeneralCsv,
  fetchCraProgramsCsv,
  listAvailableYears,
  CraCharityFetchError,
} from './fetcher.js';
import { parseCraCsvs, parseCraIdentCsv } from './parser.js';
import {
  CRA_CHARITY_T3010_DDL,
  CRA_DEFAULT_YEAR,
  CRA_CHARITY_PACKAGE_IDS,
  ckanPackageUrl,
} from './constants.js';
import {
  type CraCharityT3010,
  type CraCharityIngestionResult,
} from './types.js';


/* ------------------------------------------------------------------ */
/*  Main Ingestion Entry Point                                         */
/* ------------------------------------------------------------------ */

/**
 * Ingest CRA charity T3010 records for a given dataset year.
 *
 * Steps:
 *   1. Discover available CSV resources for the year
 *   2. Download identification, financial, general, and programs CSVs
 *   3. Parse and join by BN into CraCharityT3010 records
 *   4. Persist to database (when db is provided)
 *
 * @param db - D1 database instance (or null for dry-run)
 * @param year - Dataset year (e.g. "2024"). Defaults to latest known.
 * @param options - Ingestion options
 */
export async function ingestCraCharities(
  db: D1Database | null,
  year: string = CRA_DEFAULT_YEAR,
  options: {
    /** Only ingest charities matching this keyword search (name/BN) */
    keyword?: string;
    /** Re-fetch and re-parse already-ingested records */
    force?: boolean;
    /** Skip downloading programs CSV (faster, less rich) */
    skipPrograms?: boolean;
    /** Progress callback */
    onProgress?: (msg: string) => void;
  } = {},
): Promise<CraCharityIngestionResult> {
  const startTime = Date.now();
  const result: CraCharityIngestionResult = {
    datasetYear: year,
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    // Build source URL
    const pkgId = CRA_CHARITY_PACKAGE_IDS[year];
    const sourceUrl = pkgId
      ? ckanPackageUrl(year)
      : `https://open.canada.ca/data/en/dataset?q=List+of+charities+${year}`;

    // Phase 1: Download CSV data
    log(`[CRA Charity ${year}] Downloading identification CSV...`);
    const identCsv = await fetchCraIdentCsv(year);
    log(`[CRA Charity ${year}] Downloaded ${(identCsv.length / 1024).toFixed(0)} KB identification data`);

    log(`[CRA Charity ${year}] Downloading financial CSV...`);
    const financialCsv = await fetchCraFinancialCsv(year);
    log(`[CRA Charity ${year}] Downloaded ${(financialCsv.length / 1024).toFixed(0)} KB financial data`);

    // Download general info (compensation, fiscal dates)
    let generalCsv = '';
    try {
      log(`[CRA Charity ${year}] Downloading general info CSV...`);
      generalCsv = await fetchCraGeneralCsv(year);
      log(`[CRA Charity ${year}] Downloaded ${(generalCsv.length / 1024).toFixed(0)} KB general info`);
    } catch {
      log(`[CRA Charity ${year}] General info CSV not available, continuing without it`);
    }

    // Download charitable programs CSV
    let programsCsv = '';
    if (!options.skipPrograms) {
      try {
        log(`[CRA Charity ${year}] Downloading charitable programs CSV...`);
        programsCsv = await fetchCraProgramsCsv(year);
        log(`[CRA Charity ${year}] Downloaded ${(programsCsv.length / 1024).toFixed(0)} KB programs data`);
      } catch {
        log(`[CRA Charity ${year}] Programs CSV not available, continuing without it`);
      }
    }

    // Phase 2: Parse and join CSV data
    log(`[CRA Charity ${year}] Parsing and joining CSV records...`);
    const allRecords = await parseCraCsvs(
      { identCsv, financialCsv, generalCsv, programsCsv },
      year,
      sourceUrl,
    );

    result.recordsFound = allRecords.length;
    log(`[CRA Charity ${year}] Joined ${allRecords.length} charity records`);

    if (allRecords.length === 0) {
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Apply keyword filter if specified
    const toProcess = options.keyword
      ? allRecords.filter(r =>
          r.legalName.toLowerCase().includes(options.keyword!.toLowerCase()) ||
          r.bn.includes(options.keyword!),
        )
      : allRecords;

    log(`[CRA Charity ${year}] Processing ${toProcess.length} records${options.keyword ? ` (filtered by "${options.keyword}")` : ''}`);

    // Phase 3: Persist to database
    if (db) {
      log(`[CRA Charity ${year}] Persisting to database...`);
      for (const record of toProcess) {
        try {
          await upsertCraCharityRecord(db, record);
          result.recordsIngested++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`${record.legalName} (${record.bn}): ${msg}`);
        }
      }
      log(`[CRA Charity ${year}] Persisted ${result.recordsIngested}/${toProcess.length} records`);
    } else {
      // No database — count all as ingested (dry-run mode)
      result.recordsIngested = toProcess.length;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`CRA Charity ${year}: ${msg}`);
    log(`[CRA Charity ${year}] FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(
    `[CRA Charity ${year}] Done in ${result.durationMs}ms: ${result.recordsIngested}/${result.recordsFound} records` +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''),
  );

  return result;
}


/**
 * Ingest all available years of CRA charity data.
 *
 * Processes each year sequentially (to be gentle on the CKAN API).
 *
 * @param db - D1 database instance (or null for dry-run)
 * @param options - Options passed to each year's ingestion
 */
export async function ingestAllCraCharityYears(
  db: D1Database | null,
  options: {
    /** Years to ingest (default: latest year only). Use "all" for all known */
    years?: string[];
    force?: boolean;
    skipPrograms?: boolean;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<Record<string, CraCharityIngestionResult>> {
  const log = options.onProgress ?? (() => {});

  const years = options.years ?? [CRA_DEFAULT_YEAR];
  log(`=== CRA Charity T3010 Ingestion: ${years.join(', ')} ===`);

  const results: Record<string, CraCharityIngestionResult> = {};

  for (const year of years) {
    const yearResult = await ingestCraCharities(db, year, options);
    results[year] = yearResult;
  }

  const totalFound = Object.values(results).reduce((s, r) => s + r.recordsFound, 0);
  const totalIngested = Object.values(results).reduce((s, r) => s + r.recordsIngested, 0);
  const totalErrors = Object.values(results).reduce((s, r) => s + r.errors.length, 0);
  log(`=== CRA Charity Summary: ${totalIngested}/${totalFound} records, ${totalErrors} errors ===`);

  return results;
}


/* ------------------------------------------------------------------ */
/*  Database Operations                                                */
/* ------------------------------------------------------------------ */

/**
 * Insert or replace a CRA charity T3010 record in the D1 database.
 */
async function upsertCraCharityRecord(
  db: D1Database,
  record: CraCharityT3010,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO cra_charity_t3010
      (id, bn, legal_name, operating_name, category, designation,
       status, fiscal_year_start, fiscal_year_end,
       total_revenue, total_expenses, total_assets, total_liabilities,
       compensation_key_employees, charitable_programs_description,
       political_activities_amount, grants_amount,
       dataset_year, source_url, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    record.bn,
    record.legalName,
    record.operatingName,
    record.category,
    record.designation,
    record.status,
    record.fiscalYearStart,
    record.fiscalYearEnd,
    record.totalRevenue,
    record.totalExpenses,
    record.totalAssets,
    record.totalLiabilities,
    record.compensationKeyEmployees,
    record.charitableProgramsDescription,
    record.politicalActivitiesAmount,
    record.grantsAmount,
    record.datasetYear,
    record.sourceUrl,
    record.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}


/**
 * Initialize the cra_charity_t3010 table.
 */
export async function initializeCraCharityTable(db: D1Database): Promise<void> {
  await db.exec(CRA_CHARITY_T3010_DDL);
}


/* ------------------------------------------------------------------ */
/*  Query Helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Search charity records by name or BN.
 */
export async function searchCraCharities(
  db: D1Database,
  query: string,
  options: {
    year?: string;
    category?: string;
    status?: string;
    limit?: number;
  } = {},
): Promise<CraCharityT3010[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  conditions.push('(legal_name LIKE ? OR bn LIKE ? OR operating_name LIKE ?)');
  const q = `%${query}%`;
  params.push(q, q, q);

  if (options.year) {
    conditions.push('dataset_year = ?');
    params.push(options.year);
  }

  if (options.category) {
    conditions.push('category = ?');
    params.push(options.category);
  }

  if (options.status) {
    conditions.push('status = ?');
    params.push(options.status);
  }

  const where = conditions.join(' AND ');
  const sql = `SELECT * FROM cra_charity_t3010 WHERE ${where} ORDER BY total_revenue DESC LIMIT ?`;
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<CraCharityT3010>();
  return result.results ?? [];
}


/**
 * Get charities with the highest political activities spending.
 */
export async function getTopPoliticalSpenders(
  db: D1Database,
  year?: string,
  limit: number = 50,
): Promise<CraCharityT3010[]> {
  const conditions: string[] = ['political_activities_amount > 0'];
  const params: unknown[] = [];

  if (year) {
    conditions.push('dataset_year = ?');
    params.push(year);
  }

  const where = conditions.join(' AND ');
  const sql = `SELECT * FROM cra_charity_t3010 WHERE ${where} ORDER BY political_activities_amount DESC LIMIT ?`;
  params.push(limit);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<CraCharityT3010>();
  return result.results ?? [];
}


/**
 * Get charities sorted by revenue (top N).
 */
export async function getTopCharitiesByRevenue(
  db: D1Database,
  year?: string,
  limit: number = 50,
): Promise<CraCharityT3010[]> {
  const conditions: string[] = ['total_revenue > 0'];
  const params: unknown[] = [];

  if (year) {
    conditions.push('dataset_year = ?');
    params.push(year);
  }

  const where = conditions.join(' AND ');
  const sql = `SELECT * FROM cra_charity_t3010 WHERE ${where} ORDER BY total_revenue DESC LIMIT ?`;
  params.push(limit);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<CraCharityT3010>();
  return result.results ?? [];
}


/**
 * Get charities by category with aggregate stats.
 */
export async function getCraCharityStats(
  db: D1Database,
  year?: string,
): Promise<{
  totalRecords: number;
  byCategory: Array<{ category: string; count: number; totalRevenue: number }>;
  byStatus: Array<{ status: string; count: number }>;
  totalPoliticalSpending: number;
}> {
  const yearCondition = year ? 'WHERE dataset_year = ?' : '';
  const params = year ? [year] : [];

  const totalSql = `SELECT COUNT(*) as count FROM cra_charity_t3010 ${yearCondition}`;
  const totalResult = await db.prepare(totalSql).bind(...params).first<{ count: number }>();

  const categorySql = `
    SELECT category, COUNT(*) as count, SUM(COALESCE(total_revenue, 0)) as total_revenue
    FROM cra_charity_t3010 ${yearCondition}
    GROUP BY category ORDER BY count DESC
  `;
  const categoryResult = await db.prepare(categorySql).bind(...params).all<{
    category: string;
    count: number;
    total_revenue: number;
  }>();

  const statusSql = `
    SELECT status, COUNT(*) as count
    FROM cra_charity_t3010 ${yearCondition}
    GROUP BY status ORDER BY count DESC
  `;
  const statusResult = await db.prepare(statusSql).bind(...params).all<{
    status: string;
    count: number;
  }>();

  const politicalSql = `
    SELECT SUM(COALESCE(political_activities_amount, 0)) as total
    FROM cra_charity_t3010 ${yearCondition}
  `;
  const politicalResult = await db.prepare(politicalSql).bind(...params).first<{ total: number }>();

  return {
    totalRecords: totalResult?.count ?? 0,
    byCategory: (categoryResult.results ?? []).map(r => ({
      category: r.category,
      count: r.count,
      totalRevenue: r.total_revenue,
    })),
    byStatus: (statusResult.results ?? []).map(r => ({
      status: r.status,
      count: r.count,
    })),
    totalPoliticalSpending: politicalResult?.total ?? 0,
  };
}


/* ------------------------------------------------------------------ */
/*  Barrelled Re-exports                                               */
/* ------------------------------------------------------------------ */

export {
  fetchCraIdentCsv,
  fetchCraFinancialCsv,
  fetchCraGeneralCsv,
  fetchCraProgramsCsv,
  fetchCraAllCsvs,
  fetchCraCkanMetadata,
  discoverCraResources,
  listAvailableYears,
  CraCharityFetchError,
} from './fetcher.js';

export {
  parseCraCsvs,
  parseCraIdentCsv,
  parseCsvLine,
  parseCurrency,
  normalizeHeader,
} from './parser.js';

export {
  CRA_CHARITY_T3010_DDL,
  CRA_CHARITY_PACKAGE_IDS,
  CRA_DEFAULT_YEAR,
  CRA_CKAN,
  CRA_CHARITY_SEARCH_URL,
  CRA_CSV_DOWNLOAD_URL,
  ckanPackageUrl as craCkanPackageUrl,
  ckanDownloadUrl as craCkanDownloadUrl,
  craSearchUrl,
} from './constants.js';

export type {
  CraCharityT3010,
  CraCharityIngestionResult,
} from './types.js';

export {
  CharityCategory,
  CharityDesignation,
  CharityStatus,
} from './types.js';
