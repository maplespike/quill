/**
 * Committee Fetcher — Quill
 *
 * HTTP fetcher for House of Commons committee data.
 * Uses undici for cross-platform HTTP (Node, Workers, Bun).
 *
 * URL patterns:
 *   - Meeting list:   /Committees/en/{ACRONYM}/Meetings
 *   - Evidence HTML:  /DocumentViewer/en/{Parl}-{Session}/{ACRONYM}/meeting-{N}/evidence
 *   - Evidence XML:   /Content/Committee/{Parl}{Session}/{ACRONYM}/Evidence/{EV_ID}/{ACRONYM}EV{N}-{LANG}.XML
 *
 * The XML URL is scraped from the evidence HTML page because
 * the EVIDENCE ID changes per meeting and is not predictable.
 */

import { httpGet } from '../../utils/http.js';
import { OURCOMMONS_BASE } from './constants.js';

export class CommitteeFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'CommitteeFetchError';
  }
}



const DEFAULT_HEADERS = {
  'User-Agent': 'Quill/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
} as const;

export async function fetchUrl(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<{ statusCode: number; body: string; headers: Record<string, string> }> {
  const resp = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS },
    timeoutMs: options.timeoutMs ?? 30_000,
  });

  if (resp.statusCode >= 400) {
    throw new CommitteeFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return { statusCode: resp.statusCode, body: resp.body, headers: resp.headers };
}



export function extractXmlUrlFromHtml(html: string, baseUrl: string): string | null {
  // Match the btn-export-xml link
  const match = html.match(/<a\s[^>]*class="[^"]*\bbtn-export-xml\b[^"]*"[^>]*href="([^"]+)"/i);
  if (match && match[1]) {
    const href = match[1];
    // Handle relative URLs — use the provided baseUrl
    if (href.startsWith('/')) {
      const parsed = new URL(baseUrl);
      return `${parsed.origin}${href}`;
    }
    if (href.startsWith('http')) {
      return href;
    }
    return new URL(href, baseUrl).href;
  }
  return null;
}

/**
 * Extract the DocumentId from meta tags in the HTML page.
 * <meta name="DocumentId" content="..." />
 */
export function extractDocumentId(html: string): string | null {
  const match = html.match(/<meta\s+name="DocumentId"\s+content="([^"]+)"/i);
  return match?.[1] ?? null;
}

/**
 * Extract meeting metadata from HTML meta tags.
 */
export function extractMetaFromHtml(html: string): Record<string, string> {
  const metas: Record<string, string> = {};
  const regex = /<meta\s+name="([^"]+)"\s+content="([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    metas[m[1]] = m[2];
  }
  return metas;
}

/**
 * Fetch evidence XML for a committee meeting.
 * Uses a two-step process:
 *   1. Fetch the evidence HTML page
 *   2. Extract the XML URL from the export link
 *   3. Fetch the actual XML
 */
export async function fetchEvidenceXml(
  htmlUrl: string,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  // Step 1: Fetch the HTML page
  const htmlResult = await fetchUrl(htmlUrl, options);

  // Step 2: Extract XML URL
  const xmlUrl = extractXmlUrlFromHtml(htmlResult.body, htmlUrl);
  if (!xmlUrl) {
    throw new CommitteeFetchError(
      'Could not find XML export link in evidence HTML page',
      undefined,
      htmlUrl,
    );
  }

  // Step 3: Fetch XML with Accept header
  const xmlResp = await httpGet(xmlUrl, {
    headers: {
      ...DEFAULT_HEADERS,
      Accept: 'application/xml,text/xml,*/*',
    },
    timeoutMs: options.timeoutMs ?? 30_000,
  });

  const xml = xmlResp.body;

  if (xmlResp.statusCode >= 400) {
    throw new CommitteeFetchError(
      `HTTP ${xmlResp.statusCode} fetching XML from ${xmlUrl}`,
      xmlResp.statusCode,
      xmlUrl,
    );
  }

  return xml;
}

/**
 * Fetch the meeting list HTML page for a committee.
 */
export async function fetchMeetingList(
  acronym: string,
  options: { timeoutMs?: number; baseUrl?: string } = {},
): Promise<string> {
  const baseUrl = options.baseUrl ?? OURCOMMONS_BASE;
  const url = `${baseUrl}/Committees/en/${acronym}/Meetings`;
  const result = await fetchUrl(url, options);
  return result.body;
}

/**
 * Fetch the evidence HTML page for a specific meeting.
 * Useful for scraping metadata (DocumentId, InCameraNote, etc.).
 */
export async function fetchEvidenceHtml(
  parliament: number,
  session: number,
  acronym: string,
  meetingNumber: number,
  baseUrl: string = OURCOMMONS_BASE,
): Promise<string> {
  const url = `${baseUrl}/DocumentViewer/en/${parliament}-${session}/${acronym}/meeting-${meetingNumber}/evidence`;
  const result = await fetchUrl(url);
  return result.body;
}
