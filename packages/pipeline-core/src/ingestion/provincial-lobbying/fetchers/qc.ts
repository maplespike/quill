/**
 * Quebec Lobbying Fetcher — Quill
 *
 * Searches the Quebec Lobbyists Registry (lobbyists.quebec) for lobbying records.
 * Uses undici for HTTP (consistent with the rest of the pipeline).
 *
 * Quebec registry: https://www.lobbyists.quebec/
 * Operated by: Commissaire au lobbyisme du Quebec
 */

import { httpGet } from '../../../utils/http.js';
import { QUEBEC_LOBBYING, DEFAULT_FETCH_TIMEOUT_MS } from '../constants.js';
import type { RawQuebecRecord } from '../types.js';
import type { HttpResponse } from '../../../utils/http.js';


export class QuebecLobbyingFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'QuebecLobbyingFetchError';
  }
}


const DEFAULT_HEADERS = {
  'User-Agent': 'Quill/0.1 (civic-tech; mailto:dev@maplespike.ca)',
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
    throw new QuebecLobbyingFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.body;
}


/**
 * Search the Quebec Lobbyists Registry by query text.
 * The Quebec registry may have a French-language search interface.
 */
export async function searchQuebecRegistry(
  query: string,
): Promise<Partial<RawQuebecRecord>[]> {
  const searchUrl = `${QUEBEC_LOBBYING.SEARCH}?q=${encodeURIComponent(query)}`;

  try {
    const html = await fetchHtml(searchUrl);
    return parseQuebecSearchHtml(html, searchUrl);
  } catch (err) {
    console.warn('[QC-Lobbying] Registry search failed:', (err as Error).message);
    return [];
  }
}


/**
 * Parse Quebec Lobbyists Registry HTML search results.
 *
 * The Quebec registry typically shows results in a table with:
 *   - Numero d'inscription (Registration Number)
 *   - Nom du lobbyiste (Lobbyist Name)
 *   - Nom du client (Client Name)
 *   - Objet (Subject Matter)
 *   - Statut (Status)
 *   - Date d'inscription (Registration Date)
 */
function parseQuebecSearchHtml(
  html: string,
  sourceUrl: string,
): Partial<RawQuebecRecord>[] {
  const results: Partial<RawQuebecRecord>[] = [];

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
 * Fetch lobbying records from Quebec sources.
 */
export async function fetchQuebecLobbying(
  options: {
    query?: string;
    limit?: number;
  } = {},
): Promise<{
  records: RawQuebecRecord[];
  source: string;
  errors: string[];
}> {
  const errors: string[] = [];
  let records: RawQuebecRecord[] = [];
  let source = 'none';

  // Try HTML search
  if (options.query) {
    try {
      const searchResults = await searchQuebecRegistry(options.query);
      records = searchResults as RawQuebecRecord[];
      source = 'qc-html-search';
    } catch (err) {
      errors.push(`QC HTML search failed: ${(err as Error).message}`);
    }
  }

  // No query — fetch the general search page
  if (records.length === 0) {
    try {
      const html = await fetchHtml(QUEBEC_LOBBYING.SEARCH);
      const searchResults = parseQuebecSearchHtml(html, QUEBEC_LOBBYING.SEARCH);
      records = searchResults as RawQuebecRecord[];
      source = 'qc-search-page';
    } catch (err) {
      errors.push(`QC search page fetch failed: ${(err as Error).message}`);
    }
  }

  if (options.limit && records.length > options.limit) {
    records = records.slice(0, options.limit);
  }

  return { records, source, errors };
}
