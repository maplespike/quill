/**
 * Prince Edward Island Lobbying Fetcher — Quill
 *
 * Searches the PEI Lobbyists Registry (www.princeedwardisland.ca/en/feature/lobbyist-registry) for lobbying records.
 * Uses undici for HTTP (consistent with the rest of the pipeline).
 *
 * PEI registry: https://www.princeedwardisland.ca/en/feature/lobbyist-registry
 * Operated by: Office of the Registrar of Lobbyists
 */

import { httpGet } from '../../../utils/http.js';
import { PEI_LOBBYING, DEFAULT_FETCH_TIMEOUT_MS } from '../constants.js';
import type { RawPEIRecord } from '../types.js';
import type { HttpResponse } from '../../../utils/http.js';


export class PELobbyingFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'PELobbyingFetchError';
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
    throw new PELobbyingFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.body;
}


/**
 * Search the PEI Lobbyists Registry by query text.
 * Parses HTML search results to extract basic registration info.
 */
export async function searchPERegistry(
  query: string,
): Promise<Partial<RawPEIRecord>[]> {
  const searchUrl = `${PEI_LOBBYING.SEARCH}?q=${encodeURIComponent(query)}`;

  try {
    const html = await fetchHtml(searchUrl);
    return parsePESearchHtml(html, searchUrl);
  } catch (err) {
    console.warn('[PE-Lobbying] Registry search failed:', (err as Error).message);
    return [];
  }
}


/**
 * Parse PEI Lobbyists Registry HTML search results.
 *
 * The PEI registry typically shows results in a table format with columns:
 *   - Registration Number
 *   - Lobbyist Name / Business Name
 *   - Client Name
 *   - Subject Matter
 *   - Status
 *   - Registration Date
 */
function parsePESearchHtml(
  html: string,
  sourceUrl: string,
): Partial<RawPEIRecord>[] {
  const results: Partial<RawPEIRecord>[] = [];

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
 * Fetch lobbying records from PEI sources.
 */
export async function fetchPELobbying(
  options: {
    query?: string;
    limit?: number;
  } = {},
): Promise<{
  records: RawPEIRecord[];
  source: string;
  errors: string[];
}> {
  const errors: string[] = [];
  let records: RawPEIRecord[] = [];
  let source = 'none';

  // Try HTML search
  if (options.query) {
    try {
      const searchResults = await searchPERegistry(options.query);
      records = searchResults as RawPEIRecord[];
      source = 'pei-html-search';
    } catch (err) {
      errors.push(`PE HTML search failed: ${(err as Error).message}`);
    }
  }

  // No query specified — try fetching the general search page
  if (records.length === 0) {
    try {
      const html = await fetchHtml(PEI_LOBBYING.SEARCH);
      const searchResults = parsePESearchHtml(html, PEI_LOBBYING.SEARCH);
      records = searchResults as RawPEIRecord[];
      source = 'pei-search-page';
    } catch (err) {
      errors.push(`PE search page fetch failed: ${(err as Error).message}`);
    }
  }

  if (options.limit && records.length > options.limit) {
    records = records.slice(0, options.limit);
  }

  return { records, source, errors };
}
