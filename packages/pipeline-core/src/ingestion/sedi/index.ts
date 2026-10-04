/**
 * SEDI Insider Trading Ingestion — Quill
 *
 * Orchestrates the ingestion pipeline for Canadian insider trading reports
 * from the System for Electronic Disclosure by Insiders (SEDI).
 *
 * This module tracks C-Suite executive stock trades at Canadian public
 * companies — catching executives selling shares before bad news.
 *
 * Architecture:
 *   1. Fetch HTML from SEDI (or SEDAR+ as fallback)
 *   2. Parse HTML tables into InsiderTransaction records
 *   3. Deduplicate by SHA-256 hash
 *   4. Persist to D1 database (when db provided)
 *   5. Return structured results (dry-run when db is null)
 *
 * Sources:
 *   SEDI:   https://www.sedi.ca/sedi/SVTOCPublish?language=en
 *   SEDAR+: https://www.sedarplus.ca
 *
 * Design notes:
 *   - SEDI has no public API — all data is HTML-scraped
 *   - SEDI may block automated requests; the module handles
 *     failures gracefully with logging, never crashes
 *   - Empty results are logged, not thrown as errors
 *   - SHA-256 hashing for content-based deduplication
 */

import { computeHash } from '../../verification/hashing.js';
import {
  fetchInsiderTransactions,
  fetchSediByIssuer,
  fetchSediFrontPage,
  SediFetchError,
} from './fetcher.js';
import {
  parseSediReport,
  deduplicateTransactions,
} from './parser.js';
import {
  SEDI_SEARCH_URL,
  SEDI_DDL,
  MAJOR_TSX_ISSUERS,
  TRACKED_EXEC_ORGS,
} from './constants.js';
import type {
  InsiderTransaction,
  SediIngestionResult,
  InsiderDataSource,
} from './types.js';

export type { InsiderTransaction, SediIngestionResult, InsiderDataSource };

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
 * Insert or replace an InsiderTransaction record in the database.
 */
async function upsertTransaction(
  db: D1Database,
  tx: InsiderTransaction,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO insider_transactions
      (id, insider_name, insider_relation, issuer_name, issuer_ticker,
       transaction_date, filing_date, transaction_type, security_type,
       number_of_units, unit_price, total_value, currency,
       ownership_after, source_url, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    tx.id,
    tx.insiderName,
    tx.insiderRelation,
    tx.issuerName,
    tx.issuerTicker,
    tx.transactionDate,
    tx.filingDate,
    tx.transactionType,
    tx.securityType,
    tx.numberOfUnits,
    tx.unitPrice,
    tx.totalValue,
    tx.currency,
    tx.ownershipAfter,
    tx.sourceUrl,
    tx.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}

/**
 * Initialize the insider_transactions table.
 */
export async function initializeSediTable(db: D1Database): Promise<void> {
  await db.exec(SEDI_DDL);
}

/**
 * Get the most recent transaction date for incremental ingestion.
 */
export async function getLatestTransactionDate(
  db: D1Database,
): Promise<string | null> {
  const row = await db.prepare(
    'SELECT transaction_date FROM insider_transactions ORDER BY transaction_date DESC LIMIT 1',
  ).first<{ transaction_date: string }>();
  return row?.transaction_date ?? null;
}

/**
 * Check if a transaction already exists by source URL.
 */
export async function transactionExistsBySource(
  db: D1Database,
  sourceUrl: string,
): Promise<boolean> {
  const row = await db.prepare(
    'SELECT 1 FROM insider_transactions WHERE source_url = ? LIMIT 1',
  ).bind(sourceUrl).first();
  return row !== null;
}

/**
 * Search insider transactions by issuer name or ticker.
 */
export async function searchInsiderTransactions(
  db: D1Database,
  query: string,
  options: {
    transactionType?: string;
    limit?: number;
  } = {},
): Promise<InsiderTransaction[]> {
  let sql = `
    SELECT * FROM insider_transactions
    WHERE (issuer_name LIKE ? OR issuer_ticker LIKE ? OR insider_name LIKE ?)
  `;
  const params: unknown[] = [`%${query}%`, `%${query}%`, `%${query}%`];

  if (options.transactionType) {
    sql += ' AND transaction_type = ?';
    params.push(options.transactionType);
  }

  sql += ' ORDER BY transaction_date DESC LIMIT ?';
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<InsiderTransaction>();
  return result.results ?? [];
}

/* ------------------------------------------------------------------ */
/*  Core Ingestion Logic                                               */
/* ------------------------------------------------------------------ */

/**
 * Ingest insider transactions for a single issuer.
 *
 * @param db - D1 database instance (null for dry-run/return-only mode)
 * @param issuer - Issuer name or ticker symbol
 * @param options - Ingestion options
 * @returns Ingestion result for this issuer
 */
export async function ingestSediByIssuer(
  db: D1Database | null,
  issuer: string,
  options: {
    fromDate?: string;
    toDate?: string;
    limit?: number;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<SediIngestionResult> {
  const startTime = Date.now();
  const result: SediIngestionResult = {
    rowsFound: 0,
    rowsParsed: 0,
    rowsIngested: 0,
    errors: [],
    durationMs: 0,
    issuer,
  };

  const log = options.onProgress ?? ((msg: string) => {});

  try {
    log(`[SEDI] Fetching insider transactions for issuer: "${issuer}"...`);

    // Phase 1: Fetch HTML from SEDI (with SEDAR+ fallback)
    const { source, html, sourceUrl } = await fetchInsiderTransactions(issuer, {
      fromDate: options.fromDate,
      toDate: options.toDate,
    });

    if (!html || html.trim().length === 0) {
      log(`[SEDI] No data returned for issuer "${issuer}" (source: ${source})`);
      result.durationMs = Date.now() - startTime;
      return result;
    }

    log(`[SEDI] Fetched HTML from ${source.toUpperCase()} (${html.length} bytes)`);

    // Phase 2: Parse HTML into InsiderTransaction records
    const allTransactions = await parseSediReport(html, sourceUrl);

    if (allTransactions.length === 0) {
      log(`[SEDI] No transactions parsed for issuer "${issuer}"`);
      result.durationMs = Date.now() - startTime;
      return result;
    }

    result.rowsFound = allTransactions.length;

    // Phase 3: Deduplicate
    const uniqueTransactions = deduplicateTransactions(allTransactions);
    result.rowsParsed = uniqueTransactions.length;

    if (uniqueTransactions.length === 0) {
      log(`[SEDI] All transactions were duplicates for issuer "${issuer}"`);
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Apply limit
    const limited = options.limit
      ? uniqueTransactions.slice(0, options.limit)
      : uniqueTransactions;

    log(`[SEDI] ${uniqueTransactions.length} unique transactions (showing top results):`);
    for (const tx of limited.slice(0, 3)) {
      log(`  ${tx.transactionDate} | ${tx.insiderName} (${tx.insiderRelation}) | ` +
        `${tx.transactionType} ${tx.numberOfUnits} ${tx.securityType} @ $${tx.unitPrice}`);
    }

    // Phase 4: Persist to database or store in result
    if (db) {
      let ingested = 0;
      for (const tx of limited) {
        try {
          const ok = await upsertTransaction(db, tx);
          if (ok) ingested++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Insert ${tx.id}: ${msg}`);
          log(`[SEDI] ERROR inserting ${tx.insiderName}/${tx.transactionDate}: ${msg}`);
        }
      }
      result.rowsIngested = ingested;
      log(`[SEDI] Persisted ${ingested} of ${limited.length} transactions for "${issuer}"`);
    } else {
      // Dry-run mode
      result.rowsIngested = limited.length;
      result.records = limited;
      log(`[SEDI] Dry-run — ${limited.length} transactions available for "${issuer}"`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[SEDI] ERROR for issuer "${issuer}": ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/**
 * Ingest recent insider transactions from SEDI's front page / recent filings.
 * Good for a broad sweep of recent insider activity across all issuers.
 */
export async function ingestSediRecent(
  db: D1Database | null,
  options: {
    limit?: number;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<SediIngestionResult> {
  const startTime = Date.now();
  const result: SediIngestionResult = {
    rowsFound: 0,
    rowsParsed: 0,
    rowsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? ((msg: string) => {});

  try {
    log('[SEDI] Fetching recent insider filings from SEDI front page...');

    const html = await fetchSediFrontPage();
    if (!html || html.trim().length === 0) {
      log('[SEDI] No data from SEDI front page');
      result.durationMs = Date.now() - startTime;
      return result;
    }

    const allTransactions = await parseSediReport(html, SEDI_SEARCH_URL);
    result.rowsFound = allTransactions.length;

    const unique = deduplicateTransactions(allTransactions);
    result.rowsParsed = unique.length;

    const limited = options.limit ? unique.slice(0, options.limit) : unique;

    if (db) {
      let ingested = 0;
      for (const tx of limited) {
        try {
          const ok = await upsertTransaction(db, tx);
          if (ok) ingested++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Insert ${tx.id}: ${msg}`);
        }
      }
      result.rowsIngested = ingested;
    } else {
      result.rowsIngested = limited.length;
      result.records = limited;
    }

    log(`[SEDI] Recent filings: ${limited.length} transactions` +
      (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[SEDI] FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/**
 * Ingest insider transactions for all major TSX issuers.
 * This is the main batch ingestion function.
 */
export async function ingestSedi(
  db: D1Database | null,
  options: {
    /** Only process specific issuers (by name or ticker) */
    issuers?: string[];
    /** Max transactions per issuer */
    limit?: number;
    /** Concurrency limit (default: 2) */
    concurrency?: number;
    /** Date range: start date */
    fromDate?: string;
    /** Date range: end date */
    toDate?: string;
    /** Include recent filings from front page before issuer sweeps */
    includeRecent?: boolean;
    /** Skip initialization of DB table */
    skipInit?: boolean;
    /** Progress callback */
    onProgress?: (msg: string) => void;
  } = {},
): Promise<Record<string, SediIngestionResult>> {
  const log = options.onProgress ?? ((msg: string) => {});
  const results: Record<string, SediIngestionResult> = {};
  const concurrency = options.concurrency ?? 2;

  log('=== SEDI Insider Trading Ingestion ===');
  log(`Target: ${options.issuers ? 'custom issuers' : 'all major TSX issuers'}`);

  // Initialize DB table if needed
  if (db && !options.skipInit) {
    try {
      await initializeSediTable(db);
      log('[SEDI] Table initialized');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`[SEDI] Table init warning: ${msg}`);
      // Non-fatal — table may already exist
    }
  }

  // Optionally fetch recent filings first
  if (options.includeRecent) {
    const recentResult = await ingestSediRecent(db, {
      limit: options.limit,
      onProgress: options.onProgress,
    });
    results['recent-filings'] = recentResult;
    log(`[SEDI] Recent filings: ${recentResult.rowsIngested} ingested`);
  }

  // Determine which issuers to process
  const issuersToProcess = options.issuers
    ? options.issuers
    : MAJOR_TSX_ISSUERS.map(i => i.ticker);

  log(`[SEDI] Processing ${issuersToProcess.length} issuers (concurrency: ${concurrency})`);

  // Process issuers with limited concurrency
  const batches: string[][] = [];
  for (let i = 0; i < issuersToProcess.length; i += concurrency) {
    batches.push(issuersToProcess.slice(i, i + concurrency));
  }

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(async (issuer) => {
        try {
          return await ingestSediByIssuer(db, issuer, {
            fromDate: options.fromDate,
            toDate: options.toDate,
            limit: options.limit,
            onProgress: options.onProgress,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log(`[SEDI] Batch error for "${issuer}": ${msg}`);
          return {
            rowsFound: 0,
            rowsParsed: 0,
            rowsIngested: 0,
            errors: [msg],
            durationMs: 0,
            issuer,
          } as SediIngestionResult;
        }
      }),
    );

    for (const batchResult of batchResults) {
      if (batchResult.issuer) {
        results[batchResult.issuer] = batchResult;
      }
    }
  }

  // Summary
  const totals = summarizeResults(results);
  log(`\\n=== SEDI Summary ===`);
  log(`Issuers: ${issuersToProcess.length}, ` +
    `Transactions: ${totals.totalIngested}/${totals.totalFound}, ` +
    `Errors: ${totals.totalErrors}`);

  // Highlight dispositions (insider selling — the most newsworthy)
  const dispositions = Object.values(results)
    .flatMap(r => (r.records ?? []))
    .filter(tx => tx.transactionType === 'disposition');
  if (dispositions.length > 0) {
    log(`\\n⚠  Insider Selling Detected: ${dispositions.length} disposition(s)`);
    for (const d of dispositions.slice(0, 5)) {
      log(`  SELL: ${d.issuerName} | ${d.insiderName} (${d.insiderRelation}) | ` +
        `${d.numberOfUnits} @ $${d.unitPrice} = $${d.totalValue} | ${d.transactionDate}`);
    }
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  Utilities                                                          */
/* ------------------------------------------------------------------ */

interface SummaryTotals {
  totalFound: number;
  totalIngested: number;
  totalErrors: number;
}

function summarizeResults(
  results: Record<string, SediIngestionResult>,
): SummaryTotals {
  let totalFound = 0;
  let totalIngested = 0;
  let totalErrors = 0;

  for (const result of Object.values(results)) {
    totalFound += result.rowsFound;
    totalIngested += result.rowsIngested;
    totalErrors += result.errors.length;
  }

  return { totalFound, totalIngested, totalErrors };
}

/**
 * Get all tracked executive organizations for SEDI monitoring.
 * These are the C-Suite individuals whose trades are most relevant.
 */
export function getTrackedOrgs(): string[] {
  return [...TRACKED_EXEC_ORGS];
}

/**
 * Get all major TSX issuers for broad market monitoring.
 */
export function getMajorIssuers(): typeof MAJOR_TSX_ISSUERS {
  return [...MAJOR_TSX_ISSUERS];
}
