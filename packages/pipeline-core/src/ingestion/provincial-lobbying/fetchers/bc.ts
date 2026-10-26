/**
 * British Columbia Lobbying Fetcher — Quill
 *
 * Searches the BC Lobbyists Registry (lobbyists.bc.ca) for lobbying records.
 * Uses undici for HTTP (consistent with the rest of the pipeline).
 *
 * BC registry: https://lobbyists.bc.ca/
 * Operated by: Office of the Registrar of Lobbyists
 */

import { httpGet } from '../../../utils/http.js';
import { BC_LOBBYING, DEFAULT_FETCH_TIMEOUT_MS } from '../constants.js';
import type { RawBCRecord } from '../types.js';
import type { HttpResponse } from '../../../utils/http.js';


export class BCLobbyingFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'BCLobbyingFetchError';
  }
}


const DEFAULT_HEADERS = {
  'User-Agent': 'Quill/0.1 (civic-tech; mailto:hello@maplespike.ca)',
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
    timeoutMs: options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new BCLobbyingFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.body;
}


/**
 * Search the BC Lobbyists Registry by query text.
 * Parses HTML search results to extract basic registration info.
 */
export async function searchBCRegistry(
  query: string,
): Promise<Partial<RawBCRecord>[]> {
  const searchUrl = `${BC_LOBBYING.SEARCH}?q=${encodeURIComponent(query)}`;

  try {
    const html = await fetchHtml(searchUrl);
    return parseBCSearchHtml(html, searchUrl);
  } catch (err) {
    console.warn('[BC-Lobbying] Registry search failed:', (err as Error).message);
    return [];
  }
}


/**
 * Parse BC Lobbyists Registry HTML search results.
 *
 * The BC registry typically shows results in a table format with columns:
 *   - Registration Number
 *   - Lobbyist Name / Business Name
 *   - Client Name
 *   - Subject Matter
 *   - Status
 *   - Registration Date
 */
function parseBCSearchHtml(
  html: string,
  sourceUrl: string,
): Partial<RawBCRecord>[] {
  const results: Partial<RawBCRecord>[] = [];

  // Match table rows in the search results
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const cells = rowMatch[1].match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
    if (!cells || cells.length < 3) continue;

    const extractCell = (idx: number): string => {
      const cell = cells[idx];
      if (!cell) return '';
      return cell.replace(/<[^>]+>/g, '').trim();
    };

    const regLinkMatch = cells[0]?.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
    const registrationNumber = regLinkMatch
      ? regLinkMatch[1].replace(/<[^>]+>/g, '').trim()
      : extractCell(0);

    if (!registrationNumber) continue;

    results.push({
      registrationNumber,
      lobbyistName: extractCell(1) || undefined,
      clientName: extractCell(2) || undefined,
      subjectMatters: extractCell(3) ? [extractCell(3)] : [],
      sourceUrl: sourceUrl,
    });
  }

  return results;
}


/**
 * Fetch lobbying records from BC sources.
 */
export async function fetchBCLobbying(
  options: {
    query?: string;
    limit?: number;
  } = {},
): Promise<{
  records: RawBCRecord[];
  source: string;
  errors: string[];
}> {
  const errors: string[] = [];
  let records: RawBCRecord[] = [];
  let source = 'none';

  // Try HTML search
  if (options.query) {
    try {
      const searchResults = await searchBCRegistry(options.query);
      records = searchResults as RawBCRecord[];
      source = 'bc-html-search';
    } catch (err) {
      errors.push(`BC HTML search failed: ${(err as Error).message}`);
    }
  }

  // No query specified — try fetching the general search page
  if (records.length === 0) {
    try {
      const html = await fetchHtml(BC_LOBBYING.SEARCH);
      const searchResults = parseBCSearchHtml(html, BC_LOBBYING.SEARCH);
      records = searchResults as RawBCRecord[];
      source = 'bc-search-page';
    } catch (err) {
      errors.push(`BC search page fetch failed: ${(err as Error).message}`);
    }
  }

  if (options.limit && records.length > options.limit) {
    records = records.slice(0, options.limit);
  }

  return { records, source, errors };
}
