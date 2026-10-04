/**
 * Bank of Canada Fetcher — Quill
 *
 * HTTP fetchers for Bank of Canada data from multiple sources:
 *
 *   1. RSS feed for rate announcements (key rate decisions)
 *   2. MPR and FSR publication listing pages
 *   3. VALA executive speeches pages
 *   4. Detail page fetcher for deep metadata extraction
 *
 * Uses undici for cross-platform HTTP (Node, Workers, Bun).
 * Consistent with the rest of the Quill.
 */

import { httpGet } from '../../utils/http.js';
import {
  BOC_BASE_URL,
  BOC_RATES_URL,
  BOC_RATES_RSS_URL,
  BOC_MPR_URL,
  BOC_FSR_URL,
  VALA_BASE_URL,
  DEFAULT_HEADERS,
  DEFAULT_TIMEOUT_MS,
  MAX_RSS_ITEMS,
  HISTORICAL_YEARS_BACK,
  MAX_DETAIL_FETCHES,
} from './constants.js';
import type {
  RawBocItem,
  BocDecisionType,
} from './types.js';


/* ------------------------------------------------------------------ */
/*  Custom Errors                                                      */
/* ------------------------------------------------------------------ */

export class BocFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'BocFetchError';
  }
}


/* ------------------------------------------------------------------ */
/*  Base HTTP Fetch Helpers                                            */
/* ------------------------------------------------------------------ */

/**
 * Fetch raw text from a URL.
 */
async function fetchUrl(
  url: string,
  options: { timeoutMs?: number; accept?: string } = {},
): Promise<{ statusCode: number; body: string }> {
  const reqHeaders: Record<string, string> = { ...DEFAULT_HEADERS };
  if (options.accept) {
    reqHeaders.Accept = options.accept;
  }

  const resp = await httpGet(url, {
    headers: reqHeaders,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new BocFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return { statusCode: resp.statusCode, body: resp.body };
}


/* ------------------------------------------------------------------ */
/*  RSS Feed Parsing (inline — avoids extra XML dependency)            */
/* ------------------------------------------------------------------ */

interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

/**
 * Extract text content from an XML tag (handles CDATA).
 */
function extractTag(xml: string, tag: string): string | null {
  // Try CDATA first
  const cdataMatch = xml.match(
    new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i'),
  );
  if (cdataMatch) return cdataMatch[1].trim();

  // Try regular content
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  if (match) return match[1].trim();

  return null;
}

/**
 * Decode HTML entities in a string.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_m: string, n: string) => String.fromCharCode(parseInt(n, 10)));
}

/**
 * Parse an RSS feed and return channel items.
 */
function parseRSS(body: string): RSSItem[] {
  const items: RSSItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(body)) !== null) {
    const itemXml = match[1];
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const description = extractTag(itemXml, 'description');
    const pubDate = extractTag(itemXml, 'pubDate');

    if (title && link) {
      items.push({
        title: decodeHtmlEntities(title),
        link: link.trim(),
        description: description ? decodeHtmlEntities(description) : '',
        pubDate: pubDate || '',
      });
    }
  }

  return items;
}

/**
 * Parse an RSS date string into ISO-8601 format (YYYY-MM-DD).
 */
function parseRSSDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toISOString().substring(0, 10);
}


/* ------------------------------------------------------------------ */
/*  RSS Feed Fetcher — Rate Announcements                              */
/* ------------------------------------------------------------------ */

/**
 * Fetch Bank of Canada rate decisions from the RSS feed.
 *
 * The Bank of Canada publishes an RSS feed of rate announcements
 * at https://www.bankofcanada.ca/rates/rss/
 *
 * @returns Array of raw decision items
 */
export async function fetchBocRateRSSFeed(
  options: { timeoutMs?: number; maxItems?: number } = {},
): Promise<RawBocItem[]> {
  try {
    const maxItems = options.maxItems ?? MAX_RSS_ITEMS;
    const result = await fetchUrl(BOC_RATES_RSS_URL, {
      accept: 'application/rss+xml, application/xml, text/xml',
      timeoutMs: options.timeoutMs,
    });

    const items = parseRSS(result.body);
    const truncated = items.slice(0, maxItems);

    return truncated.map(item => ({
      title: item.title,
      date: parseRSSDate(item.pubDate),
      url: item.link,
      summary: item.description || null,
      rawType: 'rate',
      bodyHtml: null,
      speaker: null,
    }));
  } catch (err) {
    if (err instanceof BocFetchError) throw err;
    throw new BocFetchError(
      `RSS fetch failed for ${BOC_RATES_RSS_URL}: ${err instanceof Error ? err.message : String(err)}`,
      undefined,
      BOC_RATES_RSS_URL,
    );
  }
}


/* ------------------------------------------------------------------ */
/*  Publication Listing Fetchers                                       */
/* ------------------------------------------------------------------ */

/**
 * Fetch Monetary Policy Report publications.
 *
 * The MPR page lists all Monetary Policy Reports with links to
 * individual report pages.
 *
 * @param year - Optional year filter (e.g., '2024')
 * @returns Array of raw publication items
 */
export async function fetchBocMPRList(
  year?: string,
  options: { timeoutMs?: number } = {},
): Promise<RawBocItem[]> {
  const url = year
    ? `${BOC_MPR_URL}?year=${year}`
    : BOC_MPR_URL;

  try {
    const result = await fetchUrl(url, {
      accept: 'text/html',
      timeoutMs: options.timeoutMs,
    });

    return parsePublicationListing(result.body, url, 'mpr');
  } catch (err) {
    if (err instanceof BocFetchError) throw err;
    throw new BocFetchError(
      `MPR fetch failed for ${url}: ${err instanceof Error ? err.message : String(err)}`,
      undefined,
      url,
    );
  }
}

/**
 * Fetch Financial System Review publications.
 *
 * The FSR page lists all Financial System Reviews with links to
 * individual review pages.
 *
 * @param year - Optional year filter (e.g., '2024')
 * @returns Array of raw publication items
 */
export async function fetchBocFSRList(
  year?: string,
  options: { timeoutMs?: number } = {},
): Promise<RawBocItem[]> {
  const url = year
    ? `${BOC_FSR_URL}?year=${year}`
    : BOC_FSR_URL;

  try {
    const result = await fetchUrl(url, {
      accept: 'text/html',
      timeoutMs: options.timeoutMs,
    });

    return parsePublicationListing(result.body, url, 'fsr');
  } catch (err) {
    if (err instanceof BocFetchError) throw err;
    throw new BocFetchError(
      `FSR fetch failed for ${url}: ${err instanceof Error ? err.message : String(err)}`,
      undefined,
      url,
    );
  }
}

/**
 * Parse a publication listing HTML page to extract report links.
 *
 * Bank of Canada publication listing pages typically contain a list
 * of publications with titles, dates, and links.
 */
function parsePublicationListing(
  html: string,
  listingUrl: string,
  type: BocDecisionType,
): RawBocItem[] {
  const items: RawBocItem[] = [];
  const seen = new Set<string>();

  // Pattern 1: <article> elements with links (modern BoC site)
  const articlePattern = /<article[^>]*>([\s\S]*?)<\/article>/gi;
  let articleMatch: RegExpExecArray | null;

  while ((articleMatch = articlePattern.exec(html)) !== null) {
    const articleContent = articleMatch[1];

    const linkMatch = articleContent.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const href = linkMatch[1].trim();
    const linkText = linkMatch[2].replace(/<[^>]*>/g, '').trim();

    // Build full URL
    const fullUrl = resolveUrl(href, listingUrl);
    if (seen.has(fullUrl)) continue;
    seen.add(fullUrl);

    // Extract date from article
    const dateMatch = articleContent.match(/(\d{4}-\d{2}-\d{2})/);
    const dateStr = dateMatch ? dateMatch[1] : '';

    // Extract summary from article description
    const summaryMatch = articleContent.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const summary = summaryMatch
      ? summaryMatch[1].replace(/<[^>]*>/g, '').trim()
      : null;

    items.push({
      title: linkText,
      date: dateStr,
      url: fullUrl,
      summary,
      rawType: type,
      bodyHtml: null,
      speaker: null,
    });
  }

  // Pattern 2: <li> elements with links (fallback)
  if (items.length === 0) {
    const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch: RegExpExecArray | null;

    while ((liMatch = liPattern.exec(html)) !== null) {
      const liContent = liMatch[1];

      const linkMatch = liContent.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!linkMatch) continue;

      const href = linkMatch[1].trim();
      const linkText = linkMatch[2].replace(/<[^>]*>/g, '').trim();

      const fullUrl = resolveUrl(href, listingUrl);
      if (seen.has(fullUrl)) continue;
      seen.add(fullUrl);

      const dateMatch = liContent.match(/(\d{4}-\d{2}-\d{2})/);
      const dateStr = dateMatch ? dateMatch[1] : '';

      items.push({
        title: linkText,
        date: dateStr,
        url: fullUrl,
        summary: null,
        rawType: type,
        bodyHtml: null,
        speaker: null,
      });
    }
  }

  return items;
}

/**
 * Resolve a potentially relative URL against a base URL.
 */
function resolveUrl(href: string, baseUrl: string): string {
  if (href.startsWith('http')) return href;
  if (href.startsWith('/')) return `${BOC_BASE_URL}${href}`;
  // Relative to the base URL directory
  const baseDir = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
  return `${baseDir}${href}`;
}


/* ------------------------------------------------------------------ */
/*  Detail Page Fetcher                                                */
/* ------------------------------------------------------------------ */

/**
 * Fetch the detail HTML page for a decision or publication.
 *
 * @param url - The URL of the detail page
 * @returns Raw page with HTML body
 */
export async function fetchDetailPage(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<RawBocItem> {
  try {
    const result = await fetchUrl(url, {
      accept: 'text/html',
      timeoutMs: options.timeoutMs,
    });

    return {
      title: '',
      date: '',
      url,
      summary: null,
      rawType: '',
      bodyHtml: result.body,
      speaker: null,
    };
  } catch (err) {
    if (err instanceof BocFetchError) throw err;
    throw new BocFetchError(
      `Detail fetch failed for ${url}: ${err instanceof Error ? err.message : String(err)}`,
      undefined,
      url,
    );
  }
}

/**
 * Fetch detail pages for multiple items.
 *
 * @param items - Raw items to fetch detail pages for
 * @param options - Options including max fetches
 * @returns Map of URL -> HTML body
 */
export async function fetchDetailPages(
  items: RawBocItem[],
  options: { timeoutMs?: number; maxFetches?: number } = {},
): Promise<Map<string, string>> {
  const maxFetches = options.maxFetches ?? MAX_DETAIL_FETCHES;
  const detailPages = new Map<string, string>();
  const toFetch = items.slice(0, maxFetches);

  for (const item of toFetch) {
    try {
      const detail = await fetchDetailPage(item.url, {
        timeoutMs: options.timeoutMs,
      });
      if (detail.bodyHtml) {
        detailPages.set(item.url, detail.bodyHtml);
      }
    } catch {
      // Some pages may not be accessible — that's okay
    }
  }

  return detailPages;
}


/* ------------------------------------------------------------------ */
/*  VALA Executive Speech Fetcher                                      */
/* ------------------------------------------------------------------ */

/**
 * Fetch VALA executive speeches.
 *
 * VALA publishes speeches by Bank of Canada executives (Governor,
 * Senior Deputy Governor, etc.) on their website.
 *
 * @returns Array of raw speech items
 */
export async function fetchBocSpeeches(
  options: { timeoutMs?: number } = {},
): Promise<RawBocItem[]> {
  const speechesUrl = `${VALA_BASE_URL}/speeches`;

  try {
    const result = await fetchUrl(speechesUrl, {
      accept: 'text/html',
      timeoutMs: options.timeoutMs,
    });

    return parseSpeechListing(result.body, speechesUrl);
  } catch (err) {
    if (err instanceof BocFetchError) throw err;
    throw new BocFetchError(
      `Speech fetch failed for ${speechesUrl}: ${err instanceof Error ? err.message : String(err)}`,
      undefined,
      speechesUrl,
    );
  }
}

/**
 * Parse a speech listing page to extract speech items.
 */
function parseSpeechListing(html: string, listingUrl: string): RawBocItem[] {
  const items: RawBocItem[] = [];
  const seen = new Set<string>();

  // Pattern: look for article/card elements with speech links
  const cardPattern = /<div[^>]*class="[^"]*(?:speech|article|card|item)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  let cardMatch: RegExpExecArray | null;

  while ((cardMatch = cardPattern.exec(html)) !== null) {
    const cardContent = cardMatch[1];

    const linkMatch = cardContent.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const href = linkMatch[1].trim();
    const linkText = linkMatch[2].replace(/<[^>]*>/g, '').trim();

    const fullUrl = resolveUrl(href, listingUrl);
    if (seen.has(fullUrl)) continue;
    seen.add(fullUrl);

    // Extract date
    const dateMatch = cardContent.match(/(\d{4}-\d{2}-\d{2})/);
    const dateStr = dateMatch ? dateMatch[1] : '';

    // Extract speaker name (often bold/strong or in a specific element)
    const speakerMatch = cardContent.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i);
    const speaker = speakerMatch ? speakerMatch[1].replace(/<[^>]*>/g, '').trim() : null;

    // Extract summary
    const summaryMatch = cardContent.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const summary = summaryMatch
      ? summaryMatch[1].replace(/<[^>]*>/g, '').trim()
      : null;

    items.push({
      title: linkText,
      date: dateStr,
      url: fullUrl,
      summary,
      rawType: 'speech',
      bodyHtml: null,
      speaker,
    });
  }

  // Fallback: generic link extraction from any page
  if (items.length === 0) {
    const linkPattern = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let linkMatch: RegExpExecArray | null;

    while ((linkMatch = linkPattern.exec(html)) !== null) {
      const href = linkMatch[1].trim();
      const linkText = linkMatch[2].replace(/<[^>]*>/g, '').trim();

      if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
      if (!href.includes('speech') && !href.includes('discours')) continue;

      const fullUrl = resolveUrl(href, listingUrl);
      if (seen.has(fullUrl)) continue;
      seen.add(fullUrl);

      items.push({
        title: linkText,
        date: '',
        url: fullUrl,
        summary: null,
        rawType: 'speech',
        bodyHtml: null,
        speaker: null,
      });
    }
  }

  return items;
}


/* ------------------------------------------------------------------ */
/*  Aggregate Fetchers                                                 */
/* ------------------------------------------------------------------ */

export interface BocFetchResult {
  decisions: RawBocItem[];
  sourcesTried: string[];
  errors: string[];
}

/**
 * Fetch all Bank of Canada rate decisions from RSS feed.
 *
 * @param options - Options for fetching
 * @returns Fetch result with raw items
 */
export async function fetchAllBocRateDecisions(
  options: { timeoutMs?: number; maxItems?: number } = {},
): Promise<BocFetchResult> {
  const errors: string[] = [];
  const sourcesTried: string[] = [BOC_RATES_RSS_URL];
  const decisions: RawBocItem[] = [];

  try {
    const items = await fetchBocRateRSSFeed({
      timeoutMs: options.timeoutMs,
      maxItems: options.maxItems,
    });
    decisions.push(...items);
  } catch (err) {
    errors.push(`Rate RSS feed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { decisions, sourcesTried, errors };
}

/**
 * Fetch all Bank of Canada publications (MPR and FSR).
 *
 * @param yearsBack - Number of historical years to fetch
 * @returns Fetch result with raw items
 */
export async function fetchAllBocPublications(
  yearsBack: number = HISTORICAL_YEARS_BACK,
  options: { timeoutMs?: number } = {},
): Promise<BocFetchResult> {
  const errors: string[] = [];
  const sourcesTried: string[] = [];
  const decisions: RawBocItem[] = [];
  const currentYear = new Date().getFullYear();

  // Fetch MPRs for recent years
  for (let y = currentYear; y >= currentYear - yearsBack; y--) {
    const yearStr = String(y);
    sourcesTried.push(`${BOC_MPR_URL}?year=${yearStr}`);
    try {
      const mprItems = await fetchBocMPRList(yearStr, {
        timeoutMs: options.timeoutMs,
      });
      decisions.push(...mprItems);
    } catch (err) {
      errors.push(`MPR ${yearStr}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Fetch FSRs for recent years
  for (let y = currentYear; y >= currentYear - yearsBack; y--) {
    const yearStr = String(y);
    sourcesTried.push(`${BOC_FSR_URL}?year=${yearStr}`);
    try {
      const fsrItems = await fetchBocFSRList(yearStr, {
        timeoutMs: options.timeoutMs,
      });
      decisions.push(...fsrItems);
    } catch (err) {
      errors.push(`FSR ${yearStr}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { decisions, sourcesTried, errors };
}

/**
 * Fetch all Bank of Canada executive speeches.
 *
 * @returns Fetch result with raw items
 */
export async function fetchAllBocSpeeches(
  options: { timeoutMs?: number } = {},
): Promise<BocFetchResult> {
  const errors: string[] = [];
  const sourcesTried: string[] = [`${VALA_BASE_URL}/speeches`];
  const decisions: RawBocItem[] = [];

  try {
    const items = await fetchBocSpeeches({
      timeoutMs: options.timeoutMs,
    });
    decisions.push(...items);
  } catch (err) {
    errors.push(`VALA speeches: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { decisions, sourcesTried, errors };
}

/**
 * Fetch all Bank of Canada data (rate decisions, publications, speeches).
 *
 * @returns Combined fetch result
 */
export async function fetchAllBocData(
  options: {
    timeoutMs?: number;
    maxRssItems?: number;
    historicalYears?: number;
  } = {},
): Promise<BocFetchResult> {
  const errors: string[] = [];
  const sourcesTried: string[] = [];
  const decisions: RawBocItem[] = [];

  // 1. Rate decisions
  const rateResult = await fetchAllBocRateDecisions({
    timeoutMs: options.timeoutMs,
    maxItems: options.maxRssItems,
  });
  decisions.push(...rateResult.decisions);
  sourcesTried.push(...rateResult.sourcesTried);
  errors.push(...rateResult.errors);

  // 2. MPR and FSR publications
  const pubResult = await fetchAllBocPublications(
    options.historicalYears ?? HISTORICAL_YEARS_BACK,
    { timeoutMs: options.timeoutMs },
  );
  decisions.push(...pubResult.decisions);
  sourcesTried.push(...pubResult.sourcesTried);
  errors.push(...pubResult.errors);

  // 3. Executive speeches
  const speechResult = await fetchAllBocSpeeches({
    timeoutMs: options.timeoutMs,
  });
  decisions.push(...speechResult.decisions);
  sourcesTried.push(...speechResult.sourcesTried);
  errors.push(...speechResult.errors);

  return { decisions, sourcesTried, errors };
}
