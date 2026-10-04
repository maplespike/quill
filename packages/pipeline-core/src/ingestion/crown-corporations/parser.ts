/**
 * Crown Corporations Parser — Quill
 *
 * Parses HTML listing pages from crown corporation websites to extract
 * report metadata (links, titles, fiscal years, report types).
 *
 * Full PDF financial statement parsing is deferred — this parser focuses
 * on extracting what's available from HTML listing pages, RSS feeds,
 * and structured data sources.
 *
 * Each crown corporation publishes differently structured pages:
 *   - CBC: Grid/list of annual report PDFs with years
 *   - Canada Post: Portal with categorized reports
 *   - CMHC: Corporate reporting page with links
 *   - EDC: Annual report portal
 *   - Others: Various HTML structures
 *
 * The parser normalises across all sources into the unified
 * CrownCorporationRecord schema.
 */

import { computeHash } from '../../verification/hashing.js';
import { extractReportLinks } from './fetcher.js';
import type {
  CrownCorporationRecord,
  CrownCorporationCode,
  ReportType,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Main Entry Point                                                   */
/* ------------------------------------------------------------------ */

/**
 * Parse raw HTML into crown corporation records.
 *
 * Takes HTML from a crown corporation's listing page and extracts
 * report metadata. This handles the general case where we've fetched
 * a listing page and need to extract the report links.
 *
 * @param html - Raw HTML from the listing page
 * @param org - Crown corporation code
 * @param orgName - Organization full name
 * @param options - Parsing options
 * @returns Array of normalized CrownCorporationRecord
 */
export async function parseReport(
  html: string,
  org: CrownCorporationCode,
  orgName: string,
  options: {
    sourceUrl?: string;
    fiscalYear?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {},
): Promise<CrownCorporationRecord[]> {
  const now = new Date().toISOString();
  const records: CrownCorporationRecord[] = [];
  const seenHashes = new Set<string>();

  // Extract links from the HTML
  const reportLinks = extractReportLinks(html);

  for (const link of reportLinks) {
    try {
      // Determine fiscal year
      let fiscalYear: string;
      const yearMatch = link.text.match(/\b(20\d{2})\b/);
      if (yearMatch) {
        fiscalYear = yearMatch[1];
      } else {
        const urlYearMatch = link.url.match(/\b(20\d{2})\b/);
        fiscalYear = urlYearMatch?.[1] ?? options.fiscalYear ?? new Date().getFullYear().toString();
      }

      // Determine report type
      const reportType = detectReportType(link.text, link.url);

      // Determine quarter
      const quarter = detectQuarter(link.text, link.url);

      // Build hash
      const hashContent = `${org}|${fiscalYear}|${reportType}|${link.url}|${link.text}`;
      const id = await computeHash(hashContent, 'sha256');

      if (seenHashes.has(id)) continue;
      seenHashes.add(id);

      records.push({
        id,
        org,
        orgName,
        reportType,
        fiscalYear,
        fiscalQuarter: quarter,
        title: link.title || null,
        summary: null,
        revenue: null,
        expenses: null,
        netIncome: null,
        governmentFunding: null,
        totalAssets: null,
        totalLiabilities: null,
        employeeCount: null,
        executiveCompensation: null,
        boardMembers: null,
        boardChair: null,
        ceoName: null,
        reportUrl: link.url,
        publishedDate: null,
        language: null,
        sourceUrl: options.sourceUrl ?? link.url,
        sourceSystem: `${org.toLowerCase()}-html-parser`,
        ingestedAt: now,
      });
    } catch (err) {
      console.warn(`[CrownCorp Parser] Skipping ${org} link "${link.text}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return records;
}

/**
 * Parse multiple raw records into normalized records.
 * Handles deduplication and error tolerance.
 *
 * @param rawRecords - Array of raw data objects or arrays of records
 * @param org - Crown corporation code
 * @returns Array of normalized CrownCorporationRecord
 */
export async function parseRecords(
  rawRecords: Array<CrownCorporationRecord | CrownCorporationRecord[]>,
  org: CrownCorporationCode,
): Promise<CrownCorporationRecord[]> {
  const records: CrownCorporationRecord[] = [];
  const seenHashes = new Set<string>();

  const items = rawRecords.flat();

  for (const raw of items) {
    try {
      // If already a full CrownCorporationRecord, just deduplicate
      if (!seenHashes.has(raw.id)) {
        seenHashes.add(raw.id);
        records.push(raw);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[CrownCorp Parser] Skipping ${org} record: ${msg}`);
    }
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Helper Functions                                                   */
/* ------------------------------------------------------------------ */

/**
 * Detect the report type from link text and URL.
 */
export function detectReportType(title: string, url: string): ReportType {
  const combined = (title + ' ' + url).toLowerCase();

  if (/\bannual\b/.test(combined)) return 'annual-report';
  if (/\bquarter(?:ly)?\b/.test(combined)) return 'quarterly-financials';
  if (/\bcorporate\s*plan\b/.test(combined)) return 'corporate-plan';
  if (/\bboard\s*minutes\b/.test(combined)) return 'board-minutes';
  if (/\bexecutive\s*comp(?:ensation)?\b/.test(combined)) return 'executive-compensation';
  if (/\bsustainability\b/.test(combined)) return 'sustainability-report';
  if (/\bdiversity\b/.test(combined)) return 'diversity-report';

  return 'other';
}

/**
 * Detect the fiscal quarter from title and URL text.
 */
export function detectQuarter(title: string, url: string): string | null {
  const combined = (title + ' ' + url).toLowerCase();
  const match = combined.match(/q([1-4])/);
  if (match) return `Q${match[1]}`;
  // Check for "first quarter", "second quarter", etc.
  if (/\bfirst\s+quarter\b/.test(combined)) return 'Q1';
  if (/\bsecond\s+quarter\b/.test(combined)) return 'Q2';
  if (/\bthird\s+quarter\b/.test(combined)) return 'Q3';
  if (/\bfourth\s+quarter\b/.test(combined)) return 'Q4';
  return null;
}

/**
 * Extract fiscal year from text content.
 */
export function extractFiscalYear(text: string): string | null {
  const match = text.match(/\b(20\d{2})\b/);
  return match ? match[1] : null;
}

/**
 * Normalize crown corporation code — case-insensitive lookup.
 */
export function normalizeOrgCode(input: string): CrownCorporationCode | null {
  const upper = input.toUpperCase().trim();

  const codeMap: Record<string, CrownCorporationCode> = {
    'CBC': 'CBC',
    'RADIO-CANADA': 'CBC',
    'CBC/RADIO-CANADA': 'CBC',
    'CPC': 'CPC',
    'CANADA POST': 'CPC',
    'CANADA POST CORPORATION': 'CPC',
    'CN': 'CN',
    'CN RAIL': 'CN',
    'CNR': 'CN',
    'CANADIAN NATIONAL': 'CN',
    'VIA': 'VIA',
    'VIA RAIL': 'VIA',
    'VIARail': 'VIA',
    'EDC': 'EDC',
    'EXPORT DEVELOPMENT CANADA': 'EDC',
    'BDC': 'BDC',
    'BUSINESS DEVELOPMENT BANK': 'BDC',
    'CMHC': 'CMHC',
    'SCHL': 'CMHC',
    'CANADA MORTGAGE AND HOUSING': 'CMHC',
    'CCC': 'CCC',
    'CANADA COUNCIL': 'CCC',
    'CANADA COUNCIL FOR THE ARTS': 'CCC',
    'NAC': 'NAC',
    'NATIONAL ARTS CENTRE': 'NAC',
    'NRC': 'NRC',
    'NATIONAL RESEARCH COUNCIL': 'NRC',
    'FCC': 'FCC',
    'FARM CREDIT CANADA': 'FCC',
    'PSP': 'PBC',
    'PSP INVESTMENTS': 'PBC',
    'PUBLIC SECTOR PENSION': 'PBC',
  };

  return codeMap[upper] ?? null;
}
