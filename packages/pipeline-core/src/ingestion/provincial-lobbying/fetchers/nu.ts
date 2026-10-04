/**
 * Nunavut Lobbying Fetcher — Quill
 *
 * Nunavut has no territorial lobbyist registry. However, many Nunavut-based
 * organizations (Nunavut Tunngavik Inc., Nunavut Wildlife Management Board,
 * Nunavut Impact Review Board, etc.) must register as lobbyists with the
 * federal Office of the Commissioner of Lobbying (OCL) when they lobby
 * the federal government.
 *
 * This fetcher proxies the federal OCL advanced registry search to find
 * Nunavut-related lobbying registrations.
 *
 * Federal OCL: https://lobbycanada.gc.ca/
 * Operated by: Office of the Commissioner of Lobbying (federal)
 */

import { httpGet } from '../../../utils/http.js';
import { NUNAVUT_LOBBYING, DEFAULT_FETCH_TIMEOUT_MS } from '../constants.js';
import type { RawNunavutRecord } from '../types.js';
import type { HttpResponse } from '../../../utils/http.js';


/** Federal OCL search URL from config. */
const FEDERAL_OCL_SEARCH_URL = NUNAVUT_LOBBYING.SEARCH;


export class NULobbyingFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'NULobbyingFetchError';
  }
}


const DEFAULT_HEADERS = {
  'User-Agent': 'Quill/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-CA,en;q=0.5',
} as const;


/**
 * Fetch raw HTML from a URL via httpGet.
 */
async function fetchHtml(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const resp: HttpResponse = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS as Record<string, string> },
    timeoutMs: options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new NULobbyingFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.body;
}


/**
 * Search the federal OCL registry with a specific query term.
 *
 * Queries the advanced search by client/organization name and parses
 * the HTML results table into RawNunavutRecord partials.
 */
export async function searchNURegistry(
  query: string,
): Promise<Partial<RawNunavutRecord>[]> {
  const params = new URLSearchParams({
    adv_1001_clientOrgCorpListingName: query,
    adv_1001_level1common: 'clientOrgCorpListingName',
    srch: 'Search',
  });
  const searchUrl = `${FEDERAL_OCL_SEARCH_URL}?${params.toString()}`;

  try {
    const html = await fetchHtml(searchUrl);
    return parseFederalRegistryHtml(html, searchUrl, query);
  } catch (err) {
    console.warn('[NU-Lobbying] Federal registry search failed:', (err as Error).message);
    return [];
  }
}


/**
 * Parse federal OCL registry HTML search results table.
 *
 * The federal registry displays results in an HTML table with columns:
 *   Column 0: Client/Organization name (with detail link)
 *   Column 1: Type — Consultant / In-house Organization
 *   Column 2: Lobbyist name(s)
 *   Column 3: Registration number
 *   Column 4: Registration date range
 *   Column 5: Status
 *
 * Subject-matter tags may appear as links within each row.
 */
function parseFederalRegistryHtml(
  html: string,
  searchUrl: string,
  _searchTerm: string,
): Partial<RawNunavutRecord>[] {
  const results: Partial<RawNunavutRecord>[] = [];

  // Match table rows in the HTML
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const rowHtml = rowMatch[1];

    // Skip header rows and empty rows
    if (rowHtml.includes('<th') || rowHtml.trim().length === 0) continue;

    const cells = rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
    if (!cells || cells.length < 3) continue;

    const extractCell = (idx: number): string => {
      const cell = cells[idx];
      if (!cell) return '';
      return cell.replace(/<[^>]+>/g, '').trim();
    };

    // Column 0: Client name (may contain an anchor tag)
    const clientLinkMatch = cells[0]?.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
    const clientName = clientLinkMatch
      ? clientLinkMatch[1].replace(/<[^>]+>/g, '').trim()
      : extractCell(0);

    // Column 2: Lobbyist name
    const lobbyistName = extractCell(2) || undefined;

    // Column 3: Registration number (primary dedup key)
    const registrationNumber = extractCell(3) || undefined;

    // Skip rows that have neither a registration number nor client name
    if (!registrationNumber && !clientName) continue;

    // Column 1: Lobbyist type / category
    const lobbyistCategory = extractCell(1) || undefined;

    // Column 4: Date range — extract start and end dates
    const dateRange = extractCell(4);
    let registrationStartDate: string | undefined;
    let registrationEndDate: string | undefined;
    if (dateRange) {
      const dateParts = dateRange.split(/\s*[-–—]\s*/);
      if (dateParts.length >= 2) {
        registrationStartDate = dateParts[0].trim() || undefined;
        registrationEndDate = dateParts[1].trim() || undefined;
      } else {
        registrationStartDate = dateParts[0].trim() || undefined;
      }
    }

    // Extract subject-matter links within the row (excluding navigation links)
    const subjectMatters: string[] = [];
    const linkPattern = /<a[^>]*href=['"]([^'"]*)['"][^>]*>([\s\S]*?)<\/a>/gi;
    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = linkPattern.exec(rowHtml)) !== null) {
      const text = linkMatch[2].replace(/<[^>]+>/g, '').trim();
      // Filter out generic navigation / column header text
      if (
        text &&
        text.length > 2 &&
        !/^(Client|Type|Lobbyist|Registration|Date|Status|Organization|Name)$/i.test(text)
      ) {
        subjectMatters.push(text);
      }
    }

    results.push({
      registrationNumber: registrationNumber || undefined,
      lobbyistName,
      clientName: clientName || undefined,
      lobbyistCategory,
      subjectMatters: subjectMatters.length > 0 ? subjectMatters : undefined,
      registrationStartDate,
      registrationEndDate,
      sourceUrl: searchUrl,
    });
  }

  return results;
}


/**
 * Search the federal OCL registry with multiple Nunavut-related keywords,
 * deduplicating results by registration number.
 *
 * Keywords searched:
 *   - "Nunavut" (primary — matches most NU orgs)
 *   - "Iqaluit" (capital — catches other NU-based organizations)
 */
async function searchNunavutRegistrations(): Promise<Partial<RawNunavutRecord>[]> {
  const keywords = ['Nunavut', 'Iqaluit'];
  const seen = new Set<string>();
  const allRecords: Partial<RawNunavutRecord>[] = [];

  for (const keyword of keywords) {
    try {
      const records = await searchNURegistry(keyword);
      for (const record of records) {
        const key = record.registrationNumber
          ?? `${record.clientName ?? ''}-${record.lobbyistName ?? ''}`;
        if (key && !seen.has(key)) {
          seen.add(key);
          allRecords.push(record);
        }
      }
    } catch (err) {
      console.warn('[NU-Lobbying] Keyword search failed:', (err as Error).message);
    }
  }

  return allRecords;
}


/**
 * Fetch Nunavut lobbying records from the federal OCL registry.
 *
 * Orchestrates searching with multiple Nunavut-related keywords,
 * deduplicates results by registration number. If all keyword searches
 * fail, returns graceful empty results (does NOT throw) with a descriptive
 * message in the errors array.
 */
export async function fetchNULobbying(
  options: {
    query?: string;
    limit?: number;
  } = {},
): Promise<{
  records: RawNunavutRecord[];
  source: string;
  errors: string[];
}> {
  const errors: string[] = [];
  let records: Partial<RawNunavutRecord>[] = [];
  let source = 'none';

  try {
    if (options.query) {
      // Single explicit query
      records = await searchNURegistry(options.query);
      source = 'federal-ocl-search';
    } else {
      // Multi-keyword NU search with dedup
      records = await searchNunavutRegistrations();
      source = 'federal-ocl-search';
    }
  } catch (err) {
    errors.push(`Nunavut lobbying search failed: ${(err as Error).message}`);
  }

  if (records.length === 0 && errors.length === 0) {
    errors.push('No Nunavut-related registrations found in the federal lobbying registry');
  }

  let typedRecords = records as RawNunavutRecord[];

  if (options.limit && typedRecords.length > options.limit) {
    typedRecords = typedRecords.slice(0, options.limit);
  }

  return {
    records: typedRecords,
    source,
    errors,
  };
}
