/**
 * SEDI Parser — Quill
 *
 * Parses raw SEDI HTML report data into structured InsiderTransaction records.
 *
 * The SEDI website displays insider trading reports in HTML tables with
 * columns for issuer, insider, relationship, transaction type, security type,
 * volume, price, total value, dates, and post-transaction holdings.
 *
 * This module handles the normalization of:
 *   - Raw HTML table rows -> RawSediRow
 *   - RawSediRow -> InsiderTransaction (with SHA-256 hashing)
 *   - Transaction type classification
 *   - Date parsing and normalization
 *   - Numeric value extraction
 */

import { computeHash } from '../../verification/hashing.js';
import { extractSediTableRows } from './fetcher.js';
import type { InsiderTransaction } from '../corporate/types.js';
import type { RawSediRow } from './types.js';

/* ------------------------------------------------------------------ */
/*  Date Parsing                                                       */
/* ------------------------------------------------------------------ */

/**
 * Parse a SEDI date string into ISO-8601 (YYYY-MM-DD) format.
 * SEDI typically uses formats like:
 *   - "January 15, 2025"
 *   - "2025-01-15"
 *   - "15/01/2025"
 *   - "01/15/2025"
 *   - "Jan 15, 2025"
 */
export function parseSediDate(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr.trim().length === 0) {
    return new Date().toISOString().split('T')[0];
  }

  const cleaned = dateStr.trim();

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }

  // Try parsing as ISO date
  const isoDate = new Date(cleaned);
  if (!isNaN(isoDate.getTime())) {
    return isoDate.toISOString().split('T')[0];
  }

  // Try MM/DD/YYYY or DD/MM/YYYY
  const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, m, d, y] = slashMatch;
    // Assume MM/DD/YYYY (North American convention) if month <= 12
    const month = parseInt(m, 10);
    const day = parseInt(d, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Try DD-MM-YYYY or MM-DD-YYYY
  const dashMatch = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const [, a, b, y] = dashMatch;
    const num1 = parseInt(a, 10);
    const num2 = parseInt(b, 10);
    if (num1 >= 1 && num1 <= 12 && num2 >= 1 && num2 <= 31) {
      return `${y}-${String(num1).padStart(2, '0')}-${String(num2).padStart(2, '0')}`;
    }
  }

  // Try parsing long month name formats
  const longMonthPattern = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i;
  const longMatch = cleaned.match(longMonthPattern);
  if (longMatch) {
    const monthNames: Record<string, string> = {
      january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
      july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
    };
    const month = monthNames[longMatch[1].toLowerCase()] || '01';
    const day = String(parseInt(longMatch[2], 10)).padStart(2, '0');
    return `${longMatch[3]}-${month}-${day}`;
  }

  // Try short month names
  const shortMonthPattern = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})/i;
  const shortMatch = cleaned.match(shortMonthPattern);
  if (shortMatch) {
    const monthAbbrev: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const month = monthAbbrev[shortMatch[1].toLowerCase()] || '01';
    const day = String(parseInt(shortMatch[2], 10)).padStart(2, '0');
    return `${shortMatch[3]}-${month}-${day}`;
  }

  // Fallback: return today's date
  console.warn(`[SEDI] Could not parse date: "${dateStr}", using today`);
  return new Date().toISOString().split('T')[0];
}

/* ------------------------------------------------------------------ */
/*  Numeric Parsing                                                    */
/* ------------------------------------------------------------------ */

/**
 * Parse a SEDI numeric string into a number.
 * Handles formats like "1,234.56", "$1,234.56", "(1,234)" for negatives.
 */
export function parseSediNumber(numStr: string | null | undefined): number {
  if (!numStr || numStr.trim().length === 0) return 0;

  let cleaned = numStr.trim();

  // Handle negative numbers in parentheses: "(1,234)" -> -1234
  const parenNeg = cleaned.match(/^\(([\d,.]+)\)$/);
  if (parenNeg) {
    cleaned = '-' + parenNeg[1];
  }

  // Remove currency symbols and whitespace
  cleaned = cleaned.replace(/[$€£¥\s]/g, '');

  // Remove thousands separators (commas)
  cleaned = cleaned.replace(/,/g, '');

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/* ------------------------------------------------------------------ */
/*  Transaction Type Classification                                    */
/* ------------------------------------------------------------------ */

/**
 * Normalize a transaction type string from SEDI into the canonical type.
 */
export function classifyTransactionType(
  rawType: string,
): InsiderTransaction['transactionType'] {
  const lower = rawType.trim().toLowerCase();

  // Acquisition / Purchase / Buy
  if (
    /^(acquisition|acquis|purchase|buy|bought|open market purchase|purchased|acq)$/i.test(lower) ||
    /acquisition/i.test(lower) ||
    /^10b5-1/.test(lower)
  ) {
    return 'acquisition';
  }

  // Disposition / Sell / Sale
  if (
    /^(disposition|dispos|sell|sale|sold|open market sell|disposed|disposal)$/i.test(lower) ||
    /disposition/i.test(lower)
  ) {
    return 'disposition';
  }

  // Grant / Award
  if (
    /^(grant|award|option grant|restricted share unit|rsu|performance share unit|psu|deferred share unit|dsu)$/i.test(lower) ||
    /grant/i.test(lower) ||
    /award/i.test(lower)
  ) {
    return 'grant';
  }

  // Exercise
  if (
    /^(exercise|exercised|option exercise|exercice)$/i.test(lower) ||
    /exercis/i.test(lower)
  ) {
    return 'exercise';
  }

  return 'other';
}

/* ------------------------------------------------------------------ */
/*  Raw Row -> InsiderTransaction Conversion                           */
/* ------------------------------------------------------------------ */

/**
 * Determine the issuer ticker from a RawSediRow.
 * SEDI may include the ticker in a separate column, or we infer it
 * from the issuer name if not present.
 */
function resolveIssuerTicker(row: RawSediRow): string | null {
  if (row.issuerTicker) return row.issuerTicker;

  // Try to extract ticker from issuer name in parentheses, e.g. "Royal Bank of Canada (RY)"
  const tickerMatch = row.issuerName.match(/\(([A-Za-z0-9.]+)\)$/);
  if (tickerMatch) return tickerMatch[1].toUpperCase();

  return null;
}

/**
 * Normalize a single RawSediRow into a full InsiderTransaction.
 * Computes SHA-256 hash for the record ID for deduplication.
 */
export async function normalizeSediRow(
  row: RawSediRow,
  sourceUrl: string,
): Promise<InsiderTransaction | null> {
  const issuerName = row.issuerName.trim() || 'Unknown Issuer';
  const insiderName = row.insiderName.trim() || 'Unknown Insider';
  const transactionType = classifyTransactionType(row.transactionTypeRaw);
  const transactionDate = parseSediDate(row.transactionDate);
  const filingDate = row.filingDate ? parseSediDate(row.filingDate) : transactionDate;
  const numberOfUnits = parseSediNumber(row.volumeRaw);
  const unitPrice = parseSediNumber(row.priceRaw);
  const totalValue = parseSediNumber(row.totalValueRaw);
  const ownershipAfter = row.ownershipAfterRaw ? parseSediNumber(row.ownershipAfterRaw) : null;
  const issuerTicker = resolveIssuerTicker(row);

  // Compute SHA-256 hash as unique ID
  const contentForHash = JSON.stringify({
    issuerName,
    insiderName,
    transactionDate,
    transactionType,
    numberOfUnits,
    unitPrice,
    securityType: row.securityType,
    sourceUrl,
  });

  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    insiderName,
    insiderRelation: row.relationship || null,
    issuerName,
    issuerTicker,
    transactionDate,
    filingDate,
    transactionType,
    securityType: row.securityType || 'Common Shares',
    numberOfUnits,
    unitPrice,
    totalValue,
    currency: 'CAD',
    ownershipAfter: ownershipAfter !== null && !isNaN(ownershipAfter) ? ownershipAfter : null,
    sourceUrl,
    ingestedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/*  SEDI Report Parser (orchestrator)                                  */
/* ------------------------------------------------------------------ */

/**
 * Parse raw SEDI HTML into an array of InsiderTransaction records.
 * Skips invalid/malformed rows gracefully.
 *
 * @param html - Raw HTML from SEDI search results
 * @param sourceUrl - The URL the HTML was fetched from (for provenance)
 * @returns Array of normalized InsiderTransaction records
 */
export async function parseSediReport(
  html: string,
  sourceUrl: string,
): Promise<InsiderTransaction[]> {
  if (!html || html.trim().length === 0) {
    console.warn('[SEDI] Empty HTML received, nothing to parse');
    return [];
  }

  // Step 1: Extract raw rows from SEDI HTML tables
  const rawRows = extractSediTableRows(html);

  if (rawRows.length === 0) {
    console.warn('[SEDI] No table rows found in HTML — SEDI may have returned an empty/no-results page');
    return [];
  }

  // Step 2: Normalize each row into an InsiderTransaction
  const transactions: InsiderTransaction[] = [];
  let errors = 0;

  for (const row of rawRows) {
    try {
      const tx = await normalizeSediRow(row, sourceUrl);
      if (tx) {
        transactions.push(tx);
      }
    } catch (err) {
      errors++;
    }
  }

  if (errors > 0) {
  }

  return transactions;
}

/**
 * Parse a SEDI report detail page (single transaction report) into
 * an InsiderTransaction record.
 */
export async function parseSediReportDetail(
  html: string,
  sourceUrl: string,
): Promise<InsiderTransaction | null> {
  const rows = extractSediTableRows(html);

  if (rows.length === 0) {
    console.warn('[SEDI] No transaction data found in detail page');
    return null;
  }

  // Detail pages typically have a single transaction row
  return normalizeSediRow(rows[0], sourceUrl);
}

/**
 * Deduplicate an array of InsiderTransaction records by ID.
 * Keeps the first occurrence.
 */
export function deduplicateTransactions(
  transactions: InsiderTransaction[],
): InsiderTransaction[] {
  const seen = new Set<string>();
  return transactions.filter(tx => {
    if (seen.has(tx.id)) return false;
    seen.add(tx.id);
    return true;
  });
}
