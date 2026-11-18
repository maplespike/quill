// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Crown Corporations Fetcher — Quill
 *
 * HTTP fetchers for crown corporation reports, financial data, and
 * governance documents across Canada's federally owned enterprises.
 *
 * Each crown corporation publishes its data differently:
 *   - CBC/Radio-Canada: HTML listing pages for annual reports, quarterly financials
 *   - Canada Post: HTML portal with PDF links
 *   - CMHC: Corporate reporting page with PDF listings
 *   - EDC: Annual report portal + RSS for updates
 *   - BDC: Financial data reports page
 *   - Via Rail: Corporate reports page with PDFs
 *   - Others: Various HTML/PDF formats
 *
 * The main entry point is fetchCrownCorpReport(org, year) which
 * dispatches to org-specific fetchers.
 *
 * NOTE: This module primarily fetches metadata and links to reports.
 * Full PDF parsing is deferred — the parser extracts what it can
 * from HTML listing pages and stores report URLs for later deep analysis.
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  CROWN_CORP_CONFIGS,
  CURRENT_CROWN_CORPS,
  ANNUAL_REPORT_URL_PATTERNS,
  DEFAULT_HEADERS,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RECORDS,
  CrownCorporationError,
} from './constants.js';
import type {
  CrownCorporationCode,
  CrownCorporationRecord,
  ReportType,
  CrownCorporationConfig,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Helper: extract links from HTML listing pages                      */
/* ------------------------------------------------------------------ */

/**
 * Extract report links from an HTML listing page.
 * Uses regex to find <a> tags with href attributes that look like
 * report URLs (containing keywords like 'annual', 'report', 'financial',
 * or ending in .pdf in relevant sections).
 *
 * @param html - Raw HTML content
 * @returns Array of { url, title, text }
 */
export function extractReportLinks(
  html: string,
): Array<{ url: string; title: string; text: string }> {
  const links: Array<{ url: string; title: string; text: string }> = [];
  const seen = new Set<string>();

  // Match <a> tags with href
  const linkPattern = /<a\s+[^>]*href\s*=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  const reportKeywords = /\b(annual\s*report|quarterly|financial|corporate\s*plan|sustainability|board\s*minutes|executive\s*compensation|diversity)\b/i;
  const pdfExt = /\.pdf$/i;

  while ((match = linkPattern.exec(html)) !== null) {
    const url = match[1].trim();
    const innerHtml = match[2];
    const text = innerHtml.replace(/<[^>]+>/g, '').trim();

    // Only keep links that look like reports
    if (!url || url === '#' || url.startsWith('javascript:')) continue;
    if (url.startsWith('/') || url.startsWith('http')) {
      const cleanUrl = url.startsWith('http') ? url : `https:${url}`;
      const key = text + cleanUrl;
      if (seen.has(key)) continue;
      seen.add(key);

      // Keep if it matches report keywords or is a PDF
      if (reportKeywords.test(text) || reportKeywords.test(url) || pdfExt.test(url)) {
        links.push({ url: cleanUrl, title: text, text });
      }
    }
  }

  return links;
}

/**
 * Resolve a possibly-relative URL against a base URL.
 */
export function resolveUrl(href: string, baseUrl: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return href;
  }
  const base = new URL(baseUrl);
  return new URL(href, base.origin).href;
}

/* ------------------------------------------------------------------ */
/*  Main Entry Point                                                   */
/* ------------------------------------------------------------------ */

/**
 * Fetch crown corporation reports for a given org.
 *
 * This is the main entry point that dispatches to org-specific fetchers.
 * For orgs without specific fetchers, it attempts generic HTML parsing
 * of the annual reports listing page.
 *
 * @param org - Crown corporation code
 * @param options - Options including year, report types, etc.
 * @returns Array of partial CrownCorporationRecord objects
 */
export async function fetchCrownCorpReport(
  org: CrownCorporationCode,
  options: {
    reportTypes?: ReportType[];
    fiscalYear?: string;
    dateFrom?: string;
    dateTo?: string;
    maxRecords?: number;
  } = {},
): Promise<CrownCorporationRecord[]> {
  const config = CROWN_CORP_CONFIGS[org];
  if (!config) {
    throw new CrownCorporationError(
      `Unknown crown corporation: ${org}`,
      'UNKNOWN_ORG',
      org,
    );
  }

  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  const now = new Date().toISOString();
  const records: CrownCorporationRecord[] = [];

  try {
    // Try fetching the annual reports listing page
    const listingUrl = ANNUAL_REPORT_URL_PATTERNS[org];
    if (!listingUrl) {
      return [];
    }

    const resp = await httpGet(listingUrl, {
      headers: {
        ...DEFAULT_HEADERS,
        Accept: 'text/html,application/xhtml+xml,*/*',
      },
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode >= 400) {
      throw new CrownCorporationError(
        `${config.shortName} listing returned HTTP ${resp.statusCode}`,
        'HTTP_ERROR',
        org,
        listingUrl,
        resp.statusCode,
      );
    }

    // Extract report links from the listing page
    const reportLinks = extractReportLinks(resp.body);

    for (let i = 0; i < Math.min(reportLinks.length, maxRecords); i++) {
      const link = reportLinks[i];

      // Determine fiscal year from link text or current year
      const fiscalYearMatch = link.text.match(/\b(20\d{2})\b/);
      const fiscalYear = fiscalYearMatch?.[1] ?? options.fiscalYear ?? new Date().getFullYear().toString();

      // Determine report type from link text
      let reportType: ReportType = 'other';
      const lowerText = link.text.toLowerCase();
      const lowerUrl = link.url.toLowerCase();
      const combined = lowerText + ' ' + lowerUrl;

      if (/\bannual\b/.test(combined)) reportType = 'annual-report';
      else if (/\bquarter(?:ly)?\b/.test(combined)) reportType = 'quarterly-financials';
      else if (/\bcorporate\s*plan\b/.test(combined)) reportType = 'corporate-plan';
      else if (/\bboard\s*minutes\b/.test(combined)) reportType = 'board-minutes';
      else if (/\bexecutive\s*compensation\b/.test(combined)) reportType = 'executive-compensation';
      else if (/\bsustainability\b/.test(combined)) reportType = 'sustainability-report';
      else if (/\bdiversity\b/.test(combined)) reportType = 'diversity-report';

      // Determine quarter from text
      const quarterMatch = combined.match(/q([1-4])/);
      const fiscalQuarter = quarterMatch?.[0]?.toUpperCase() ?? null;

      const resolvedUrl = resolveUrl(link.url, listingUrl);

      // Build hash
      const hashContent = `${org}|${fiscalYear}|${reportType}|${resolvedUrl}|${link.text}`;
      const id = await computeHash(hashContent, 'sha256');

      records.push({
        id,
        org,
        orgName: config.name,
        reportType,
        fiscalYear,
        fiscalQuarter,
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
        reportUrl: resolvedUrl,
        publishedDate: null,
        language: null,
        sourceUrl: resolvedUrl,
        sourceSystem: `${org.toLowerCase()}-listing`,
        ingestedAt: now,
      });
    }
  } catch (err) {
    if (err instanceof CrownCorporationError) throw err;
    throw new CrownCorporationError(
      `Failed to fetch ${config.shortName} reports: ${err instanceof Error ? err.message : String(err)}`,
      'FETCH_ERROR',
      org,
      ANNUAL_REPORT_URL_PATTERNS[org],
    );
  }

  return records;
}

/**
 * Convenience method to fetch all crown corporations at once.
 */
export async function fetchAllCrownCorps(
  options: {
    orgs?: CrownCorporationCode[];
    reportTypes?: ReportType[];
    fiscalYear?: string;
    dateFrom?: string;
    dateTo?: string;
    maxRecordsPerOrg?: number;
  } = {},
): Promise<Record<string, CrownCorporationRecord[]>> {
  const orgs = options.orgs ?? CURRENT_CROWN_CORPS.map((c) => c.code);
  const maxRecordsPerOrg = options.maxRecordsPerOrg ?? DEFAULT_MAX_RECORDS;

  const result: Record<string, CrownCorporationRecord[]> = {};

  for (const org of orgs) {
    try {
      result[org] = await fetchCrownCorpReport(org, {
        reportTypes: options.reportTypes,
        fiscalYear: options.fiscalYear,
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
        maxRecords: maxRecordsPerOrg,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[CrownCorp Fetcher] ${org}: ${msg}`);
      result[org] = [];
    }
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Org-Specific Fetchers                                              */
/* ------------------------------------------------------------------ */

/**
 * Fetch CBC/Radio-Canada reports.
 * CBC has a structured listing page for annual reports, quarterly
 * financial results, and corporate plans.
 *
 * @param options - Fetch options
 * @returns Array of CrownCorporationRecord
 */
export async function fetchCBCReports(
  options: {
    reportType?: ReportType;
    fiscalYear?: string;
    maxRecords?: number;
  } = {},
): Promise<CrownCorporationRecord[]> {
  return fetchCrownCorpReport('CBC', options);
}

/**
 * Fetch Canada Post reports.
 * Canada Post publishes annual reports and quarterly financials.
 *
 * @param options - Fetch options
 * @returns Array of CrownCorporationRecord
 */
export async function fetchCanadaPostReports(
  options: {
    reportType?: ReportType;
    fiscalYear?: string;
    maxRecords?: number;
  } = {},
): Promise<CrownCorporationRecord[]> {
  return fetchCrownCorpReport('CPC', options);
}

/**
 * Fetch CMHC reports.
 * CMHC's corporate reporting page links to annual reports, quarterly
 * financials, and housing market data.
 *
 * @param options - Fetch options
 * @returns Array of CrownCorporationRecord
 */
export async function fetchCMHCReports(
  options: {
    reportType?: ReportType;
    fiscalYear?: string;
    maxRecords?: number;
  } = {},
): Promise<CrownCorporationRecord[]> {
  return fetchCrownCorpReport('CMHC', options);
}

/**
 * Fetch EDC reports.
 * EDC publishes annual reports and quarterly results.
 *
 * @param options - Fetch options
 * @returns Array of CrownCorporationRecord
 */
export async function fetchEDCReports(
  options: {
    reportType?: ReportType;
    fiscalYear?: string;
    maxRecords?: number;
  } = {},
): Promise<CrownCorporationRecord[]> {
  return fetchCrownCorpReport('EDC', options);
}

/**
 * Fetch Via Rail reports.
 * Via Rail publishes annual reports and corporate plans.
 *
 * @param options - Fetch options
 * @returns Array of CrownCorporationRecord
 */
export async function fetchViaRailReports(
  options: {
    reportType?: ReportType;
    fiscalYear?: string;
    maxRecords?: number;
  } = {},
): Promise<CrownCorporationRecord[]> {
  return fetchCrownCorpReport('VIA', options);
}

/**
 * Fetch BDC reports.
 *
 * @param options - Fetch options
 * @returns Array of CrownCorporationRecord
 */
export async function fetchBDCReports(
  options: {
    reportType?: ReportType;
    fiscalYear?: string;
    maxRecords?: number;
  } = {},
): Promise<CrownCorporationRecord[]> {
  return fetchCrownCorpReport('BDC', options);
}
