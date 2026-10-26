/**
 * Newfoundland and Labrador Lobbying Fetcher — Quill
 *
 * Searches the NL Lobbyists Registry (gov.nl.ca) for lobbying records.
 * Uses undici for HTTP (consistent with the rest of the pipeline).
 *
 * NL registry: https://www.gov.nl.ca/gs/registries/lobbyists/
 * Operated by: Registry of Lobbyists / CADO
 */

import { httpGet } from '../../../utils/http.js';
import { NEWFOUNDLAND_LOBBYING, DEFAULT_FETCH_TIMEOUT_MS } from '../constants.js';
import type { RawNewfoundlandRecord } from '../types.js';
import type { HttpResponse } from '../../../utils/http.js';


export class NLLobbyingFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'NLLobbyingFetchError';
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
    throw new NLLobbyingFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.body;
}


/**
 * Search the NL Lobbyists Registry by query text.
 * Parses HTML search results to extract basic registration info.
 */
export async function searchNLRegistry(
  query: string,
): Promise<Partial<RawNewfoundlandRecord>[]> {
  const searchUrl = `${NEWFOUNDLAND_LOBBYING.SEARCH}?q=${encodeURIComponent(query)}`;

  try {
    const html = await fetchHtml(searchUrl);
    return parseNLSearchHtml(html, searchUrl);
  } catch (err) {
    console.warn('[NL-Lobbying] Registry search failed:', (err as Error).message);
    return [];
  }
}


/**
 * Parse NL Lobbyists Registry HTML search results.
 *
 * The NL registry typically shows results in a table format with columns:
 *   - Registration Number
 *   - Lobbyist Name / Business Name
 *   - Client Name
 *   - Subject Matter
 *   - Status
 *   - Registration Date
 */
function parseNLSearchHtml(
  html: string,
  sourceUrl: string,
): Partial<RawNewfoundlandRecord>[] {
  const results: Partial<RawNewfoundlandRecord>[] = [];

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
 * Fetch lobbying records from NL sources.
 */
export async function fetchNLLobbying(
  options: {
    query?: string;
    limit?: number;
  } = {},
): Promise<{
  records: RawNewfoundlandRecord[];
  source: string;
  errors: string[];
}> {
  const errors: string[] = [];
  let records: RawNewfoundlandRecord[] = [];
  let source = 'none';

  // Try HTML search
  if (options.query) {
    try {
      const searchResults = await searchNLRegistry(options.query);
      records = searchResults as RawNewfoundlandRecord[];
      source = 'nl-html-search';
    } catch (err) {
      errors.push(`NL HTML search failed: ${(err as Error).message}`);
    }
  }

  // No query specified — try fetching the general search page
  if (records.length === 0) {
    try {
      const html = await fetchHtml(NEWFOUNDLAND_LOBBYING.SEARCH);
      const searchResults = parseNLSearchHtml(html, NEWFOUNDLAND_LOBBYING.SEARCH);
      records = searchResults as RawNewfoundlandRecord[];
      source = 'nl-search-page';
    } catch (err) {
      errors.push(`NL search page fetch failed: ${(err as Error).message}`);
    }
  }

  if (options.limit && records.length > options.limit) {
    records = records.slice(0, options.limit);
  }

  return { records, source, errors };
}
