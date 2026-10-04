/**
 * SEDI Insider Trading Scraper — Quill
 *
 * Fetches insider transaction reports from the Canadian SEDI (System for
 * Electronic Disclosure by Insiders) website at https://www.sedi.ca/.
 *
 * SEDI is the Canadian equivalent of the US SEC's EDGAR for insider
 * trading reports. All public company insiders (directors, officers,
 * 10% holders) must file within 10 days of any trade.
 *
 * Pipeline:
 *   1. Search SEDI for recent insider transactions
 *   2. Parse HTML results tables
 *   3. Normalize to InsiderTransaction schema
 *   4. Persist to database (or return structured data)
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import { CORPORATE_SOURCES } from './constants.js';
import type { HttpResponse } from '../../utils/http.js';
import type { InsiderTransaction, CorporateIngestionResult } from './types.js';
import type { D1Database } from '../committees/db.js';


export class SEDIFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'SEDIFetchError';
  }
}


const DEFAULT_HEADERS = {
  'User-Agent': 'Quill/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
} as const;


/**
 * Fetch raw HTML from a URL.
 */
async function fetchHtml(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const resp: HttpResponse = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS as Record<string, string> },
    timeoutMs: options.timeoutMs ?? 30_000,
  });

  if (resp.statusCode >= 400) {
    throw new SEDIFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.body;
}


/**
 * Search SEDI for insider transactions by issuer name or ticker.
 *
 * SEDI sits behind a Shieldsquare/perfdrive bot-validation wall: a non-browser
 * client is redirected to a JS challenge page that carries no transaction
 * table, and the public search path itself now answers 302/404. There is no
 * open API. The wall is raised as an error instead of returning `[]`, so the
 * pipeline does not read as "no insider trades today" when the source is
 * simply unreachable.
 */
export async function searchSEDI(
  query: string,
): Promise<Partial<InsiderTransaction>[]> {
  const searchUrl = `${CORPORATE_SOURCES.SEDI.SEARCH}?query=${encodeURIComponent(query)}`;
  const html = await fetchHtml(searchUrl);

  if (/perfdrive|shieldsquare/i.test(html)) {
    throw new SEDIFetchError(
      'SEDI is behind a bot-validation wall (perfdrive/Shieldsquare) — ' +
        'no machine-readable insider transaction data is reachable',
      undefined,
      searchUrl,
    );
  }

  return parseSEDITable(html, searchUrl);
}


/**
 * Parse SEDI HTML table results into partial InsiderTransaction records.
 *
 * SEDI tables typically have columns:
 *   - Issuer Name
 *   - Insider Name
 *   - Relationship
 *   - Transaction Type (Acquisition/Disposition/Grant/Exercise)
 *   - Security Type
 *   - Number of Units
 *   - Unit Price
 *   - Total Value
 *   - Transaction Date
 *   - Filing Date
 *   - Ownership After
 */
function parseSEDITable(
  html: string,
  sourceUrl: string,
): Partial<InsiderTransaction>[] {
  const results: Partial<InsiderTransaction>[] = [];

  // Try to find table with class or ID containing transaction data
  const tablePattern = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tablePattern.exec(html)) !== null) {
    const tableHtml = tableMatch[1];

    // Look for header row indicating it's an insider transactions table
    const hasHeader = /insider|transaction|issuer|relationship|acquisition|disposition/i.test(tableHtml);
    if (!hasHeader) continue;

    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;
    let isHeaderRow = true;

    while ((rowMatch = rowPattern.exec(tableHtml)) !== null) {
      const cells = rowMatch[1].match(/<td[^>]*>([\s\S]*?)<\/td>/gi);

      if (!cells || cells.length < 5) {
        // Could be header row with th elements
        isHeaderRow = true;
        continue;
      }

      if (isHeaderRow) {
        isHeaderRow = false;
        continue;
      }

      const extractCell = (idx: number): string => {
        const cell = cells[idx];
        if (!cell) return '';
        return cell.replace(/<[^>]+>/g, '').trim();
      };

      const issuerName = extractCell(0);
      const insiderName = extractCell(1);
      const relationship = extractCell(2);
      const transactionTypeRaw = extractCell(3).toLowerCase();
      const securityType = extractCell(4);
      const numberOfUnitsStr = extractCell(5).replace(/[,$]/g, '');
      const unitPriceStr = extractCell(6).replace(/[,$]/g, '');
      const totalValueStr = extractCell(7).replace(/[,$]/g, '');
      const transactionDate = extractCell(8);
      const filingDate = extractCell(9);
      const ownershipAfterStr = extractCell(10).replace(/[,$]/g, '');

      if (!issuerName && !insiderName) continue;

      let transactionType: InsiderTransaction['transactionType'] = 'other';
      if (/acquisition|purchase|buy|acqui/i.test(transactionTypeRaw)) {
        transactionType = 'acquisition';
      } else if (/disposition|sell|sale|dispos/i.test(transactionTypeRaw)) {
        transactionType = 'disposition';
      } else if (/grant|award|option/i.test(transactionTypeRaw)) {
        transactionType = 'grant';
      } else if (/exercise|exerc/i.test(transactionTypeRaw)) {
        transactionType = 'exercise';
      }

      const numberOfUnits = parseFloat(numberOfUnitsStr) || 0;
      const unitPrice = parseFloat(unitPriceStr) || 0;
      const totalValue = parseFloat(totalValueStr) || 0;
      const ownershipAfter = ownershipAfterStr ? parseFloat(ownershipAfterStr) : null;

      results.push({
        issuerName,
        insiderName,
        insiderRelation: relationship || null,
        transactionType,
        securityType,
        numberOfUnits,
        unitPrice,
        totalValue,
        currency: 'CAD',
        transactionDate: transactionDate || new Date().toISOString().split('T')[0],
        filingDate: filingDate || transactionDate || new Date().toISOString().split('T')[0],
        ownershipAfter: ownershipAfter && !isNaN(ownershipAfter) ? ownershipAfter : null,
        sourceUrl,
      });
    }
  }

  return results;
}


/**
 * Normalize a partial SEDI record into a full InsiderTransaction.
 */
async function normalizeSEDIRecord(
  partial: Partial<InsiderTransaction>,
  sourceUrl: string,
): Promise<InsiderTransaction | null> {
  if (!partial.insiderName && !partial.issuerName) return null;

  const contentForHash = JSON.stringify({
    issuerName: partial.issuerName || '',
    insiderName: partial.insiderName || '',
    transactionDate: partial.transactionDate,
    transactionType: partial.transactionType || 'other',
    numberOfUnits: partial.numberOfUnits || 0,
    unitPrice: partial.unitPrice || 0,
    sourceUrl,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    insiderName: partial.insiderName || 'Unknown Insider',
    insiderRelation: partial.insiderRelation ?? null,
    issuerName: partial.issuerName || 'Unknown Issuer',
    issuerTicker: null,
    transactionDate: partial.transactionDate || new Date().toISOString().split('T')[0],
    filingDate: partial.filingDate || partial.transactionDate || new Date().toISOString().split('T')[0],
    transactionType: partial.transactionType || 'other',
    securityType: partial.securityType || 'Common Shares',
    numberOfUnits: partial.numberOfUnits || 0,
    unitPrice: partial.unitPrice || 0,
    totalValue: partial.totalValue || 0,
    currency: partial.currency || 'CAD',
    ownershipAfter: partial.ownershipAfter ?? null,
    sourceUrl,
    ingestedAt: new Date().toISOString(),
  };
}


/**
 * Ingest SEDI insider transaction data into the database.
 */
export async function ingestInsiderTransactions(
  db: D1Database | null,
  options: {
    query?: string;
    limit?: number;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<CorporateIngestionResult> {
  const startTime = Date.now();
  const result: CorporateIngestionResult = {
    source: 'sedi-insider-transactions',
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  const log = options.onProgress ?? (() => {});

  try {
    log('[SEDI] Fetching insider transactions...');

    // Fetch the SEDI homepage/search for recent transactions
    const searchQuery = options.query ?? 'recent';
    const searchResults = await searchSEDI(searchQuery);
    result.recordsFound = searchResults.length;
    log(`[SEDI] Found ${searchResults.length} raw transaction records`);

    if (searchResults.length === 0) {
      log('[SEDI] No transactions found.');
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Normalize records
    const transactions: InsiderTransaction[] = [];
    for (const partial of searchResults) {
      const normalized = await normalizeSEDIRecord(partial, CORPORATE_SOURCES.SEDI.BASE);
      if (normalized) {
        transactions.push(normalized);
      }
    }

    log(`[SEDI] Normalized ${transactions.length} insider transactions`);

    // Apply limit
    const limited = options.limit ? transactions.slice(0, options.limit) : transactions;
    result.recordsFound = limited.length;

    // Persist or return
    if (db) {
      let ingested = 0;
      for (const tx of limited) {
        try {
          await db.prepare(`
            INSERT OR REPLACE INTO insider_transactions
              (id, insider_name, insider_relation, issuer_name, issuer_ticker,
               transaction_date, filing_date, transaction_type, security_type,
               number_of_units, unit_price, total_value, currency,
               ownership_after, source_url, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            tx.id, tx.insiderName, tx.insiderRelation, tx.issuerName, tx.issuerTicker,
            tx.transactionDate, tx.filingDate, tx.transactionType, tx.securityType,
            tx.numberOfUnits, tx.unitPrice, tx.totalValue, tx.currency,
            tx.ownershipAfter, tx.sourceUrl, tx.ingestedAt,
          ).run();
          ingested++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Insert ${tx.id}: ${msg}`);
        }
      }
      result.recordsIngested = ingested;
      log(`[SEDI] Persisted ${ingested} insider transactions`);
    } else {
      result.recordsIngested = limited.length;
      result.records = limited;
      log(`[SEDI] Dry-run — ${limited.length} transactions available`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    log(`[SEDI] ERROR: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}
