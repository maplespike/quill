/**
 * Saskatchewan Lobbying Fetcher — Quill
 *
 * Searches the Saskatchewan Lobbyists Registry (www.sasklobbyistregistry.ca) for lobbying records.
 * Uses undici for HTTP (consistent with the rest of the pipeline).
 *
 * SK registry: https://www.sasklobbyistregistry.ca/
 * Operated by: Office of the Registrar of Lobbyists
 */

import { httpGet } from '../../../utils/http.js';
import { SASKATCHEWAN_LOBBYING, DEFAULT_FETCH_TIMEOUT_MS } from '../constants.js';
import type { RawSaskatchewanRecord } from '../types.js';
import type { HttpResponse } from '../../../utils/http.js';


export class SKLobbyingFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'SKLobbyingFetchError';
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
    throw new SKLobbyingFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.body;
}


/**
 * Search the Saskatchewan Lobbyists Registry by query text.
 * Parses HTML search results to extract basic registration info.
 */
export async function searchSKRegistry(
  query: string,
): Promise<Partial<RawSaskatchewanRecord>[]> {
  const searchUrl = `${SASKATCHEWAN_LOBBYING.SEARCH}?q=${encodeURIComponent(query)}`;

  try {
    const html = await fetchHtml(searchUrl);
    return parseSKSearchHtml(html, searchUrl);
  } catch (err) {
    console.warn('[SK-Lobbying] Registry search failed:', (err as Error).message);
    return [];
  }
}


/**
 * Parse Saskatchewan Lobbyists Registry HTML search results.
 *
 * The SK registry typically shows results in a table format with columns:
 *   - Registration Number
 *   - Lobbyist Name / Business Name
 *   - Client Name
 *   - Subject Matter
 *   - Status
 *   - Registration Date
 */
function parseSKSearchHtml(
  html: string,
  sourceUrl: string,
): Partial<RawSaskatchewanRecord>[] {
  const results: Partial<RawSaskatchewanRecord>[] = [];

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
 * Fetch lobbying records from Saskatchewan sources.
 */
export async function fetchSKLobbying(
  options: {
    query?: string;
    limit?: number;
  } = {},
): Promise<{
  records: RawSaskatchewanRecord[];
  source: string;
  errors: string[];
}> {
  const errors: string[] = [];
  let records: RawSaskatchewanRecord[] = [];
  let source = 'none';

  // Try HTML search
  if (options.query) {
    try {
      const searchResults = await searchSKRegistry(options.query);
      records = searchResults as RawSaskatchewanRecord[];
      source = 'sk-html-search';
    } catch (err) {
      errors.push(`SK HTML search failed: ${(err as Error).message}`);
    }
  }

  // No query specified — try fetching the general search page
  if (records.length === 0) {
    try {
      const html = await fetchHtml(SASKATCHEWAN_LOBBYING.SEARCH);
      const searchResults = parseSKSearchHtml(html, SASKATCHEWAN_LOBBYING.SEARCH);
      records = searchResults as RawSaskatchewanRecord[];
      source = 'sk-search-page';
    } catch (err) {
      errors.push(`SK search page fetch failed: ${(err as Error).message}`);
    }
  }

  if (options.limit && records.length > options.limit) {
    records = records.slice(0, options.limit);
  }

  return { records, source, errors };
}
