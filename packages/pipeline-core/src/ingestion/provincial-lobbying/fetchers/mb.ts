/**
 * Manitoba Lobbying Fetcher — Quill
 *
 * Searches the Manitoba Lobbyists Registry (lobbyistregistrar.mb.ca) for lobbying records.
 * Uses undici for HTTP (consistent with the rest of the pipeline).
 *
 * Manitoba registry: https://www.lobbyistregistrar.mb.ca/
 * Operated by: Office of the Lobbyist Registrar
 * Search portal: https://registry.lobbyistregistrar.mb.ca/lra/index.do
 */

import { httpGet } from '../../../utils/http.js';
import { MANITOBA_LOBBYING, DEFAULT_FETCH_TIMEOUT_MS } from '../constants.js';
import type { RawManitobaRecord } from '../types.js';
import type { HttpResponse } from '../../../utils/http.js';


export class MBLobbyingFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'MBLobbyingFetchError';
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
    throw new MBLobbyingFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.body;
}


/**
 * Search the Manitoba Lobbyists Registry by query text.
 * Parses HTML search results to extract basic registration info.
 */
export async function searchMBRegistry(
  query: string,
): Promise<Partial<RawManitobaRecord>[]> {
  const searchUrl = `${MANITOBA_LOBBYING.SEARCH}?q=${encodeURIComponent(query)}`;

  try {
    const html = await fetchHtml(searchUrl);
    return parseMBSearchHtml(html, searchUrl);
  } catch (err) {
    console.warn('[MB-Lobbying] Registry search failed:', (err as Error).message);
    return [];
  }
}


/**
 * Parse Manitoba Lobbyists Registry HTML search results.
 *
 * The Manitoba registry typically shows results in a table format with columns:
 *   - Registration Number
 *   - Lobbyist Name / Business Name
 *   - Client Name
 *   - Subject Matter
 *   - Status
 *   - Registration Date
 */
function parseMBSearchHtml(
  html: string,
  sourceUrl: string,
): Partial<RawManitobaRecord>[] {
  const results: Partial<RawManitobaRecord>[] = [];

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
 * Fetch lobbying records from Manitoba sources.
 */
export async function fetchMBLobbying(
  options: {
    query?: string;
    limit?: number;
  } = {},
): Promise<{
  records: RawManitobaRecord[];
  source: string;
  errors: string[];
}> {
  const errors: string[] = [];
  let records: RawManitobaRecord[] = [];
  let source = 'none';

  // Try HTML search
  if (options.query) {
    try {
      const searchResults = await searchMBRegistry(options.query);
      records = searchResults as RawManitobaRecord[];
      source = 'mb-html-search';
    } catch (err) {
      errors.push(`MB HTML search failed: ${(err as Error).message}`);
    }
  }

  // No query specified — try fetching the general search page
  if (records.length === 0) {
    try {
      const html = await fetchHtml(MANITOBA_LOBBYING.SEARCH);
      const searchResults = parseMBSearchHtml(html, MANITOBA_LOBBYING.SEARCH);
      records = searchResults as RawManitobaRecord[];
      source = 'mb-search-page';
    } catch (err) {
      errors.push(`MB search page fetch failed: ${(err as Error).message}`);
    }
  }

  if (options.limit && records.length > options.limit) {
    records = records.slice(0, options.limit);
  }

  return { records, source, errors };
}
