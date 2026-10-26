/**
 * Gazette Fetcher — Quill
 *
 * HTTP fetcher for Canada Gazette RSS feeds and regulation detail pages.
 * Uses undici for cross-platform HTTP (Node, Workers, Bun).
 *
 * Sources:
 *   - Part I:   https://gazette.gc.ca/rss/p1-eng.xml
 *   - Part II:  https://gazette.gc.ca/rss/p2-eng.xml
 *   - Part III: https://gazette.gc.ca/rss/en-ls-eng.xml
 */

import { httpGet } from '../../utils/http.js';
import { GAZETTE_RSS_URLS, GAZETTE_BASE_URL } from './constants.js';
import { GazettePart } from './types.js';


export class GazetteFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'GazetteFetchError';
  }
}


const DEFAULT_HEADERS = {
  'User-Agent': 'MapleSpike/0.1 (civic-tech; mailto:hello@maplespike.ca)',
  Accept: 'application/rss+xml,application/xml,text/html,text/xml,*/*',
} as const;

/**
 * Fetch raw text from a URL using undici.
 */
export async function fetchUrl(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<{ statusCode: number; body: string; headers: Record<string, string> }> {
  const resp = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS as Record<string, string> },
    timeoutMs: options.timeoutMs ?? 30_000,
  });

  const body = await resp.body;
  const headers = resp.headers;

  if (resp.statusCode >= 400) {
    throw new GazetteFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return { statusCode: resp.statusCode, body, headers };
}


/**
 * Fetch the RSS feed XML for a given Gazette part.
 */
export async function fetchGazetteFeed(
  part: GazettePart,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const url = GAZETTE_RSS_URLS[part];
  const result = await fetchUrl(url, options);
  return result.body;
}


/**
 * Fetch the HTML detail page for a regulation.
 *
 * The Canada Gazette HTML pages contain:
 *   - The full regulation text
 *   - The Regulatory Impact Analysis Statement (RIAS)
 *   - Metadata (department, registration number, etc.)
 */
export async function fetchRegulationDetail(
  htmlUrl: string,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const headers = {
    ...DEFAULT_HEADERS,
    Accept: 'text/html,application/xhtml+xml,*/*',
  } as Record<string, string>;

  const resp = await httpGet(htmlUrl, {
    headers,
    timeoutMs: options.timeoutMs ?? 30_000,
  });

  const body = resp.body;

  if (resp.statusCode >= 400) {
    throw new GazetteFetchError(
      `HTTP ${resp.statusCode} fetching regulation detail from ${htmlUrl}`,
      resp.statusCode,
      htmlUrl,
    );
  }

  return body;
}
