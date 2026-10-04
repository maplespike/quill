/**
 * SEDI Fetcher — Quill
 *
 * HTTP fetcher for the Canadian System for Electronic Disclosure by Insiders (SEDI).
 *
 * SEDI has NO public API — all data is accessed via HTML form-based search.
 * This module simulates a browser form POST to search for insider transactions
 * and fetches result pages.
 *
 * Strategy:
 *   1. POST search form with issuer/ticker query parameters
 *   2. Parse the HTML results table (handled by parser.ts)
 *   3. Fallback: fetch from SEDAR+ if SEDI is unavailable
 *
 * SEDI may block automated requests. The connector gracefully handles
 * empty results with logging, not crashes.
 *
 * Sources:
 *   SEDI search: https://www.sedi.ca/sedi/SVTOCPublish?language=en
 *   SEDAR+:      https://www.sedarplus.ca
 */

import { httpGet } from '../../utils/http.js';
import {
  SEDI_BASE_URL,
  SEDI_SEARCH_URL,
  SEDARPLUS_BASE_URL,
  SEDI_DEFAULT_HEADERS,
} from './constants.js';
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

/* ------------------------------------------------------------------ */
/*  HTTP Helpers                                                       */
/* ------------------------------------------------------------------ */

const DEFAULT_HEADERS: Record<string, string> = {
  ...SEDI_DEFAULT_HEADERS,
} as Record<string, string>;

/**
 * Fetch raw HTML from a URL via GET.
 */
async function fetchHtml(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const resp = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS },
    timeoutMs: options.timeoutMs ?? 30_000,
  });

  if (resp.statusCode >= 400) {
    throw new SediFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
      'sedi',
    );
  }

  return resp.body;
}

/**
 * POST form data to SEDI and return the HTML response.
 * Simulates a browser form submission to the SEDI search endpoint.
 */
async function postSediSearch(
  params: SediSearchParams,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  // Build form-urlencoded body
  const formParts: string[] = [];

  if (params.issuer) {
    formParts.push(`issuer=${encodeURIComponent(params.issuer)}`);
  }
  if (params.insider) {
    formParts.push(`insiderName=${encodeURIComponent(params.insider)}`);
  }
  if (params.fromDate) {
    formParts.push(`fromDate=${encodeURIComponent(params.fromDate)}`);
  }
  if (params.toDate) {
    formParts.push(`toDate=${encodeURIComponent(params.toDate)}`);
  }

  // Add language and search action parameters
  formParts.push('language=en');
  formParts.push('search=true');

  const formBody = formParts.join('&');

  // Use the shared httpGet — SEDI search URL accepts GET params as well
  const searchUrl = `${SEDI_SEARCH_URL}&${formBody}`;

  const resp = await httpGet(searchUrl, {
    headers: { ...DEFAULT_HEADERS },
    timeoutMs: options.timeoutMs ?? 30_000,
  });

  if (resp.statusCode >= 400) {
    throw new SediFetchError(
      `HTTP ${resp.statusCode} searching SEDI`,
      resp.statusCode,
      searchUrl,
      'sedi',
    );
  }

  return resp.body;
}

/* ------------------------------------------------------------------ */
/*  SEDI Fetcher Functions                                             */
/* ------------------------------------------------------------------ */

/**
 * Search SEDI for insider transactions by issuer name or ticker.
 * Returns the raw HTML of the SEDI search results page.
 *
 * @param issuer - Issuer name or ticker symbol (e.g. "RBC", "Royal Bank")
 * @param params - Additional search parameters
 * @returns Raw HTML string from SEDI
 */
export async function fetchSediByIssuer(
  issuer: string,
  params: Omit<SediSearchParams, 'issuer'> = {},
): Promise<string> {
  return postSediSearch({ issuer, ...params });
}

/**
 * Search SEDI for insider transactions by insider name.
 *
 * @param insiderName - Insider name (e.g. "Victor Dodig", "Dave McKay")
 * @param params - Additional search parameters
 * @returns Raw HTML string from SEDI
 */
export async function fetchSediByInsider(
  insiderName: string,
  params: Omit<SediSearchParams, 'insider'> = {},
): Promise<string> {
  return postSediSearch({ insider: insiderName, ...params });
}

/**
 * Fetch the SEDI homepage/search page (useful for seeing recent filings).
 *
 * @returns Raw HTML of the SEDI search/disclosure page
 */
export async function fetchSediFrontPage(): Promise<string> {
  return fetchHtml(SEDI_SEARCH_URL);
}

/**
 * Fetch a specific SEDI transaction report detail page.
 *
 * @param reportId - The SEDI report identifier
 * @returns Raw HTML of the report detail page
 */
export async function fetchSediReportDetail(reportId: string): Promise<string> {
  const url = `https://www.sedi.ca/sedi/SVTOCDetail?id=${encodeURIComponent(reportId)}&language=en`;
  return fetchHtml(url);
}

/**
 * Try fetching insider data from SEDAR+ as fallback data source.
 * SEDAR+ may have a different interface or structure.
 *
 * @param query - Search query (issuer name or ticker)
 * @returns Raw HTML or empty string if unavailable
 */
export async function fetchSedarpPlus(
  query: string,
): Promise<string> {
  try {
    const searchUrl = `${SEDARPLUS_BASE_URL}/landing?s=${encodeURIComponent(query)}`;
    const resp = await httpGet(searchUrl, {
      headers: { ...DEFAULT_HEADERS },
      timeoutMs: 15_000,
    });

    if (resp.statusCode >= 400) {
      console.warn(`[SEDI] SEDAR+ returned HTTP ${resp.statusCode} for "${query}"`);
      return '';
    }

    return resp.body;
  } catch (err) {
    console.warn(`[SEDI] SEDAR+ unavailable for "${query}": ${(err as Error).message}`);
    return '';
  }
}

/**
 * Fetch insider transactions from the best available source.
 * Primary: SEDI. Fallback: SEDAR+.
 *
 * Returns an object with the source used and the raw HTML body.
 * Gracefully handles failures — returns empty HTML rather than crashing.
 */
export async function fetchInsiderTransactions(
  issuer: string,
  options: {
    timeoutMs?: number;
    fromDate?: string;
    toDate?: string;
  } = {},
): Promise<{ source: InsiderDataSource; html: string; sourceUrl: string }> {
  const result: { source: InsiderDataSource; html: string; sourceUrl: string } = {
    source: 'sedi',
    html: '',
    sourceUrl: SEDI_SEARCH_URL,
  };

  // Attempt SEDI first
  try {
    const params: SediSearchParams = { issuer };
    if (options.fromDate) params.fromDate = options.fromDate;
    if (options.toDate) params.toDate = options.toDate;

    const html = await fetchSediByIssuer(issuer, params);
    result.html = html;
    result.sourceUrl = `${SEDI_SEARCH_URL}&issuer=${encodeURIComponent(issuer)}`;
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[SEDI] SEDI fetch failed for "${issuer}": ${msg}. Trying SEDAR+...`);
  }

  // Fallback to SEDAR+
  try {
    const html = await fetchSedarpPlus(issuer);
    if (html) {
      result.source = 'sedarplus';
      result.html = html;
      result.sourceUrl = `${SEDARPLUS_BASE_URL}/landing?s=${encodeURIComponent(issuer)}`;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[SEDI] SEDAR+ also failed for "${issuer}": ${msg}`);
  }

  // If both failed, return empty html gracefully
  if (!result.html) {
    console.warn(`[SEDI] No data available for issuer "${issuer}" from any source`);
  }

  return result;
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
