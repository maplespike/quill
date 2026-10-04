/**
 * Nova Scotia Lobbying Fetcher — Quill
 *
 * Searches the Nova Scotia Registry of Lobbyists (novascotia.ca/sns/Lobbyist/) for lobbying records.
 * Uses undici for HTTP (consistent with the rest of the pipeline).
 *
 * NS registry: https://novascotia.ca/sns/Lobbyist/
 * Operated by: Service Nova Scotia — Registry of Lobbyists
 */

import { httpGet } from '../../../utils/http.js';
import { NOVA_SCOTIA_LOBBYING, DEFAULT_FETCH_TIMEOUT_MS } from '../constants.js';
import type { RawNovaScotiaRecord } from '../types.js';
import type { HttpResponse } from '../../../utils/http.js';


export class NSLobbyingFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'NSLobbyingFetchError';
  }
}


const DEFAULT_HEADERS = {
  'User-Agent': 'Quill/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
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
    throw new NSLobbyingFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.body;
}


/**
 * Search the Nova Scotia Registry of Lobbyists by query text.
 * Parses HTML search results to extract basic registration info.
 */
export async function searchNSRegistry(
  query: string,
): Promise<Partial<RawNovaScotiaRecord>[]> {
  const searchUrl = `${NOVA_SCOTIA_LOBBYING.SEARCH}?q=${encodeURIComponent(query)}`;

  try {
    const html = await fetchHtml(searchUrl);
    return parseNSSearchHtml(html, searchUrl);
  } catch (err) {
    console.warn('[NS-Lobbying] Registry search failed:', (err as Error).message);
    return [];
  }
}


/**
 * Parse Nova Scotia Registry of Lobbyists HTML search results.
 *
 * The Nova Scotia registry typically shows results in a table format with columns:
 *   - Registration Number
 *   - Lobbyist Name / Business Name
 *   - Client Name
 *   - Subject Matter
 *   - Status
 *   - Registration Date
 */
function parseNSSearchHtml(
  html: string,
  sourceUrl: string,
): Partial<RawNovaScotiaRecord>[] {
  const results: Partial<RawNovaScotiaRecord>[] = [];

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
 * Fetch lobbying records from Nova Scotia sources.
 */
export async function fetchNSLobbying(
  options: {
    query?: string;
    limit?: number;
  } = {},
): Promise<{
  records: RawNovaScotiaRecord[];
  source: string;
  errors: string[];
}> {
  const errors: string[] = [];
  let records: RawNovaScotiaRecord[] = [];
  let source = 'none';

  // Try HTML search
  if (options.query) {
    try {
      const searchResults = await searchNSRegistry(options.query);
      records = searchResults as RawNovaScotiaRecord[];
      source = 'ns-html-search';
    } catch (err) {
      errors.push(`NS HTML search failed: ${(err as Error).message}`);
    }
  }

  // No query specified — try fetching the general search page
  if (records.length === 0) {
    try {
      const html = await fetchHtml(NOVA_SCOTIA_LOBBYING.SEARCH);
      const searchResults = parseNSSearchHtml(html, NOVA_SCOTIA_LOBBYING.SEARCH);
      records = searchResults as RawNovaScotiaRecord[];
      source = 'ns-search-page';
    } catch (err) {
      errors.push(`NS search page fetch failed: ${(err as Error).message}`);
    }
  }

  if (options.limit && records.length > options.limit) {
    records = records.slice(0, options.limit);
  }

  return { records, source, errors };
}
