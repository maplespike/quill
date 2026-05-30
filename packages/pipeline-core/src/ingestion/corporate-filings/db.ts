import type { CorporateFiling, CorporateFilingsSearchParams } from './types.js';
import { CORPORATE_FILINGS_DDL } from './constants.js';

export interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results: T[]; success: boolean }>;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<{ success: boolean; meta?: { changes: number } }>;
}

export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  exec(sql: string): Promise<{ success: boolean }>;
  batch<T = unknown>(stmts: D1PreparedStatement[]): Promise<{ results?: T[]; success: boolean }[]>;
}

export async function initializeCorporateFilingsTable(db: D1Database): Promise<void> {
  const statements = CORPORATE_FILINGS_DDL
    .split(';')
    .map((s: string) => s.trim())
    .filter((s: string) => Boolean(s));
  for (const stmt of statements) {
    await db.exec(stmt + ';');
  }
}

export async function upsertFiling(db: D1Database, filing: CorporateFiling): Promise<void> {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO corporate_filings (
      id, issuer_name, issuer_ticker, filing_type, filing_type_category,
      filing_date, document_url, description, form_type, source_url, ingested_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  await stmt.bind(
    filing.id,
    filing.issuerName,
    filing.issuerTicker,
    filing.filingType,
    filing.filingTypeCategory,
    filing.filingDate,
    filing.documentUrl,
    filing.description,
    filing.formType,
    filing.sourceUrl,
    filing.ingestedAt,
  ).run();
}

export async function searchFilings(
  db: D1Database,
  params: CorporateFilingsSearchParams,
): Promise<CorporateFiling[]> {
  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (params.issuer) {
    conditions.push('issuer_name LIKE ?');
    bindings.push(`%${params.issuer}%`);
  }
  if (params.ticker) {
    conditions.push('issuer_ticker = ?');
    bindings.push(params.ticker);
  }
  if (params.filingType) {
    conditions.push('filing_type LIKE ?');
    bindings.push(`%${params.filingType}%`);
  }
  if (params.dateFrom) {
    conditions.push('filing_date >= ?');
    bindings.push(params.dateFrom);
  }
  if (params.dateTo) {
    conditions.push('filing_date <= ?');
    bindings.push(params.dateTo);
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';
  const limitClause = params.limit ? `LIMIT ${params.limit}` : 'LIMIT 100';
  const offsetClause = params.page && params.page > 1
    ? `OFFSET ${(params.page - 1) * (params.limit || 100)}`
    : '';

  const sql = `
    SELECT * FROM corporate_filings
    ${whereClause}
    ORDER BY filing_date DESC
    ${limitClause}
    ${offsetClause}
  `.trim();

  const stmt = db.prepare(sql);
  const bound = bindings.length > 0 ? stmt.bind(...bindings) : stmt;
  const result = await bound.all<CorporateFiling>();
  return result.results;
}

export async function getLatestFilingDate(
  db: D1Database,
  issuerName?: string,
): Promise<string | null> {
  const sql = issuerName
    ? `SELECT filing_date FROM corporate_filings WHERE issuer_name = ? ORDER BY filing_date DESC LIMIT 1`
    : `SELECT MAX(filing_date) AS filing_date FROM corporate_filings`;

  const stmt = db.prepare(sql);
  const bound = issuerName ? stmt.bind(issuerName) : stmt;
  const result = await bound.first<{ filing_date: string }>();
  return result?.filing_date || null;
}

export async function deleteOldFilings(
  db: D1Database,
  olderThanDate: string,
): Promise<number> {
  const stmt = db.prepare('DELETE FROM corporate_filings WHERE filing_date < ?');
  const result = await stmt.bind(olderThanDate).run();
  return result.meta?.changes ?? 0;
}
