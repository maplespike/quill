/**
 * Alberta Lobbying Fetcher — Quill
 *
 * Searches the Alberta Lobbyist Registry (albertalobbyistregistry.ca) for lobbying records.
 * Uses undici for HTTP (consistent with the rest of the pipeline).
 *
 * Alberta registry: https://www.albertalobbyistregistry.ca/
 * Operated by: Office of the Ethics Commissioner
 */

import { httpGet } from '../../../utils/http.js';
import { ALBERTA_LOBBYING, DEFAULT_FETCH_TIMEOUT_MS } from '../constants.js';
import type { RawAlbertaRecord } from '../types.js';
import type { HttpResponse } from '../../../utils/http.js';


export class AlbertaLobbyingFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'AlbertaLobbyingFetchError';
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
    throw new AlbertaLobbyingFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.body;
}


/**
 * Search the Alberta Lobbyist Registry by query text.
 * The Alberta registry uses Oracle APEX and may have a different
 * search interface than other provinces.
 */
export async function searchAlbertaRegistry(
  query: string,
): Promise<Partial<RawAlbertaRecord>[]> {
  const searchUrl = `${ALBERTA_LOBBYING.SEARCH}?q=${encodeURIComponent(query)}`;

  try {
    const html = await fetchHtml(searchUrl);
    return parseAlbertaSearchHtml(html, searchUrl);
  } catch (err) {
    console.warn('[AB-Lobbying] Registry search failed:', (err as Error).message);
    return [];
  }
}


/**
 * Parse Alberta Lobbyist Registry HTML search results.
 *
 * The Alberta registry (Oracle APEX) typically shows results in tables with:
 *   - Registration Number
 *   - Lobbyist Name
 *   - Client Name
 *   - Subject Matter(s)
 *   - Status
 *   - Effective Date
 */
function parseAlbertaSearchHtml(
  html: string,
  sourceUrl: string,
): Partial<RawAlbertaRecord>[] {
  const results: Partial<RawAlbertaRecord>[] = [];

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
 * Fetch lobbying records from Alberta sources.
 */
export async function fetchAlbertaLobbying(
  options: {
    query?: string;
    limit?: number;
  } = {},
): Promise<{
  records: RawAlbertaRecord[];
  source: string;
  errors: string[];
}> {
  const errors: string[] = [];
  let records: RawAlbertaRecord[] = [];
  let source = 'none';

  // Try HTML search
  if (options.query) {
    try {
      const searchResults = await searchAlbertaRegistry(options.query);
      records = searchResults as RawAlbertaRecord[];
      source = 'ab-html-search';
    } catch (err) {
      errors.push(`AB HTML search failed: ${(err as Error).message}`);
    }
  }

  // No query — fetch the general search page
  if (records.length === 0) {
    try {
      const html = await fetchHtml(ALBERTA_LOBBYING.SEARCH);
      const searchResults = parseAlbertaSearchHtml(html, ALBERTA_LOBBYING.SEARCH);
      records = searchResults as RawAlbertaRecord[];
      source = 'ab-search-page';
    } catch (err) {
      errors.push(`AB search page fetch failed: ${(err as Error).message}`);
    }
  }

  if (options.limit && records.length > options.limit) {
    records = records.slice(0, options.limit);
  }

  return { records, source, errors };
}
