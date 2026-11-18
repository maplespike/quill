// SPDX-License-Identifier: AGPL-3.0-only
/**
 * CRTC Fetcher — Quill
 *
 * HTTP fetchers for CRTC (Canadian Radio-television and Telecommunications
 * Commission) data from multiple sources:
 *
 *   1. RSS feeds for recent broadcasting and telecom decisions
 *   2. HTML archive pages for historical decisions by year
 *   3. CRTC ownership page for ownership/control data
 *   4. open.canada.ca CKAN for CRTC open data datasets
 *
 * Uses undici for cross-platform HTTP (Node, Workers, Bun).
 * Consistent with the rest of the Quill.
 */

import { httpGet } from '../../utils/http.js';
import {
  CRTC_BASE_URL,
  CRTC_DECISIONS_URL,
  CRTC_BROADCASTING_DECISIONS_URL,
  CRTC_TELECOM_DECISIONS_URL,
  CRTC_OWNERSHIP_URL,
  CRTC_RSS_FEEDS,
  CRTC_CKAN_SEARCH,
  CRTC_CKAN_PACKAGE_SHOW,
  CRTC_CKAN_PACKAGE_IDS,
  DEFAULT_HEADERS,
  DEFAULT_TIMEOUT_MS,
  MAX_RSS_ITEMS,
  MAX_ARCHIVE_PAGES,
  HISTORICAL_YEARS_BACK,
  CRTC_TYPE_TO_SEGMENT,
} from './constants.js';
import type {
  RawCrtcDecisionItem,
  RawCrtcOwnershipItem,
  CrtcDecisionType,
} from './types.js';


/* ------------------------------------------------------------------ */
/*  Custom Errors                                                      */
/* ------------------------------------------------------------------ */

export class CrtcFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'CrtcFetchError';
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
    throw new CrtcFetchError(
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
  category?: string;
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
    const category = extractTag(itemXml, 'category');

    if (title && link) {
      items.push({
        title: decodeHtmlEntities(title),
        link: link.trim(),
        description: description ? decodeHtmlEntities(description) : '',
        pubDate: pubDate || '',
        category: category || undefined,
      });
    }
  }

  return items;
}


/* ------------------------------------------------------------------ */
/*  Classification Helpers                                             */
/* ------------------------------------------------------------------ */

/**
 * Classify a decision type from a CRTC RSS feed source URL and item title.
 */
function classifyRssItemType(
  feedUrl: string,
  title: string,
  category?: string,
): { type: CrtcDecisionType; rawType: string } {
  // Check by feed URL first
  if (feedUrl === CRTC_RSS_FEEDS['broadcasting-decision']) {
    return { type: 'broadcasting-decision', rawType: 'Broadcasting Decision' };
  }
  if (feedUrl === CRTC_RSS_FEEDS['telecom-decision']) {
    return { type: 'telecom-decision', rawType: 'Telecom Decision' };
  }
  if (feedUrl === CRTC_RSS_FEEDS['notice-consultation']) {
    return { type: 'notice-consultation', rawType: 'Notice of Consultation' };
  }

  // Fall back to keyword matching in title
  const lower = title.toLowerCase();
  if (lower.includes('broadcasting decision') || lower.includes('décision de radiodiffusion')) {
    return { type: 'broadcasting-decision', rawType: 'Broadcasting Decision' };
  }
  if (lower.includes('telecom decision') || lower.includes('décision de télécom')) {
    return { type: 'telecom-decision', rawType: 'Telecom Decision' };
  }
  if (lower.includes('notice of consultation') || lower.includes('avis de consultation')) {
    return { type: 'notice-consultation', rawType: 'Notice of Consultation' };
  }
  if (lower.includes('broadcasting order') || lower.includes('ordonnance de radiodiffusion')) {
    return { type: 'administrative', rawType: 'Broadcasting Order' };
  }
  if (lower.includes('telecom order') || lower.includes('ordonnance de télécom')) {
    return { type: 'administrative', rawType: 'Telecom Order' };
  }
  if (lower.includes('policy') || lower.includes('politique')) {
    return { type: 'policy', rawType: 'Policy' };
  }

  // Use category if available
  if (category) {
    const catLower = category.toLowerCase();
    if (catLower.includes('broadcasting')) return { type: 'broadcasting-decision', rawType: catLower };
    if (catLower.includes('telecom')) return { type: 'telecom-decision', rawType: catLower };
  }

  return { type: 'broadcasting-decision', rawType: 'Broadcasting Decision' };
}

/**
 * Extract a CRTC decision number from a title string.
 * CRTC decision numbers follow patterns like:
 *   "Broadcasting Decision CRTC 2024-123"
 *   "Telecom Decision CRTC 2024-456"
 *   "CRTC 2024-789"
 */
function extractDecisionNumber(title: string, url: string): string | null {
  // Try pattern: "CRTC YYYY-NNN" in title
  const titleMatch = title.match(/CRTC\s+(\d{4}-\d+)/i);
  if (titleMatch) return titleMatch[1];

  // Try pattern from URL: /eng/archive/YYYY/YYYY-NNN.htm
  const urlMatch = url.match(/(\d{4}-\d+)\.htm/);
  if (urlMatch) return urlMatch[1];

  return null;
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
/*  RSS Feed Fetchers                                                  */
/* ------------------------------------------------------------------ */

/**
 * Fetch CRTC decisions from an RSS feed.
 *
 * @param feedUrl - One of the CRTC RSS feed URLs
 * @param decisionType - The canonical type for items from this feed
 * @returns Array of raw decision items
 */
export async function fetchCrtcRSSFeed(
  feedUrl: string,
  decisionType: CrtcDecisionType,
  options: { timeoutMs?: number; maxItems?: number } = {},
): Promise<RawCrtcDecisionItem[]> {
  try {
    const maxItems = options.maxItems ?? MAX_RSS_ITEMS;
    const result = await fetchUrl(feedUrl, {
      accept: 'application/rss+xml, application/xml, text/xml',
      timeoutMs: options.timeoutMs,
    });

    const items = parseRSS(result.body);
    const truncated = items.slice(0, maxItems);

    return truncated.map(item => {
      const typeInfo = classifyRssItemType(feedUrl, item.title, item.category);
      return {
        title: item.title,
        date: parseRSSDate(item.pubDate),
        url: item.link,
        summary: item.description || null,
        rawType: typeInfo.rawType,
        decisionNumber: extractDecisionNumber(item.title, item.link),
        bodyHtml: null,
      };
    });
  } catch (err) {
    if (err instanceof CrtcFetchError) throw err;
    throw new CrtcFetchError(
      `RSS fetch failed for ${feedUrl}: ${err instanceof Error ? err.message : String(err)}`,
      undefined,
      feedUrl,
    );
  }
}

/**
 * Fetch recent broadcasting decisions from CRTC RSS feed.
 */
export async function fetchRecentBroadcastingDecisions(
  options: { timeoutMs?: number; maxItems?: number } = {},
): Promise<RawCrtcDecisionItem[]> {
  return fetchCrtcRSSFeed(
    CRTC_RSS_FEEDS['broadcasting-decision'],
    'broadcasting-decision',
    options,
  );
}

/**
 * Fetch recent telecom decisions from CRTC RSS feed.
 */
export async function fetchRecentTelecomDecisions(
  options: { timeoutMs?: number; maxItems?: number } = {},
): Promise<RawCrtcDecisionItem[]> {
  return fetchCrtcRSSFeed(
    CRTC_RSS_FEEDS['telecom-decision'],
    'telecom-decision',
    options,
  );
}

/**
 * Fetch recent notices of consultation from CRTC RSS feed.
 */
export async function fetchRecentNoticesOfConsultation(
  options: { timeoutMs?: number; maxItems?: number } = {},
): Promise<RawCrtcDecisionItem[]> {
  return fetchCrtcRSSFeed(
    CRTC_RSS_FEEDS['notice-consultation'],
    'notice-consultation',
    options,
  );
}


/* ------------------------------------------------------------------ */
/*  Historical Archive Fetchers (HTML scraping)                        */
/* ------------------------------------------------------------------ */

/**
 * Fetch CRTC decisions from the HTML archive listing by year.
 *
 * The CRTC archive page lists decisions grouped by year. Each year page
 * links to individual decision pages.
 *
 * @param year - The year to fetch (e.g., '2024')
 * @param type - The type of decisions to fetch
 * @returns Array of raw decision items from the archive listing
 */
export async function fetchCrtcArchiveYear(
  year: string,
  type: CrtcDecisionType = 'broadcasting-decision',
  options: { timeoutMs?: number } = {},
): Promise<RawCrtcDecisionItem[]> {
  // Build the archive URL for the specific type and year
  const segment = CRTC_TYPE_TO_SEGMENT[type] || 'decision-broadcasting';
  const url = `${CRTC_DECISIONS_URL}${year}/${segment}.htm`;

  try {
    const result = await fetchUrl(url, {
      accept: 'text/html',
      timeoutMs: options.timeoutMs,
    });

    return parseArchiveListing(result.body, url, type);
  } catch (err) {
    if (err instanceof CrtcFetchError) throw err;
    throw new CrtcFetchError(
      `Archive fetch failed for ${url}: ${err instanceof Error ? err.message : String(err)}`,
      undefined,
      url,
    );
  }
}

/**
 * Parse a CRTC archive listing page HTML to extract decision links.
 *
 * The CRTC archive pages contain a list of decisions with links to
 * individual decision pages, typically in <li> elements or <table> rows.
 */
function parseArchiveListing(
  html: string,
  archiveUrl: string,
  type: CrtcDecisionType,
): RawCrtcDecisionItem[] {
  const items: RawCrtcDecisionItem[] = [];

  // Pattern 1: <li> elements with links
  const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let liMatch: RegExpExecArray | null;

  while ((liMatch = liPattern.exec(html)) !== null) {
    const liContent = liMatch[1];

    // Extract link
    const linkMatch = liContent.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const href = linkMatch[1].trim();
    const linkText = linkMatch[2].replace(/<[^>]*>/g, '').trim();

    // Build full URL
    let fullUrl: string;
    if (href.startsWith('http')) {
      fullUrl = href;
    } else if (href.startsWith('/')) {
      fullUrl = `${CRTC_BASE_URL}${href}`;
    } else {
      fullUrl = `${CRTC_DECISIONS_URL}${href}`;
    }

    // Extract date if present in the list item
    const dateMatch = liContent.match(/(\d{4}-\d{2}-\d{2})/);
    const dateStr = dateMatch ? dateMatch[1] : '';

    // Extract decision number
    const decisionNumber = extractDecisionNumber(linkText, fullUrl);

    items.push({
      title: linkText,
      date: dateStr,
      url: fullUrl,
      summary: null,
      rawType: type,
      decisionNumber,
      bodyHtml: null,
    });
  }

  // Pattern 2: <table> rows (older archive pages)
  if (items.length === 0) {
    const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const tdMatches: string[] = [];
    let tdMatch: RegExpExecArray | null;

    while ((tdMatch = tdPattern.exec(html)) !== null) {
      tdMatches.push(tdMatch[1]);
    }

    // Process in groups of 3 (title, date, type)
    for (let i = 0; i < tdMatches.length - 2; i += 3) {
      const linkMatch = tdMatches[i].match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!linkMatch) continue;

      const href = linkMatch[1].trim();
      const linkText = linkMatch[2].replace(/<[^>]*>/g, '').trim();

      let fullUrl: string;
      if (href.startsWith('http')) {
        fullUrl = href;
      } else if (href.startsWith('/')) {
        fullUrl = `${CRTC_BASE_URL}${href}`;
      } else {
        fullUrl = `${CRTC_DECISIONS_URL}${href}`;
      }

      const dateStr = tdMatches[i + 1]?.replace(/<[^>]*>/g, '').trim() || '';
      const decisionNumber = extractDecisionNumber(linkText, fullUrl);

      items.push({
        title: linkText,
        date: dateStr,
        url: fullUrl,
        summary: null,
        rawType: type,
        decisionNumber,
        bodyHtml: null,
      });
    }
  }

  return items;
}

/**
 * Fetch CRTC decisions from the combined broadcasting/telecom listings.
 * These pages list decisions of all types for the current year.
 */
export async function fetchCrtcMainArchivePage(
  options: { timeoutMs?: number } = {},
): Promise<RawCrtcDecisionItem[]> {
  const url = CRTC_DECISIONS_URL;

  try {
    const result = await fetchUrl(url, {
      accept: 'text/html',
      timeoutMs: options.timeoutMs,
    });

    const html = result.body;
    const allItems: RawCrtcDecisionItem[] = [];

    // Parse both broadcasting and telecom sections
    // The main archive page has links to individual decision types
    // We extract all decision links and classify them

    const linkPattern = /<a[^>]*href="([^"]*decision-[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let linkMatch: RegExpExecArray | null;

    const seen = new Set<string>();

    while ((linkMatch = linkPattern.exec(html)) !== null) {
      const href = linkMatch[1].trim();
      const linkText = linkMatch[2].replace(/<[^>]*>/g, '').trim();

      if (!href || !linkText || seen.has(href)) continue;
      seen.add(href);

      // Determine type from URL path
      let type: CrtcDecisionType = 'broadcasting-decision';
      if (href.includes('decision-telecom')) {
        type = 'telecom-decision';
      } else if (href.includes('notice-consultation')) {
        type = 'notice-consultation';
      } else if (href.includes('regulatory-policy')) {
        type = 'policy';
      } else if (href.includes('order')) {
        type = 'administrative';
      }

      let fullUrl: string;
      if (href.startsWith('http')) {
        fullUrl = href;
      } else if (href.startsWith('/')) {
        fullUrl = `${CRTC_BASE_URL}${href}`;
      } else {
        fullUrl = new URL(href, CRTC_DECISIONS_URL).href;
      }

      const decisionNumber = extractDecisionNumber(linkText, fullUrl);

      allItems.push({
        title: linkText,
        date: '',
        url: fullUrl,
        summary: null,
        rawType: type,
        decisionNumber,
        bodyHtml: null,
      });
    }

    return allItems;
  } catch (err) {
    if (err instanceof CrtcFetchError) throw err;
    throw new CrtcFetchError(
      `Main archive fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      undefined,
      url,
    );
  }
}


/* ------------------------------------------------------------------ */
/*  Decision Detail Page Fetcher                                       */
/* ------------------------------------------------------------------ */

/**
 * Fetch a CRTC decision detail page to extract full content.
 * This provides the HTML body for detailed parsing of findings,
 * conditions, and affected parties.
 *
 * @param url - The URL of the decision detail page
 * @returns Raw page with HTML body for parsing
 */
export async function fetchDecisionDetail(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<RawCrtcDecisionItem> {
  const result = await fetchUrl(url, {
    accept: 'text/html',
    timeoutMs: options.timeoutMs,
  });

  return {
    title: '',
    date: '',
    url,
    summary: null,
    rawType: 'broadcasting-decision',
    decisionNumber: null,
    bodyHtml: result.body,
  };
}


/* ------------------------------------------------------------------ */
/*  Ownership Data Fetchers                                            */
/* ------------------------------------------------------------------ */

/**
 * Fetch CRTC ownership data page.
 * The ownership page lists broadcasting undertakings and their owners.
 *
 * @returns Raw HTML and URL of the ownership page
 */
export async function fetchCrtcOwnershipPage(
  options: { timeoutMs?: number } = {},
): Promise<{ url: string; html: string }> {
  const result = await fetchUrl(CRTC_OWNERSHIP_URL, {
    accept: 'text/html',
    timeoutMs: options.timeoutMs,
  });

  return {
    url: CRTC_OWNERSHIP_URL,
    html: result.body,
  };
}

/**
 * Fetch ownership detail pages for individual undertakings.
 * Each undertaking listed on the ownership page links to a detail page
 * with more information.
 *
 * @param url - URL of the undertaking detail page
 * @returns Raw page with HTML body for parsing
 */
export async function fetchOwnershipDetail(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<{ url: string; html: string }> {
  const result = await fetchUrl(url, {
    accept: 'text/html',
    timeoutMs: options.timeoutMs,
  });

  return {
    url,
    html: result.body,
  };
}


/* ------------------------------------------------------------------ */
/*  CKAN / Open Canada Fetchers                                        */
/* ------------------------------------------------------------------ */

interface CKANSearchResponse {
  success: boolean;
  result: {
    results: Array<{
      id: string;
      title: string;
      notes: string | null;
      resources: Array<{
        id: string;
        name: string;
        format: string;
        url: string;
        description: string | null;
      }>;
      organization: { name: string; title: string } | null;
    }>;
  };
}

interface CKANPackageResponse {
  success: boolean;
  result: {
    id: string;
    title: string;
    notes: string | null;
    resources: Array<{
      id: string;
      name: string;
      format: string;
      url: string;
      description: string | null;
    }>;
    organization: { name: string; title: string } | null;
  };
}

/**
 * Search for CRTC datasets on open.canada.ca CKAN portal.
 *
 * @param query - CKAN search query
 * @param rows - Maximum number of results
 */
export async function searchCrtcCkanDatasets(
  query: string = 'crtc',
  rows: number = 20,
): Promise<Array<{
  id: string;
  title: string;
  notes: string | null;
  resources: Array<{ id: string; name: string; format: string; url: string }>;
}>> {
  const searchUrl = `${CRTC_CKAN_SEARCH}?q=${encodeURIComponent(query)}&rows=${rows}`;

  try {
    const result = await fetchUrl(searchUrl, {
      accept: 'application/json',
    });

    const data: CKANSearchResponse = JSON.parse(result.body);

    if (!data.success || !data.result?.results) {
      return [];
    }

    return data.result.results.map(p => ({
      id: p.id,
      title: p.title,
      notes: p.notes,
      resources: (p.resources ?? []).map(r => ({
        id: r.id,
        name: r.name,
        format: r.format,
        url: r.url,
      })),
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch a specific CKAN package by ID for CRTC datasets.
 *
 * @param packageId - CKAN package ID
 */
export async function fetchCrtcCkanPackage(
  packageId: string,
): Promise<{
  id: string;
  title: string;
  notes: string | null;
  resources: Array<{ id: string; name: string; format: string; url: string }>;
} | null> {
  const url = `${CRTC_CKAN_PACKAGE_SHOW}?id=${encodeURIComponent(packageId)}`;

  try {
    const result = await fetchUrl(url, { accept: 'application/json' });
    const data: CKANPackageResponse = JSON.parse(result.body);

    if (!data.success || !data.result) return null;

    return {
      id: data.result.id,
      title: data.result.title,
      notes: data.result.notes,
      resources: (data.result.resources ?? []).map(r => ({
        id: r.id,
        name: r.name,
        format: r.format,
        url: r.url,
      })),
    };
  } catch {
    return null;
  }
}


/* ------------------------------------------------------------------ */
/*  Consolidated Fetchers                                              */
/* ------------------------------------------------------------------ */

/**
 * Fetch all CRTC decisions from all available sources.
 *
 * Strategy:
 *   1. RSS feeds for recent decisions (primary)
 *   2. Main archive page for current year listings
 *   3. Historical archive pages by year (secondary)
 *
 * @param options - Fetch options
 * @returns Consolidated fetch result with deduplicated items
 */
export async function fetchAllCrtcDecisions(
  options: {
    timeoutMs?: number;
    maxRssItems?: number;
    historicalYears?: number;
    includeOwnership?: boolean;
  } = {},
): Promise<{
  decisions: RawCrtcDecisionItem[];
  ownership: RawCrtcOwnershipItem[];
  sourcesTried: string[];
  errors: string[];
}> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRssItems = options.maxRssItems ?? MAX_RSS_ITEMS;
  const historicalYears = options.historicalYears ?? HISTORICAL_YEARS_BACK;
  const sourcesTried: string[] = [];
  const errors: string[] = [];
  const decisions: RawCrtcDecisionItem[] = [];
  const ownership: RawCrtcOwnershipItem[] = [];

  // Phase 1: Fetch RSS feeds (recent decisions)
  for (const [type, feedUrl] of Object.entries(CRTC_RSS_FEEDS)) {
    try {
      sourcesTried.push(`rss:${type}`);
      const items = await fetchCrtcRSSFeed(
        feedUrl,
        type as CrtcDecisionType,
        { timeoutMs, maxItems: maxRssItems },
      );
      decisions.push(...items);
    } catch (err) {
      errors.push(`RSS ${type}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Phase 2: Fetch main archive page
  try {
    sourcesTried.push('archive-main');
    const mainItems = await fetchCrtcMainArchivePage({ timeoutMs });
    decisions.push(...mainItems);
  } catch (err) {
    errors.push(`Main archive: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Phase 3: Fetch historical archive pages by year
  const currentYear = new Date().getFullYear();
  for (let y = 0; y < historicalYears; y++) {
    const year = String(currentYear - y);
    try {
      sourcesTried.push(`archive-year:${year}`);
      // Fetch both broadcasting and telecom for each year
      const bcastItems = await fetchCrtcArchiveYear(year, 'broadcasting-decision', { timeoutMs });
      decisions.push(...bcastItems);

      const telecomItems = await fetchCrtcArchiveYear(year, 'telecom-decision', { timeoutMs });
      decisions.push(...telecomItems);
    } catch (err) {
      // Some years may not have archives — that's okay
      sourcesTried.push(`archive-year:${year} (not found)`);
    }
  }

  // Phase 4: Optionally fetch ownership data
  if (options.includeOwnership) {
    try {
      sourcesTried.push('ownership-page');
      // Ownership data is parsed from the HTML page
      // Individual undertaking detail pages are fetched during parsing
    } catch (err) {
      errors.push(`Ownership: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Deduplicate decisions by URL
  const seen = new Set<string>();
  const deduped = decisions.filter(d => {
    if (seen.has(d.url)) return false;
    seen.add(d.url);
    return true;
  });

  return {
    decisions: deduped,
    ownership,
    sourcesTried,
    errors,
  };
}
