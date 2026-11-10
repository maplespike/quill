// SPDX-License-Identifier: AGPL-3.0-only
/**
 * SEDAR+ Corporate Filings Module — Quill
 *
 * Ingests Canadian securities filings from the SEDAR+ system (sedarplus.ca),
 * Canada's national repository for corporate disclosure documents.
 *
 * Features:
 *   - Search filings by issuer, type, date range, jurisdiction
 *   - Fetch issuer/company profiles
 *   - Track AIF, financial statements, MD&A, prospectuses, material changes
 *   - Dry-run mode for testing without database
 *
 * Sources:
 *   CD Plus API:   https://services.cdplus.ca/api
 *   SEDAR+ Portal: https://www.sedarplus.ca
 *   Legacy SEDAR:  https://www.sedar.com (pre-2024 filings)
 */

import { httpGet } from '../../utils/http.js';
import {
  searchFilings,
  searchFilingsByIssuer,
  fetchRecentFilings,
  fetchAifFilings,
  fetchIssuer,
} from './fetcher.js';
import {
  CDPLUS_SEARCH_URL,
  CDPLUS_ISSUER_URL,
  SEDARPLUS_DDL,
  TRACKED_ISSUERS,
  SEDARPLUS_TIMEOUT_MS,
  SEDARPLUS_DEFAULT_HEADERS,
  findIssuerByTicker,
  findIssuerByName,
} from './constants.js';
import type {
  SedarFiling,
  SedarSearchParams,
  SedarSearchResult,
  SedarIngestionResult,
  SedarIssuer,
} from './types.js';

export type {
  SedarFiling,
  SedarSearchParams,
  SedarSearchResult,
  SedarIngestionResult,
  SedarIssuer,
};

export {
  searchFilings,
  searchFilingsByIssuer,
  fetchRecentFilings,
  fetchAifFilings,
  fetchIssuer,
  findIssuerByTicker,
  findIssuerByName,
};

/* ------------------------------------------------------------------ */
/*  Database Interface                                                 */
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
/*  Database Operations                                                */
/* ------------------------------------------------------------------ */

/**
 * Initialize the sedar_filings table.
 */
export async function initializeSedarTable(db: D1Database): Promise<void> {
  await db.exec(SEDARPLUS_DDL);
}

/**
 * Insert or replace a SedarFiling record in the database.
 */
async function upsertFiling(
  db: D1Database,
  filing: SedarFiling,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO sedar_filings
      (filing_id, issuer_id, issuer_name, filing_date, period_end,
       filing_type, filing_type_raw, title, description, document_url,
       file_size_bytes, file_format, language, jurisdiction, status,
       project_number, is_legacy, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    filing.filingId,
    filing.issuerId,
    filing.issuerName,
    filing.filingDate,
    filing.periodEnd,
    filing.filingType,
    filing.filingTypeRaw,
    filing.title,
    filing.description,
    filing.documentUrl,
    filing.fileSizeBytes,
    filing.fileFormat,
    filing.language,
    filing.jurisdiction,
    filing.status,
    filing.projectNumber,
    filing.isLegacy ? 1 : 0,
    filing.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}

/**
 * Check if a filing already exists by document URL.
 */
export async function filingExistsByUrl(
  db: D1Database,
  documentUrl: string,
): Promise<boolean> {
  const row = await db.prepare(
    'SELECT 1 FROM sedar_filings WHERE document_url = ? LIMIT 1',
  ).bind(documentUrl).first();
  return row !== null;
}

/**
 * Search filings in the local database.
 */
export async function searchLocalFilings(
  db: D1Database,
  query: string,
  options: {
    filingType?: string;
    jurisdiction?: string;
    limit?: number;
  } = {},
): Promise<SedarFiling[]> {
  let sql = `
    SELECT * FROM sedar_filings
    WHERE (issuer_name LIKE ? OR issuer_id LIKE ? OR title LIKE ?)
  `;
  const params: unknown[] = [`%${query}%`, `%${query}%`, `%${query}%`];

  if (options.filingType) {
    sql += ' AND filing_type = ?';
    params.push(options.filingType);
  }

  if (options.jurisdiction) {
    sql += ' AND jurisdiction = ?';
    params.push(options.jurisdiction);
  }

  sql += ' ORDER BY filing_date DESC LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<SedarFiling>();
  return result.results ?? [];
}

/**
 * Get filings by issuer name from local database.
 */
export async function getFilingsByIssuer(
  db: D1Database,
  issuerName: string,
  options: { limit?: number } = {},
): Promise<SedarFiling[]> {
  const sql = `
    SELECT * FROM sedar_filings
    WHERE issuer_name = ?
    ORDER BY filing_date DESC
    LIMIT ?
  `;
  const stmt = db.prepare(sql).bind(issuerName, options.limit ?? 50);
  const result = await stmt.all<SedarFiling>();
  return result.results ?? [];
}

/* ------------------------------------------------------------------ */
/*  Core Ingestion Functions                                           */
/* ------------------------------------------------------------------ */

/**
 * Ingest SEDAR+ filings for a specific issuer.
 *
 * @param db - D1 database instance (null for dry-run)
 * @param issuer - Issuer name or ticker symbol
 * @param options - Ingestion options
 * @returns Ingestion result
 */
export async function ingestSedarByIssuer(
  db: D1Database | null,
  issuer: string,
  options: {
    fromDate?: string;
    toDate?: string;
    limit?: number;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<SedarIngestionResult> {
  const startTime = Date.now();
  const result: SedarIngestionResult = {
    totalFound: 0,
    totalFetched: 0,
    totalUnique: 0,
    totalNew: 0,
    errors: [],
    durationMs: 0,
    issuerName: issuer,
  };

  const log = options.onProgress ?? ((_msg: string) => {});

  try {
    log(`[SEDAR+] Searching filings for issuer: "${issuer}"...`);

    // Search CD Plus API
    const searchResult = await searchFilingsByIssuer(issuer, {
      fromDate: options.fromDate,
      toDate: options.toDate,
      limit: options.limit ?? 50,
    });

    result.totalFound = searchResult.total;
    result.totalFetched = searchResult.results.length;

    if (searchResult.results.length === 0) {
      log(`[SEDAR+] No filings found for issuer "${issuer}"`);
      result.durationMs = Date.now() - startTime;
      return result;
    }

    log(`[SEDAR+] Found ${searchResult.total} filings for "${issuer}"`);

    // Deduplicate by document URL
    const seen = new Set<string>();
    const uniqueFilings = searchResult.results.filter(f => {
      if (seen.has(f.documentUrl)) return false;
      seen.add(f.documentUrl);
      return true;
    });
    result.totalUnique = uniqueFilings.length;

    // Log top results
    for (const f of uniqueFilings.slice(0, 3)) {
      log(`  ${f.filingDate} | ${f.filingType} | ${f.title}`);
    }

    // Persist to database or dry-run
    if (db) {
      let ingested = 0;
      for (const filing of uniqueFilings) {
        try {
          const ok = await upsertFiling(db, filing);
          if (ok) ingested++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Insert ${filing.filingId}: ${msg}`);
          log(`[SEDAR+] ERROR inserting ${filing.issuerName}/${filing.filingDate}: ${msg}`);
        }
      }
      result.totalNew = ingested;
      log(`[SEDAR+] Persisted ${ingested} of ${uniqueFilings.length} filings for "${issuer}"`);
    } else {
      // Dry-run mode
      result.totalNew = uniqueFilings.length;
      result.filings = uniqueFilings;
      log(`[SEDAR+] Dry-run — ${uniqueFilings.length} filings available for "${issuer}"`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[SEDAR+] ERROR for issuer "${issuer}": ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/**
 * Ingest recent SEDAR+ filings across all tracked issuers.
 * Good for a broad sweep of the latest corporate filings.
 */
export async function ingestSedarRecent(
  db: D1Database | null,
  options: {
    limit?: number;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<SedarIngestionResult> {
  const startTime = Date.now();
  const result: SedarIngestionResult = {
    totalFound: 0,
    totalFetched: 0,
    totalUnique: 0,
    totalNew: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? ((_msg: string) => {});

  try {
    log('[SEDAR+] Fetching recent filings from SEDAR+...');

    const searchResult = await fetchRecentFilings(options.limit ?? 50);
    result.totalFound = searchResult.total;
    result.totalFetched = searchResult.results.length;

    if (searchResult.results.length === 0) {
      log('[SEDAR+] No recent filings found');
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Deduplicate
    const seen = new Set<string>();
    const unique = searchResult.results.filter(f => {
      if (seen.has(f.documentUrl)) return false;
      seen.add(f.documentUrl);
      return true;
    });
    result.totalUnique = unique.length;

    if (db) {
      let ingested = 0;
      for (const filing of unique) {
        try {
          const ok = await upsertFiling(db, filing);
          if (ok) ingested++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Insert ${filing.filingId}: ${msg}`);
        }
      }
      result.totalNew = ingested;
    } else {
      result.totalNew = unique.length;
      result.filings = unique;
    }

    log(`[SEDAR+] Recent filings: ${unique.length} unique, ${result.totalNew} ingested` +
      (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[SEDAR+] FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/**
 * Batch ingestion for all tracked TSX/TSXV issuers.
 * This is the main batch ingestion function.
 */
export async function ingestAllSedar(
  db: D1Database | null,
  options: {
    issuers?: string[];
    limit?: number;
    concurrency?: number;
    fromDate?: string;
    toDate?: string;
    includeRecent?: boolean;
    skipInit?: boolean;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<Record<string, SedarIngestionResult>> {
  const log = options.onProgress ?? ((_msg: string) => {});
  const results: Record<string, SedarIngestionResult> = {};
  const concurrency = options.concurrency ?? 2;

  log('=== SEDAR+ Corporate Filings Ingestion ===');
  log(`Target: ${options.issuers ? 'custom issuers' : 'all tracked TSX/TSXV issuers'}`);

  // Initialize DB table if needed
  if (db && !options.skipInit) {
    try {
      await initializeSedarTable(db);
      log('[SEDAR+] Table initialized');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`[SEDAR+] Table init warning: ${msg}`);
    }
  }

  // Optionally fetch recent filings first
  if (options.includeRecent) {
    const recentResult = await ingestSedarRecent(db, {
      limit: options.limit,
      onProgress: options.onProgress,
    });
    results['recent-filings'] = recentResult;
    log(`[SEDAR+] Recent filings: ${recentResult.totalNew} ingested`);
  }

  // Determine which issuers to process
  const issuersToProcess = options.issuers
    ? options.issuers
    : TRACKED_ISSUERS.map(i => i.ticker);

  log(`[SEDAR+] Processing ${issuersToProcess.length} issuers (concurrency: ${concurrency})`);

  // Process issuers with limited concurrency
  const batches: string[][] = [];
  for (let i = 0; i < issuersToProcess.length; i += concurrency) {
    batches.push(issuersToProcess.slice(i, i + concurrency));
  }

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(async (issuer) => {
        try {
          return await ingestSedarByIssuer(db, issuer, {
            fromDate: options.fromDate,
            toDate: options.toDate,
            limit: options.limit,
            onProgress: options.onProgress,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log(`[SEDAR+] Batch error for "${issuer}": ${msg}`);
          return {
            totalFound: 0,
            totalFetched: 0,
            totalUnique: 0,
            totalNew: 0,
            errors: [msg],
            durationMs: 0,
            issuerName: issuer,
          } as SedarIngestionResult;
        }
      }),
    );

    for (const batchResult of batchResults) {
      if (batchResult.issuerName) {
        results[batchResult.issuerName] = batchResult;
      }
    }
  }

  // Summary
  const totals = summarizeResults(results);
  log(`\n=== SEDAR+ Summary ===`);
  log(`Issuers: ${issuersToProcess.length}, ` +
    `Filings: ${totals.totalNew}/${totals.totalFound}, ` +
    `Errors: ${totals.totalErrors}`);

  // Highlight AIF filings (most valuable for analysis)
  const aifFilings = Object.values(results)
    .flatMap(r => (r.filings ?? []))
    .filter(f => f.filingType === 'aif');
  if (aifFilings.length > 0) {
    log(`\n📋 AIF Filings Found: ${aifFilings.length}`);
    for (const aif of aifFilings.slice(0, 5)) {
      log(`  ${aif.issuerName} | ${aif.filingDate} | ${aif.title}`);
    }
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  Utilities                                                          */
/* ------------------------------------------------------------------ */

interface SummaryTotals {
  totalFound: number;
  totalNew: number;
  totalErrors: number;
}

function summarizeResults(results: Record<string, SedarIngestionResult>): SummaryTotals {
  let totalFound = 0;
  let totalNew = 0;
  let totalErrors = 0;

  for (const result of Object.values(results)) {
    totalFound += result.totalFound;
    totalNew += result.totalNew;
    totalErrors += result.errors.length;
  }

  return { totalFound, totalNew, totalErrors };
}
