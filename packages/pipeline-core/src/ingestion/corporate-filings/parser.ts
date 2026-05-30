import { computeHash } from '../../verification/hashing.js';
import type { CorporateFiling, FilingTypeCategory, RawFilingRow } from './types.js';
import { FILING_TYPE_MAP, SEDARPLUS_SEARCH_URL } from './constants.js';

/* ------------------------------------------------------------------ */
/*  Date Normalization                                                 */
/* ------------------------------------------------------------------ */

/**
 * Parse a date string to YYYY-MM-DD format.
 * Handles SEDAR+ date formats: YYYY-MM-DD, YYYY/MM/DD, DD/MM/YYYY,
 * ISO timestamps, and human-readable dates.
 */
export function parseFilingDate(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '1970-01-01';

  // Already in canonical format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // YYYY/MM/DD
  const slashMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slashMatch) {
    return `${slashMatch[1]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[3].padStart(2, '0')}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const euMatch = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (euMatch) {
    return `${euMatch[3]}-${euMatch[2].padStart(2, '0')}-${euMatch[1].padStart(2, '0')}`;
  }

  // ISO 8601 datetime
  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoMatch) return isoMatch[1];

  // Fallback: native Date parse
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  return trimmed.substring(0, 10);
}

/* ------------------------------------------------------------------ */
/*  Filing Type Categorization                                        */
/* ------------------------------------------------------------------ */

/**
 * Normalize a raw filing type string to a canonical FilingTypeCategory.
 * Uses fuzzy matching against FILING_TYPE_MAP patterns.
 */
export function normalizeFilingType(rawType: string): FilingTypeCategory {
  const lower = rawType.toLowerCase().trim();
  for (const [pattern, category] of Object.entries(FILING_TYPE_MAP)) {
    if (lower.includes(pattern)) {
      return category as FilingTypeCategory;
    }
  }
  return 'other';
}

/* ------------------------------------------------------------------ */
/*  Row Normalization                                                 */
/* ------------------------------------------------------------------ */

/**
 * Normalize a raw SEDAR+ row into a structured CorporateFiling.
 * Generates a deterministic SHA-256 content hash as the record ID.
 */
export async function normalizeFilingRow(
  row: RawFilingRow,
  issuerQuery?: string,
): Promise<CorporateFiling | null> {
  if (!row.issuerName || !row.filingType || !row.filingDate || !row.documentUrl) {
    return null;
  }

  const normalizedDate = parseFilingDate(row.filingDate);
  const filingTypeCategory = normalizeFilingType(row.filingType);

  const id = await computeHash(
    `${row.issuerName}:${row.filingType}:${normalizedDate}:${row.documentUrl}`,
    'sha256',
  );

  return {
    id,
    issuerName: row.issuerName.trim(),
    issuerTicker: row.issuerTicker ? row.issuerTicker.trim() : null,
    filingType: row.filingType.trim(),
    filingTypeCategory,
    filingDate: normalizedDate,
    documentUrl: row.documentUrl,
    description: row.description?.trim() || null,
    formType: row.formType?.trim() || null,
    sourceUrl: row.sourceUrl || (issuerQuery
      ? `${SEDARPLUS_SEARCH_URL}${encodeURIComponent(issuerQuery)}`
      : row.documentUrl),
    ingestedAt: new Date().toISOString(),
  };
}

/**
 * Parse multiple raw filing rows into normalized CorporateFiling records.
 * Filters out invalid rows and deduplicates.
 */
export async function parseFilingReport(
  rows: RawFilingRow[],
  issuerQuery?: string,
): Promise<CorporateFiling[]> {
  const records: CorporateFiling[] = [];
  for (const row of rows) {
    const filing = await normalizeFilingRow(row, issuerQuery);
    if (filing) {
      records.push(filing);
    }
  }
  return deduplicateFilings(records);
}

/* ------------------------------------------------------------------ */
/*  Deduplication                                                     */
/* ------------------------------------------------------------------ */

/**
 * Deduplicate filings by issuer name + filing type + filing date.
 * The first occurrence of each unique key is kept.
 */
export function deduplicateFilings(records: CorporateFiling[]): CorporateFiling[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = `${record.issuerName}:${record.filingType}:${record.filingDate}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
