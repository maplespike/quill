/**
 * SEDI Insider Trading — Quill
 *
 * Automated access is retired. SEDI terms of use prohibit robots, spiders,
 * and any other automatic device or process that monitors or copies pages.
 * Ingest functions return without fetching. Search reads stored rows only.
 * Stored rows are not deleted.
 */

import {
  SEDI_AUTOMATED_ACCESS_RETIRED,
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
/*  Ingest — retired, no network                                       */
/* ------------------------------------------------------------------ */

function retiredIngest(issuer?: string): SediIngestionResult {
  return {
    rowsFound: 0,
    rowsParsed: 0,
    rowsIngested: 0,
    errors: [SEDI_AUTOMATED_ACCESS_RETIRED],
    durationMs: 0,
    ...(issuer ? { issuer } : {}),
  };
}

/**
 * Refuse issuer ingest. Does not fetch and does not write.
 */
export async function ingestSediByIssuer(
  _db: D1Database | null,
  issuer: string,
  options: {
    fromDate?: string;
    toDate?: string;
    limit?: number;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<SediIngestionResult> {
  options.onProgress?.(SEDI_AUTOMATED_ACCESS_RETIRED);
  return retiredIngest(issuer);
}

/**
 * Refuse the recent-filings sweep. Does not fetch and does not write.
 */
export async function ingestSediRecent(
  _db: D1Database | null,
  options: {
    limit?: number;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<SediIngestionResult> {
  options.onProgress?.(SEDI_AUTOMATED_ACCESS_RETIRED);
  return retiredIngest();
}

/**
 * Refuse the batch ingest. Does not fetch and does not write.
 * Stored rows are left in place.
 */
export async function ingestSedi(
  _db: D1Database | null,
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
): Promise<Record<string, SediIngestionResult>> {
  options.onProgress?.(SEDI_AUTOMATED_ACCESS_RETIRED);
  return { retired: retiredIngest() };
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
