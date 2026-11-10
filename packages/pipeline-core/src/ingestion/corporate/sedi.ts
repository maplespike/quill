/**
 * SEDI insider-transaction helpers — Quill
 *
 * Automated access is retired. SEDI terms of use prohibit robots, spiders,
 * and any other automatic device or process that monitors or copies pages.
 * These functions do not fetch. Stored rows stay in the database.
 *
 * HTML parsers remain so existing fixtures can still be read offline.
 */

import { computeHash } from '../../verification/hashing.js';
import type { InsiderTransaction, CorporateIngestionResult } from './types.js';
import type { D1Database } from '../committees/db.js';

const SEDI_AUTOMATED_ACCESS_RETIRED =
  'SEDI automated access is retired. SEDI terms of use prohibit robots, spiders, and other automatic devices.';


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


/**
 * Why a SEDI response cannot be parsed as insider filings.
 *
 * The public search path (`SVTOCPublish`) answers 404. The homepage answers
 * 200 with a Radware Bot Manager interstitial and no transaction table.
 * Either case is a dead source, not an empty search.
 */
export function sediUnreachableReason(input: {
  statusCode?: number;
  html?: string;
}): string | null {
  const html = input.html ?? '';
  const walled = /perfdrive|shieldsquare|radware/i.test(html);
  const gone = input.statusCode === 404 || input.statusCode === 410;
  if (!walled && !gone) return null;
  return (
    'SEDI public search path is gone and the site is behind a Radware bot wall — ' +
    'no machine-readable insider feed is reachable'
  );
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
  _query: string,
): Promise<Partial<InsiderTransaction>[]> {
  throw new SEDIFetchError(SEDI_AUTOMATED_ACCESS_RETIRED);
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
  log(SEDI_AUTOMATED_ACCESS_RETIRED);
  result.skipReason = SEDI_AUTOMATED_ACCESS_RETIRED;
  result.durationMs = Date.now() - startTime;
  return result;
}
