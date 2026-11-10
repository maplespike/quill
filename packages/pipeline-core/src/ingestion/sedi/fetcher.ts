/**
 * SEDI Fetcher — Quill
 *
 * Automated access is retired. SEDI terms of use prohibit robots, spiders,
 * and any other automatic device or process. Fetch functions refuse before
 * any request. Offline HTML parsing remains for stored or fixture text.
 */

import { SEDI_AUTOMATED_ACCESS_RETIRED } from './constants.js';
import type { SediSearchParams, InsiderDataSource, RawSediRow } from './types.js';

/* ------------------------------------------------------------------ */
/*  Error Types                                                        */
/* ------------------------------------------------------------------ */

export class SediFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
    public readonly source?: InsiderDataSource,
  ) {
    super(message);
    this.name = 'SediFetchError';
  }
}

function retiredAccess(): never {
  throw new SediFetchError(SEDI_AUTOMATED_ACCESS_RETIRED);
}

/* ------------------------------------------------------------------ */
/*  SEDI Fetcher Functions — refuse before any request                 */
/* ------------------------------------------------------------------ */

export async function fetchSediByIssuer(
  _issuer: string,
  _params: Omit<SediSearchParams, 'issuer'> = {},
): Promise<string> {
  retiredAccess();
}

export async function fetchSediByInsider(
  _insiderName: string,
  _params: Omit<SediSearchParams, 'insider'> = {},
): Promise<string> {
  retiredAccess();
}

export async function fetchSediFrontPage(): Promise<string> {
  retiredAccess();
}

export async function fetchSediReportDetail(_reportId: string): Promise<string> {
  retiredAccess();
}

export async function fetchSedarpPlus(_query: string): Promise<string> {
  retiredAccess();
}

export async function fetchInsiderTransactions(
  _issuer: string,
  _options: {
    timeoutMs?: number;
    fromDate?: string;
    toDate?: string;
  } = {},
): Promise<{ source: InsiderDataSource; html: string; sourceUrl: string }> {
  retiredAccess();
}

/* ------------------------------------------------------------------ */
/*  SEDI Raw Row Parsing (low-level HTML extraction)                   */
/* ------------------------------------------------------------------ */

/**
 * Extract raw table rows from SEDI HTML.
 * This is a low-level extraction that returns RawSediRow objects;
 * the parser.ts module handles full normalization.
 *
 * SEDI HTML tables typically have columns:
 *   0 - Issuer Name
 *   1 - Issuer Ticker
 *   2 - Insider Name
 *   3 - Relationship
 *   4 - Transaction Type
 *   5 - Security Type
 *   6 - Volume / Number of Units
 *   7 - Unit Price
 *   8 - Total Value
 *   9 - Transaction Date
 *   10 - Filing Date
 *   11 - Closing Date
 *   12 - Ownership After
 *   13 - Nature of Ownership
 */
export function extractSediTableRows(html: string): RawSediRow[] {
  if (!html || html.trim().length === 0) {
    return [];
  }

  const rows: RawSediRow[] = [];

  // Try multiple table patterns SEDI may use
  const tablePatterns = [
    // Standard HTML <table> with transactions
    /<table[^>]*class="[^"]*results[^"]*"[^>]*>([\s\S]*?)<\/table>/gi,
    /<table[^>]*class="[^"]*transaction[^"]*"[^>]*>([\s\S]*?)<\/table>/gi,
    /<table[^>]*id="[^"]*results[^"]*"[^>]*>([\s\S]*?)<\/table>/gi,
    /<table[^>]*id="[^"]*transaction[^"]*"[^>]*>([\s\S]*?)<\/table>/gi,
    // Generic table with insider/transaction keywords nearby
    /<table[^>]*>([\s\S]*?(?:insider|transaction|issuer)[\s\S]*?)<\/table>/gi,
  ];

  for (const pattern of tablePatterns) {
    let tableMatch: RegExpExecArray | null;
    while ((tableMatch = pattern.exec(html)) !== null) {
      const tableHtml = tableMatch[1];

      // Extract rows from this table
      const extracted = extractRowsFromTable(tableHtml);
      rows.push(...extracted);

      if (extracted.length > 0) {
        // Found rows, return them (stop searching other patterns)
        return rows;
      }
    }
  }

  // Last resort: look for any <tr> containing insider-related data
  // in the entire HTML body
  const allRows = extractRowsFromTable(html);
  if (allRows.length > 0) {
    return allRows;
  }

  return rows;
}

/**
 * Extract rows from a single table HTML fragment.
 */
function extractRowsFromTable(tableHtml: string): RawSediRow[] {
  const rows: RawSediRow[] = [];
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  let isFirstRow = true;

  while ((rowMatch = rowPattern.exec(tableHtml)) !== null) {
    const rowHtml = rowMatch[1];

    // Extract cells (td or th)
    const cells = rowHtml.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);

    if (!cells || cells.length < 5) {
      // Not enough cells to be a data row
      if (isFirstRow) {
        isFirstRow = false;
      }
      continue;
    }

    if (isFirstRow) {
      // Check if first row is a header
      const firstCellText = stripHtmlTags(cells[0]).trim().toLowerCase();
      if (
        !firstCellText ||
        firstCellText.includes('issuer') ||
        firstCellText.includes('name') ||
        firstCellText.includes('insider') ||
        firstCellText.includes('transaction') ||
        firstCellText.includes('date') ||
        firstCellText.length > 50
      ) {
        isFirstRow = false;
        continue;
      }
      isFirstRow = false;
    }

    const extract = (idx: number): string => {
      if (idx >= cells.length) return '';
      return stripHtmlTags(cells[idx]);
    };

    const issuerName = extract(0);
    const issuerTicker = extract(1);
    const insiderName = extract(2);
    const relationship = extract(3);
    const transactionTypeRaw = extract(4);
    const securityType = extract(5);
    const volumeRaw = extract(6).replace(/[,$%\s]/g, '');
    const priceRaw = extract(7).replace(/[,$%\s]/g, '');
    const totalValueRaw = extract(8).replace(/[,$%\s]/g, '');
    const transactionDate = extract(9);
    const filingDate = extract(10);
    const closingDate = cells.length > 11 ? extract(11) : '';
    const ownershipAfterRaw = cells.length > 12
      ? extract(12).replace(/[,$%\s]/g, '')
      : cells.length > 11
        ? extract(11).replace(/[,$%\s]/g, '')
        : '';
    const natureOfOwnership = cells.length > 13 ? extract(13) : null;

    // Skip rows where key fields are empty
    if (!issuerName && !insiderName) continue;

    rows.push({
      issuerName,
      issuerTicker: issuerTicker || null,
      insiderName,
      relationship,
      transactionTypeRaw,
      securityType,
      volumeRaw,
      priceRaw,
      totalValueRaw,
      transactionDate,
      filingDate: filingDate || null,
      closingDate: closingDate || null,
      ownershipAfterRaw,
      natureOfOwnership,
    });
  }

  return rows;
}

/**
 * Strip HTML tags from a string.
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
