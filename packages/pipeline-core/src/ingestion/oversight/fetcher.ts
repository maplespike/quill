// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Oversight Bodies Fetcher — Quill
 *
 * HTTP fetchers for Canada's independent oversight bodies.
 * Each body gets its own fetch{Body}Reports() function, sharing common
 * fetch infrastructure.
 *
 * Strategy:
 *   1. Try RSS feed first (where available)
 *   2. Try JSON API endpoint
 *   3. Fall back to scraping HTML publication listing
 *
 * Uses undici for cross-platform HTTP (Node, Workers, Bun).
 */

import { httpGet } from '../../utils/http.js';
import {
  OAG_RSS_URL,
  OAG_REPORTS_URL,
  OAG_JSON_API_URL,
  PBO_BASE_URL,
  PBO_PUBLICATIONS_URL,
  PBO_API_URL,
  CIEC_BASE_URL,
  CIEC_INVESTIGATIONS_URL,
  OCL_BASE_URL,
  OCL_INVESTIGATIONS_URL,
  ciecInvestigationUrl,
  oclInvestigationUrl,
  CB_BASE_URL,
  CB_MERGERS_URL,
  CB_ENFORCEMENT_URL,
  CB_CONSULTATIONS_URL,
  CB_RSS_URL,
  CB_BULLETINS_URL,
  CRTC_BASE_URL,
  CRTC_DECISIONS_URL,
  CRTC_BROADCASTING_DECISIONS_URL,
  CRTC_TELECOM_DECISIONS_URL,
  CRTC_BROADCASTING_RSS_URL,
  CRTC_TELECOM_RSS_URL,
  CRTC_CONSULTATION_RSS_URL,
  CRTC_OWNERSHIP_URL,
} from './constants.js';
import type {
  RawOAGItem,
  RawPBOItem,
  RawEthicsItem,
  RawLobbyingItem,
  RawCompetitionBureauItem,
  RawCRTCItem,
} from './types.js';


export class OversightFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
    public readonly body?: string,
  ) {
    super(message);
    this.name = 'OversightFetchError';
  }
}


const DEFAULT_HEADERS = {
  'User-Agent': 'Quill/0.1 (civic-tech; mailto:hello@maplespike.ca)',
  Accept: 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8',
} as const;

/**
 * Fetch raw text from a URL.
 */
export async function fetchUrl(
  url: string,
  options: { timeoutMs?: number; accept?: string } = {},
): Promise<{ statusCode: number; body: string; headers: Record<string, string> }> {
  const reqHeaders: Record<string, string> = { ...DEFAULT_HEADERS };
  if (options.accept) {
    reqHeaders.Accept = options.accept;
  }

  const resp = await httpGet(url, {
    headers: reqHeaders,
    timeoutMs: options.timeoutMs ?? 30_000,
  });

  if (resp.statusCode >= 400) {
    throw new OversightFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
      resp.body.substring(0, 500),
    );
  }

  return { statusCode: resp.statusCode, body: resp.body, headers: resp.headers };
}


export interface RSSChannelItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  category?: string;
  guid?: string;
}

/**
 * Fetch and parse an RSS feed into channel items.
 * Returns null if the feed is not available or not valid XML.
 */
export async function fetchRSSFeed(url: string): Promise<RSSChannelItem[] | null> {
  try {
    const result = await fetchUrl(url, {
      accept: 'application/rss+xml, application/xml, text/xml',
    });

    const body = result.body;

    // Simple regex-based RSS item extraction (works for most Gov RSS feeds)
    const items: RSSChannelItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(body)) !== null) {
      const itemXml = match[1];
      const title = extractTag(itemXml, 'title');
      const link = extractTag(itemXml, 'link');
      const description = extractTag(itemXml, 'description');
      const pubDate = extractTag(itemXml, 'pubDate');
      const category = extractTag(itemXml, 'category');
      const guid = extractTag(itemXml, 'guid');

      if (title && link) {
        items.push({
          title: decodeHtmlEntities(title),
          link: link.trim(),
          description: description ? decodeHtmlEntities(description) : '',
          pubDate: pubDate || '',
          category: category || undefined,
          guid: guid || undefined,
        });
      }
    }

    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}


/**
 * Fetch OAG reports.
 *
 * Strategy:
 *   1. Try RSS feed at OAG_RSS_URL (may 404 since migration to Canada.ca)
 *   2. Try Canada.ca JSON:API endpoint for structured data
 *   3. Fall back to scraping the Canada.ca report listing HTML
 */
export async function fetchOAGReports(
  options: { timeoutMs?: number } = {},
): Promise<RawOAGItem[]> {
  // Strategy 1: Try RSS feed
  const rssItems = await fetchRSSFeed(OAG_RSS_URL);
  if (rssItems && rssItems.length > 0) {
    return rssItems.map(item => ({
      title: item.title,
      date: parseRSSDate(item.pubDate),
      url: item.link,
      reportType: classifyOAGReportType(item.title, item.category),
      summary: item.description,
      pdfUrl: null,
      fiscalYear: extractFiscalYear(item.title),
      auditedEntities: extractOAGEntities(item.title, item.description),
    }));
  }

  // Strategy 2: Try JSON API
  try {
    const jsonItems = await fetchOAGJsonApi(options);
    if (jsonItems && jsonItems.length > 0) {
      return jsonItems;
    }
  } catch {
    // Fall through to HTML scraping
  }

  // Strategy 3: Scrape Canada.ca listing page
  return fetchOAGFromHtml(options);
}

/**
 * Fetch OAG reports from Canada.ca JSON:API endpoint.
 */
async function fetchOAGJsonApi(
  options: { timeoutMs?: number } = {},
): Promise<RawOAGItem[] | null> {
  try {
    const result = await fetchUrl(OAG_JSON_API_URL, {
      accept: 'application/json',
      ...options,
    });

    const data = JSON.parse(result.body);

    // Canada.ca Drupal JSON:API structure varies by endpoint
    if (Array.isArray(data)) {
      return data.map(mapDrupalOAGItem);
    }
    if (data.data && Array.isArray(data.data)) {
      return data.data.map(mapDrupalOAGItem);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Scrape OAG reports from the Canada.ca HTML listing page.
 * Canada.ca Drupal listing pages use a specific HTML structure
 * with <div class="row"> containing report entries.
 */
async function fetchOAGFromHtml(
  options: { timeoutMs?: number } = {},
): Promise<RawOAGItem[]> {
  const result = await fetchUrl(OAG_REPORTS_URL, options);
  const html = result.body;
  const items: RawOAGItem[] = [];

  // Canada.ca listing pattern: each report is typically in a
  // <section> or <div> with a heading and date
  // Try several common patterns used by Canada.ca Drupal themes

  // Pattern 1: h3 + date + description blocks
  const blockPattern = /<h3[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/gi;
  const datePattern = /<time[^>]*datetime="([^"]+)"[^>]*>/gi;
  const descPattern = /<p[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/p>/gi;

  let blockMatch: RegExpExecArray | null;
  const links: Array<{ url: string; title: string }> = [];
  while ((blockMatch = blockPattern.exec(html)) !== null) {
    links.push({
      url: blockMatch[1].startsWith('http') ? blockMatch[1] : `https://www.canada.ca${blockMatch[1]}`,
      title: blockMatch[2].replace(/<[^>]*>/g, '').trim(),
    });
  }

  // Collect dates
  const dates: string[] = [];
  let dateMatch: RegExpExecArray | null;
  while ((dateMatch = datePattern.exec(html)) !== null) {
    dates.push(dateMatch[1]);
  }

  // Collect descriptions
  const descriptions: string[] = [];
  let descMatch: RegExpExecArray | null;
  while ((descMatch = descPattern.exec(html)) !== null) {
    descriptions.push(descMatch[1].replace(/<[^>]*>/g, '').trim());
  }

  for (let i = 0; i < links.length; i++) {
    const title = links[i].title;
    items.push({
      title,
      date: dates[i] || '',
      url: links[i].url,
      reportType: classifyOAGReportType(title, ''),
      summary: descriptions[i] || null,
      pdfUrl: null,
      fiscalYear: extractFiscalYear(title),
      auditedEntities: extractOAGEntities(title, descriptions[i] || ''),
    });
  }

  return items;
}


/**
 * Fetch PBO publications.
 *
 * Strategy:
 *   1. Try the CMS API endpoint
 *   2. Fall back to scraping the rendered HTML publications list
 */
export async function fetchPBOReports(
  options: { timeoutMs?: number; maxPages?: number } = {},
): Promise<RawPBOItem[]> {
  const maxPages = options.maxPages ?? 5;

  // Strategy 1: Try API
  try {
    const apiItems = await fetchPBOFromApi(maxPages, options);
    if (apiItems && apiItems.length > 0) {
      return apiItems;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/HTML instead of JSON|JSON host moved/.test(message)) {
      throw err;
    }
    // A transport error falls through to the HTML listing.
  }

  // Strategy 2: Scrape HTML
  return fetchPBOFromHtml(maxPages, options);
}

/**
 * Fetch PBO publications from the CMS API.
 * The PBO site uses a Strapi-based CMS with a JSON API endpoint.
 */
async function fetchPBOFromApi(
  maxPages: number,
  options: { timeoutMs?: number } = {},
): Promise<RawPBOItem[] | null> {
  const allItems: RawPBOItem[] = [];

  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = page === 1 ? PBO_API_URL : `${PBO_API_URL}?page=${page}`;
      const result = await fetchUrl(url, {
        accept: 'application/json',
        ...options,
      });

      if (result.body.trimStart().startsWith('<')) {
        throw new Error(
          `PBO publications API at ${url} returned HTML instead of JSON — the JSON host moved`,
        );
      }

      const data = JSON.parse(result.body);

      // Handle various API response shapes
      const items = extractPBOApiItems(data);
      if (!items || items.length === 0) break;

      allItems.push(...items);
    } catch {
      break;
    }
  }

  return allItems.length > 0 ? allItems : null;
}

/**
 * Extract PBO items from API response, handling various shapes.
 */
export function extractPBOApiItems(data: any): RawPBOItem[] | null {
  if (!data) return null;

  let items: any[] | null = null;

  // Strapi v4 shape: { data: [...] }
  if (data.data && Array.isArray(data.data)) {
    items = data.data;
  }
  // Direct array
  else if (Array.isArray(data)) {
    items = data;
  }
  // Nested in results
  else if (data.results && Array.isArray(data.results)) {
    items = data.results;
  }

  if (!items) return null;

  return items.flatMap((item: any) => {
    const attrs = item.attributes || item;
    const permalink = attrs.permalinks?.en?.website;
    const explicit = attrs.url || attrs.Url || '';
    const slug = typeof attrs.slug === 'string' && attrs.slug.length > 0
      ? `https://www.pbo-dpb.ca/en/publications/${attrs.slug}`
      : '';
    const title = attrs.title_en || attrs.title || attrs.Title || attrs.title_fr || '';
    if (!title) return [];
    const pdf = attrs.artifacts?.main?.en?.public
      || attrs.pdfUrl
      || attrs.pdf
      || attrs.file?.url
      || null;
    return [{
      title,
      date: attrs.release_date || attrs.date || attrs.Date || attrs.publishedAt || '',
      url: permalink || explicit || slug,
      type: attrs.type || attrs.Type || attrs.publicationType || 'Report',
      summary: attrs.metadata?.abstract_en || attrs.summary || attrs.Summary || attrs.description || '',
      pdfUrl: pdf,
      reportNumber: attrs.id != null
        ? String(attrs.id)
        : (attrs.reportNumber || attrs.ReportNumber || null),
    }];
  });
}

/**
 * Scrape PBO publications from rendered HTML.
 * The Nuxt.js frontend renders publications in a list with
 * structured cards containing title, date, type, description.
 */
async function fetchPBOFromHtml(
  maxPages: number,
  options: { timeoutMs?: number } = {},
): Promise<RawPBOItem[]> {
  const allItems: RawPBOItem[] = [];

  for (let page = 1; page <= maxPages; page++) {
    try {
      const pageUrl = page === 1
        ? PBO_PUBLICATIONS_URL
        : `${PBO_PUBLICATIONS_URL}?page=${page}`;

      const result = await fetchUrl(pageUrl, options);
      const html = result.body;
      const items = parsePBOHtmlPage(html);

      if (items.length === 0) break;
      allItems.push(...items);
    } catch {
      break;
    }
  }

  return allItems;
}

/**
 * Parse a single page of PBO publication HTML.
 * The publications are rendered as cards with h2 headings, dates, and descriptions.
 */
function parsePBOHtmlPage(html: string): RawPBOItem[] {
  const items: RawPBOItem[] = [];

  // Each publication card: find divs containing publication data
  // The PBO renders publications as article cards with structured classes

  // Pattern: look for links with href containing "/en/publications/"
  const pubLinkPattern = /<a[^>]*href="(\/en\/publications\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const pubLinks: Array<{ url: string; title: string }> = [];

  let match: RegExpExecArray | null;
  while ((match = pubLinkPattern.exec(html)) !== null) {
    const title = match[2].replace(/<[^>]*>/g, '').trim();
    if (title && title.length > 0 && title.length < 300) {
      pubLinks.push({
        url: `https://www.pbo-dpb.ca${match[1]}`,
        title,
      });
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const uniqueLinks = pubLinks.filter(l => {
    if (seen.has(l.url)) return false;
    seen.add(l.url);
    return true;
  });

  // Extract dates (appear as text near the publication cards)
  const dateMatches = html.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/g) || [];

  // Extract types (appear before dates)
  const typeMatches = html.match(/(?:Report|Note|Legislative Costing Note|Cost Estimate|Research Report|Media Release|Opening Statement)/g) || [];

  for (let i = 0; i < uniqueLinks.length; i++) {
    const link = uniqueLinks[i];
    const title = link.title;

    // Extract the type from the publication card context
    // The PBO page shows the type as a small label before the title
    const typeFromLink = typeMatches.find((t, idx) => {
      // Simple heuristic: match type that appears near this link in order
      return idx < uniqueLinks.length;
    }) || 'Report';

    // Find the closest date after this link's position
    const dateStr = dateMatches[i] || '';

    // Find the description (text between this card and the next)
    const desc = ''; // Descriptions are harder to extract from SSR HTML

    items.push({
      title,
      date: dateStr,
      url: link.url,
      type: typeFromLink,
      summary: desc,
      pdfUrl: null,
      reportNumber: extractPBOSlug(link.url),
    });
  }

  return items;
}


/**
 * Extract the content of an XML tag.
 */
function extractTag(xml: string, tag: string): string | null {
  // Try CDATA first
  const cdataMatch = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'));
  if (cdataMatch) return cdataMatch[1].trim();

  // Try regular content
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (match) return match[1].trim();

  // Self-closing
  const selfMatch = xml.match(new RegExp(`<${tag}[^>]*\\/>`, 'i'));
  if (selfMatch) return '';

  return null;
}

/**
 * Decode HTML entities.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_m: string, n: string) => String.fromCharCode(parseInt(n, 10)));
}

/**
 * Parse an RSS date string to ISO-8601.
 */
function parseRSSDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
}

/**
 * Classify OAG report type from title and/or category.
 */
function classifyOAGReportType(title: string, category?: string): string {
  const lower = title.toLowerCase();

  if (category && OAG_CATEGORY_MAP[category.toLowerCase()]) {
    return OAG_CATEGORY_MAP[category.toLowerCase()];
  }

  if (lower.includes('performance audit') || lower.includes('performance')) return 'performance-audit';
  if (lower.includes('special examination') || lower.includes('special exam')) return 'special-examination';
  if (lower.includes('environment') || lower.includes('sustainable development') || lower.includes('commissioner of the environment')) return 'environmental-audit';
  if (lower.includes('annual report')) return 'annual-report';
  if (lower.includes('corporate') || lower.includes('departmental plan')) return 'corporate-report';
  if (lower.includes('media') || lower.includes('news release')) return 'media-release';
  if (lower.includes('opening statement')) return 'opening-statement';

  return 'performance-audit';
}

const OAG_CATEGORY_MAP: Record<string, string> = {
  'performance audits': 'performance-audit',
  'special examinations': 'special-examination',
  'environmental audits': 'environmental-audit',
  'commissioner of the environment and sustainable development': 'environmental-audit',
  'annual reports': 'annual-report',
  'corporate reports': 'corporate-report',
};

/**
 * Extract fiscal year from OAG report title.
 * OAG reports are typically named "...—Fall 2025" or "...—Spring 2025"
 * and relate to a fiscal year like "2025" or "2025-2026".
 */
function extractFiscalYear(title: string): string | null {
  const yearMatch = title.match(/(?:Spring|Fall|Winter|Summer)\s+(\d{4})/i);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    // Fall reports are usually about the fiscal year starting that April
    if (title.match(/Fall/i)) {
      return `${year - 1}-${year}`;
    }
    return `${year}-${year + 1}`;
  }

  const yearRange = title.match(/(\d{4})[-–](\d{4})/);
  if (yearRange) {
    return yearRange[0];
  }

  return null;
}

/**
 * Extract audited entities from OAG report title and description.
 * Performance audit titles typically include the department name.
 */
function extractOAGEntities(title: string, description: string): string[] {
  const combined = `${title} ${description}`;
  const entities: string[] = [];

  // Common department/agency patterns in OAG reports
  const pattern = /\b(?:Department of|Canada|Service|Agency|Board|Commission|Corporation|Office of the)\s+[\w\s&]+?(?=\s*[-–—]|\s*\d{4}|\s*\(|\s*$)/gi;
  const matches = combined.match(pattern);

  if (matches) {
    for (const m of matches) {
      const trimmed = m.trim();
      if (trimmed.length > 5 && !entities.includes(trimmed)) {
        entities.push(trimmed);
      }
    }
  }

  return entities;
}

/**
 * Extract a slug/identifier from a PBO publication URL.
 * PBO URLs end with a descriptive slug after the publication ID.
 */
function extractPBOSlug(url: string): string | null {
  const match = url.match(/\/publications\/([^/]+)$/);
  return match ? match[1] : null;
}

/**
 * Map a Canada.ca Drupal JSON:API item to RawOAGItem.
 */
function mapDrupalOAGItem(item: any): RawOAGItem {
  const attrs = item.attributes || item;
  return {
    title: attrs.title || '',
    date: attrs.date || attrs.field_date || attrs.publication_date || '',
    url: attrs.url || attrs.path?.alias
      ? `https://www.canada.ca${attrs.path.alias}`
      : '',
    reportType: classifyOAGReportType(attrs.title || '', attrs.field_report_type || attrs.category || ''),
    summary: attrs.summary || attrs.field_summary || attrs.description || '',
    pdfUrl: attrs.field_pdf?.url || attrs.pdf_url || null,
    fiscalYear: attrs.field_fiscal_year || extractFiscalYear(attrs.title || ''),
    auditedEntities: attrs.field_departments
      ? (Array.isArray(attrs.field_departments) ? attrs.field_departments : [attrs.field_departments])
      : extractOAGEntities(attrs.title || '', attrs.summary || ''),
  };
}


/**
 * Fetch Competition Bureau news releases and decisions.
 *
 * Strategy:
 *   1. Try RSS feed first (CB_RSS_URL)
 *   2. Fall back to scraping HTML listing pages for merger reviews,
 *      enforcement actions, and consultations.
 */
export async function fetchCompetitionBureauDecisions(
  options: { timeoutMs?: number; maxPages?: number } = {},
): Promise<RawCompetitionBureauItem[]> {
  const allItems: RawCompetitionBureauItem[] = [];

  // Strategy 1: Try RSS feed
  try {
    const rssItems = await fetchRSSFeed(CB_RSS_URL);
    if (rssItems && rssItems.length > 0) {
      for (const item of rssItems) {
        allItems.push({
          title: item.title,
          date: parseRSSDate(item.pubDate),
          url: item.link,
          summary: item.description || null,
          body: 'CompetitionBureau',
          cbType: classifyCBType(item.title, item.description),
          companies: extractCBCompanies(item.title, item.description),
          sectors: extractCBSectors(item.title, item.description),
        });
      }
      return allItems;
    }
  } catch {
    // Fall through to HTML scraping
  }

  // Strategy 2: Scrape enforcement actions page
  try {
    const enforcementItems = await fetchCBFromHtml(CB_ENFORCEMENT_URL, 'enforcement-action', options);
    allItems.push(...enforcementItems);
  } catch {
    // Non-fatal — may have subpages that work
  }

  // Strategy 3: Scrape mergers page
  try {
    const mergerItems = await fetchCBFromHtml(CB_MERGERS_URL, 'merger-review', options);
    allItems.push(...mergerItems);
  } catch {
    // Non-fatal
  }

  return allItems;
}

/**
 * Fetch Competition Bureau merger reviews specifically.
 * These are the key source for tracking corporate consolidation.
 */
export async function fetchCompetitionBureauMergers(
  options: { timeoutMs?: number; maxPages?: number } = {},
): Promise<RawCompetitionBureauItem[]> {
  try {
    // Try RSS first
    const rssItems = await fetchRSSFeed(CB_RSS_URL);
    if (rssItems && rssItems.length > 0) {
      return rssItems
        .filter(item => isMergerRelated(item.title, item.description))
        .map(item => ({
          title: item.title,
          date: parseRSSDate(item.pubDate),
          url: item.link,
          summary: item.description || null,
          body: 'CompetitionBureau' as const,
          cbType: 'merger-review',
          companies: extractCBCompanies(item.title, item.description),
          sectors: extractCBSectors(item.title, item.description),
        }));
    }
  } catch {
    // Fall through
  }

  // Fall back to scraping the mergers page
  return fetchCBFromHtml(CB_MERGERS_URL, 'merger-review', options);
}

/**
 * Scrape Competition Bureau HTML listing pages.
 * The Bureau's WET (Web Experience Toolkit) pages follow a consistent pattern
 * with <section> elements containing <h2>/<h3> headings, dates, and descriptions.
 */
async function fetchCBFromHtml(
  url: string,
  type: string,
  options: { timeoutMs?: number } = {},
): Promise<RawCompetitionBureauItem[]> {
  const result = await fetchUrl(url, options);
  const html = result.body;
  const items: RawCompetitionBureauItem[] = [];

  // WET pattern: look for link blocks with dates and descriptions
  // Pattern 1: Standard WET listing with <a> in <li> or <p>
  const linkPattern = /<a[^>]*href="([^"]*)"[^>]*class="[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

  const links: Array<{ url: string; text: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html)) !== null) {
    const text = match[2].replace(/<[^>]*>/g, '').trim();
    if (text && text.length > 5 && text.length < 300) {
      const href = match[1];
      const absoluteUrl = href.startsWith('http') ? href : `${CB_BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
      links.push({ url: absoluteUrl, text });
    }
  }

  // Extract dates from the page — WET format: YYYY-MM-DD or "Month DD, YYYY"
  const dates = extractWETDates(html);

  // Deduplicate links
  const seen = new Set<string>();
  const uniqueLinks = links.filter(l => {
    if (seen.has(l.url)) return false;
    seen.add(l.url);
    return true;
  });

  for (let i = 0; i < uniqueLinks.length; i++) {
    const link = uniqueLinks[i];
    items.push({
      title: link.text,
      date: dates[i] || '',
      url: link.url,
      summary: null,
      body: 'CompetitionBureau',
      cbType: type,
      companies: extractCBCompanies(link.text, ''),
      sectors: extractCBSectors(link.text, ''),
    });
  }

  return items;
}

/**
 * Extract dates from WET (Web Experience Toolkit) HTML pages.
 * WET pages commonly use <time> tags or specific date classes.
 */
function extractWETDates(html: string): string[] {
  const dates: string[] = [];

  // Try <time datetime="..."> pattern
  const timePattern = /<time[^>]*datetime="([^"]+)"[^>]*>/gi;
  let timeMatch: RegExpExecArray | null;
  while ((timeMatch = timePattern.exec(html)) !== null) {
    dates.push(timeMatch[1].substring(0, 10));
  }

  if (dates.length > 0) return dates;

  // Try date class pattern: class="date" or class="published"
  const dateClassPattern = /<[^>]*class="[^"]*\b(?:date|published|dt-published)\b[^"]*"[^>]*>\s*([\d]{4}[-\/][\d]{2}[-\/][\d]{2}|[A-Z][a-z]+ \d{1,2},? \d{4})\s*<\/[^>]+>/gi;
  let dcMatch: RegExpExecArray | null;
  while ((dcMatch = dateClassPattern.exec(html)) !== null) {
    dates.push(dcMatch[1].trim());
  }

  return dates;
}

/**
 * Classify a Competition Bureau item by type based on its title/description.
 */
function classifyCBType(title: string, description: string): string {
  const combined = `${title} ${description}`.toLowerCase();

  if (combined.includes('merger') && (combined.includes('review') || combined.includes('clear') || combined.includes('challenge') || combined.includes('consent')))
    return 'merger-review';
  if (combined.includes('enforcement') || combined.includes('investigation') || combined.includes('tribunal') || combined.includes('court'))
    return 'enforcement-action';
  if (combined.includes('consultation') || combined.includes('proposed') || combined.includes('comment'))
    return 'consultation';
  if (combined.includes('bulletin') || combined.includes('guideline') || combined.includes('interpretation'))
    return 'bulletin';
  if (combined.includes('annual report') || combined.includes('corporate plan'))
    return 'annual-report';
  if (combined.includes('market study') || combined.includes('market landscape'))
    return 'market-study';

  return 'enforcement-action';
}

/**
 * Check if an RSS item is merger-related.
 */
function isMergerRelated(title: string, description: string): boolean {
  const combined = `${title} ${description}`.toLowerCase();
  return combined.includes('merger') ||
    combined.includes('acquisition') ||
    combined.includes('takeover') ||
    combined.includes('consolidation') ||
    combined.includes('arrangement');
}

/**
 * Extract company names from Competition Bureau text.
 * Company names typically appear in merger review titles or descriptions
 * as "Company A / Company B" or "Company A and Company B".
 */
function extractCBCompanies(title: string, description: string): string[] {
  const combined = `${title} ${description}`;
  const companies: string[] = [];

  // Pattern: "Company A Inc. / Company B Ltd." or "Company A Inc. and Company B Ltd."
  const companyPattern = /([A-Z][A-Za-z0-9&.\s]+(?:Inc|Ltd|Limited|Corp|Corporation|LP|LLP|LGP|S\.E\.C\.))(?:\s*[\/,]\s*|\s+and\s+)([A-Z][A-Za-z0-9&.\s]+(?:Inc|Ltd|Limited|Corp|Corporation|LP|LLP|LGP|S\.E\.C\.))/g;
  let match: RegExpExecArray | null;
  while ((match = companyPattern.exec(combined)) !== null) {
    if (!companies.includes(match[1].trim())) companies.push(match[1].trim());
    if (!companies.includes(match[2].trim())) companies.push(match[2].trim());
  }

  // If no match, try simpler: extract capitalized entities
  if (companies.length === 0) {
    const simplePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Inc\.|Ltd\.|Corp\.|Limited|Corporation)\b/g;
    let simpleMatch: RegExpExecArray | null;
    while ((simpleMatch = simplePattern.exec(combined)) !== null) {
      const name = `${simpleMatch[1]} ${simpleMatch[2]}`;
      if (!companies.includes(name)) companies.push(name);
    }
  }

  return companies;
}

/**
 * Extract industry sectors from Competition Bureau text.
 */
function extractCBSectors(title: string, description: string): string[] {
  const combined = `${title} ${description}`.toLowerCase();
  const sectors: string[] = [];

  const sectorKeywords: Record<string, string[]> = {
    'telecommunications': ['telecom', 'telephone', 'wireless', 'broadband', 'internet', 'cable'],
    'media': ['media', 'broadcasting', 'television', 'radio', 'newspaper', 'publishing', 'journalism'],
    'banking': ['bank', 'financial', 'lending', 'credit', 'insurance', 'investment'],
    'retail': ['retail', 'grocery', 'supermarket', 'pharmacy', 'department store', 'e-commerce'],
    'energy': ['energy', 'oil', 'gas', 'petroleum', 'electricity', 'pipeline', 'mining'],
    'technology': ['tech', 'software', 'hardware', 'digital', 'semiconductor', 'cloud', 'data'],
    'healthcare': ['health', 'pharmaceutical', 'drug', 'biotech', 'hospital', 'medical'],
    'transportation': ['transport', 'airline', 'railway', 'shipping', 'logistics', 'airport'],
    'agriculture': ['agriculture', 'farm', 'grain', 'fertilizer', 'pesticide', 'food processing'],
    'manufacturing': ['manufacturing', 'industrial', 'chemical', 'steel', 'automotive', 'aerospace'],
  };

  for (const [sector, keywords] of Object.entries(sectorKeywords)) {
    for (const keyword of keywords) {
      if (combined.includes(keyword)) {
        sectors.push(sector);
        break;
      }
    }
  }

  return sectors;
}


/**
 * Fetch CRTC regulatory decisions.
 *
 * Strategy:
 *   1. Try broadcasting RSS feed
 *   2. Try telecom RSS feed
 *   3. Try consultation RSS feed
 *   4. Fall back to scraping the HTML archive pages
 */
export async function fetchCRTCDecisions(
  options: { timeoutMs?: number; maxPages?: number } = {},
): Promise<RawCRTCItem[]> {
  const allItems: RawCRTCItem[] = [];

  // Strategy 1: Try broadcasting RSS feed
  try {
    const broadcastRss = await fetchRSSFeed(CRTC_BROADCASTING_RSS_URL);
    if (broadcastRss && broadcastRss.length > 0) {
      for (const item of broadcastRss) {
        allItems.push({
          title: item.title,
          date: parseRSSDate(item.pubDate),
          url: item.link,
          summary: item.description || null,
          crtcType: classifyCRTCType(item.title, item.category || ''),
          affectedParties: extractCRTCParties(item.title, item.description),
          decisionNumber: extractCRTCDecisionNumber(item.title, item.link),
        });
      }
    }
  } catch {
    // Fall through
  }

  // Strategy 2: Try telecom RSS feed
  try {
    const telecomRss = await fetchRSSFeed(CRTC_TELECOM_RSS_URL);
    if (telecomRss && telecomRss.length > 0) {
      for (const item of telecomRss) {
        allItems.push({
          title: item.title,
          date: parseRSSDate(item.pubDate),
          url: item.link,
          summary: item.description || null,
          crtcType: classifyCRTCType(item.title, item.category || ''),
          affectedParties: extractCRTCParties(item.title, item.description),
          decisionNumber: extractCRTCDecisionNumber(item.title, item.link),
        });
      }
    }
  } catch {
    // Fall through
  }

  // Strategy 3: Try consultation RSS
  try {
    const consultRss = await fetchRSSFeed(CRTC_CONSULTATION_RSS_URL);
    if (consultRss && consultRss.length > 0) {
      for (const item of consultRss) {
        allItems.push({
          title: item.title,
          date: parseRSSDate(item.pubDate),
          url: item.link,
          summary: item.description || null,
          crtcType: 'notice-consultation',
          affectedParties: extractCRTCParties(item.title, item.description),
          decisionNumber: extractCRTCDecisionNumber(item.title, item.link),
        });
      }
    }
  } catch {
    // Fall through
  }

  if (allItems.length > 0) {
    return deduplicateCRTCItems(allItems);
  }

  // Fall back to scraping HTML archive pages
  try {
    const broadcastItems = await fetchCRTCFromHtml(CRTC_BROADCASTING_DECISIONS_URL, 'broadcasting-decision', options);
    allItems.push(...broadcastItems);
  } catch {
    // Non-fatal
  }

  try {
    const telecomItems = await fetchCRTCFromHtml(CRTC_TELECOM_DECISIONS_URL, 'telecom-decision', options);
    allItems.push(...telecomItems);
  } catch {
    // Non-fatal
  }

  return deduplicateCRTCItems(allItems);
}

/**
 * Scrape CRTC decision listings from HTML archive pages.
 * CRTC archive pages list decisions in tables with date, number, and title columns.
 */
async function fetchCRTCFromHtml(
  url: string,
  type: string,
  options: { timeoutMs?: number } = {},
): Promise<RawCRTCItem[]> {
  const result = await fetchUrl(url, options);
  const html = result.body;
  const items: RawCRTCItem[] = [];

  // CRTC archive pages typically use tables
  // Pattern: <tr><td>date</td><td>number</td><td><a href="...">title</a></td></tr>
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const row = rowMatch[1];

    // Extract cells
    const cells: string[] = [];
    const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellPattern.exec(row)) !== null) {
      cells.push(cellMatch[1].trim());
    }

    if (cells.length < 2) continue;

    // Extract link and title from the last cell (where the decision link typically is)
    const linkMatch = row.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const href = linkMatch[1];
    const title = linkMatch[2].replace(/<[^>]*>/g, '').trim();
    if (!title) continue;

    const decisionUrl = href.startsWith('http') ? href : `${CRTC_BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;

    // Date is typically in the first cell
    const dateStr = cells[0].replace(/<[^>]*>/g, '').trim();

    // Decision number is either in its own cell or extracted from the URL
    const decisionNumber = cells.length >= 2
      ? extractCRTCDecisionNumber(title, decisionUrl)
      : null;

    items.push({
      title,
      date: dateStr,
      url: decisionUrl,
      summary: null,
      crtcType: type,
      affectedParties: extractCRTCParties(title, ''),
      decisionNumber,
    });
  }

  // If no table rows found, try alternative WET listing pattern
  if (items.length === 0) {
    const altLinkPattern = /<a[^>]*href="(\/eng\/archive\/\d{4}\/[^"]+\.htm)"[^>]*>([\s\S]*?)<\/a>/gi;
    let altMatch: RegExpExecArray | null;
    while ((altMatch = altLinkPattern.exec(html)) !== null) {
      const title = altMatch[2].replace(/<[^>]*>/g, '').trim();
      if (!title) continue;

      items.push({
        title,
        date: '', // Date extraction for WET pattern requires separate parsing
        url: `${CRTC_BASE_URL}${altMatch[1]}`,
        summary: null,
        crtcType: type,
        affectedParties: extractCRTCParties(title, ''),
        decisionNumber: extractCRTCDecisionNumber(title, altMatch[1]),
      });
    }
  }

  return items;
}

/**
 * Classify a CRTC decision type based on title and source URL.
 */
function classifyCRTCType(title: string, category: string): string {
  const combined = `${title} ${category}`.toLowerCase();

  if (combined.includes('broadcasting') || combined.includes('broadcast'))
    return 'broadcasting-decision';
  if (combined.includes('telecom') || combined.includes('telecommunication'))
    return 'telecom-decision';
  if (combined.includes('ownership') || combined.includes('transfer of control') || combined.includes('acquisition'))
    return 'ownership-change';
  if (combined.includes('consultation') || combined.includes('call for comments') || combined.includes('notice of hearing'))
    return 'notice-consultation';
  if (combined.includes('policy') || combined.includes('regulatory framework'))
    return 'policy';

  return 'broadcasting-decision';
}

/**
 * Extract the CRTC decision number from title or URL.
 * CRTC decisions follow the pattern: YYYY-NNN (e.g., 2024-123)
 */
function extractCRTCDecisionNumber(title: string, url: string): string | null {
  // First try the URL pattern: /eng/archive/YYYY/YYYY-NNN.htm
  const urlMatch = url.match(/\/(\d{4})-(\d{3,4})(?:\.htm|\.html)?$/);
  if (urlMatch) {
    return `${urlMatch[1]}-${urlMatch[2]}`;
  }

  // Then try the title: "CRTC 2024-123" or "Decision 2024-123"
  const titleMatch = title.match(/(?:CRTC|Decision|Broadcasting|Telecom)\s+(?:Decision\s+)?(\d{4}-\d{3,4})/i);
  if (titleMatch) {
    return titleMatch[1];
  }

  return null;
}

/**
 * Extract company/entity names from CRTC decision text.
 * CRTC decisions reference the applicant or affected parties prominently.
 */
function extractCRTCParties(title: string, description: string): string[] {
  const combined = `${title} ${description}`;
  const parties: string[] = [];

  // Pattern: Application by [Company], [Company]'s application
  const applicationBy = combined.match(/application\s+(?:by|of|from)\s+([A-Z][A-Za-z0-9&.\s]+?(?:Inc\.|Ltd\.|Corp\.|Limited|Corporation|S\.E\.C\.|LP|Partnership|Media|Broadcasting|Communications|Telecom|Wireless))/i);
  if (applicationBy) {
    parties.push(applicationBy[1].trim());
  }

  // Pattern: [Company] (the Applicant)
  const applicantPattern = /([A-Z][A-Za-z0-9&.\s]+?(?:Inc\.|Ltd\.|Corp\.|Limited|Corporation))\s*\(the\s+Applicant\)/i;
  let appMatch: RegExpExecArray | null;
  while ((appMatch = applicantPattern.exec(combined)) !== null) {
    if (!parties.includes(appMatch[1].trim())) parties.push(appMatch[1].trim());
  }

  // Pattern: Capitalized entities followed by Inc/Ltd/Corp
  const entityPattern = /\b([A-Z][a-zA-Z&]+(?:\s+[A-Z][a-zA-Z&]+)*)\s+(?:Inc\.|Ltd\.|Corp\.|Limited|Corporation)\b/g;
  let entityMatch: RegExpExecArray | null;
  while ((entityMatch = entityPattern.exec(combined)) !== null) {
    const name = `${entityMatch[1]} ${entityMatch[2]}`;
    if (!parties.includes(name)) parties.push(name);
  }

  return parties;
}

/**
 * Deduplicate raw CRTC items by URL.
 */
function deduplicateCRTCItems(items: RawCRTCItem[]): RawCRTCItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    // Use URL as dedup key; if no URL, use title
    const key = item.url || item.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}


/**
 * Fetch Ethics Commissioner (CIEC) investigations.
 *
 * The CIEC investigates potential violations of the Conflict of Interest Act
 * by public office holders (PM, ministers, MPs, ministerial staff).
 * Investigation reports are published as HTML pages on the CIEC website.
 *
 * @param options - Fetch options
 * @returns Array of RawEthicsItem
 */
export async function fetchEthicsInvestigations(
  options: { timeoutMs?: number; maxPages?: number } = {},
): Promise<RawEthicsItem[]> {
  const maxPages = options.maxPages ?? 3;
  const allItems: RawEthicsItem[] = [];

  for (let page = 1; page <= maxPages; page++) {
    try {
      const pageUrl = page === 1
        ? CIEC_INVESTIGATIONS_URL
        : `${CIEC_INVESTIGATIONS_URL}?page=${page}`;

      const result = await fetchUrl(pageUrl, options);
      const html = result.body;
      const items = parseCIECListingHtml(html);

      if (items.length === 0) break;
      allItems.push(...items);
    } catch {
      break;
    }
  }

  // Store the listing only. The report stays on the Commissioner's site.
  // Quill keeps the title and the source link, not the full report HTML.
  return allItems;
}

/**
 * Parse CIEC investigations listing page HTML to extract investigation items.
 * CIEC listing pages typically contain a table or list with investigation titles,
 * dates, and links to the full report.
 */
export function parseCIECListingHtml(html: string): RawEthicsItem[] {
  const items: RawEthicsItem[] = [];

  // Pattern 1: SharePoint-based listing with table rows
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const rowHtml = rowMatch[1];

    // Look for an anchor with href containing "investigations"
    const linkMatch = rowHtml.match(/<a[^>]*href="([^"]*investigations[^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const url = ciecInvestigationUrl(linkMatch[1].trim());
    const title = linkMatch[2].replace(/<[^>]*>/g, '').trim();
    if (!title) continue;

    // Extract date from the row
    const dateMatch = rowHtml.match(/(\d{4})[./-](\d{2})[./-](\d{2})/);
    const dateStr = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : '';

    // Try to extract subject (name of the person investigated) from title
    const subjectMatch = title.match(/(?:Investigation into|Report on|In the matter of|Regarding)\s+(.+?)(?:$|[-–—])/i);
    const subject = subjectMatch ? subjectMatch[1].trim() : null;

    items.push({
      title,
      date: dateStr,
      url,
      bodyHtml: '',
      subject,
      outcome: null,
      parties: subject ? [subject] : [],
      reportNumber: null,
    });
  }

  // Pattern 2: Flat list of links (alternative CIEC layout)
  if (items.length === 0) {
    const linkPattern = /<a[^>]*href="([^"]*investigations\/[^"]*Pages[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let linkMatch: RegExpExecArray | null;

    while ((linkMatch = linkPattern.exec(html)) !== null) {
      const url = ciecInvestigationUrl(linkMatch[1].trim());
      const title = linkMatch[2].replace(/<[^>]*>/g, '').trim();
      if (!title) continue;

      // Look for nearby date
      const context = html.substring(Math.max(0, linkMatch.index - 200), linkMatch.index + 200);
      const dateMatch = context.match(/(\d{4})[./-](\d{2})[./-](\d{2})/);
      const dateStr = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : '';

      const subjectMatch = title.match(/(?:Investigation into|Report on|In the matter of|Regarding)\s+(.+?)(?:$|[-–—])/i);
      const subject = subjectMatch ? subjectMatch[1].trim() : null;

      items.push({
        title,
        date: dateStr,
        url,
        bodyHtml: '',
        subject,
        outcome: null,
        parties: subject ? [subject] : [],
        reportNumber: null,
      });
    }
  }

  // ethicscanada.ca lists each report as /en/report/<id> with a title.
  // The SharePoint patterns above match nothing on that page.
  const reportPattern = /<a[^>]*href="([^"]*\/en\/report\/[A-Za-z0-9_-]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let reportMatch: RegExpExecArray | null;
  const seen = new Set(items.map(item => item.url));
  while ((reportMatch = reportPattern.exec(html)) !== null) {
    const url = ciecInvestigationUrl(reportMatch[1].trim());
    if (seen.has(url)) continue;
    const title = reportMatch[2].replace(/<[^>]*>/g, '').trim();
    if (!title) continue;
    seen.add(url);
    items.push({
      title,
      date: '',
      url,
      bodyHtml: '',
      subject: null,
      outcome: null,
      parties: [],
      reportNumber: null,
    });
  }

  return items;
}


/**
 * Fetch Lobbying Commissioner (OCL) investigations.
 *
 * The OCL investigates potential violations of the Lobbying Act and
 * the Lobbyists' Code of Conduct. Investigation reports detail who
 * broke the rules, what provisions were violated, and the outcome.
 *
 * @param options - Fetch options
 * @returns Array of RawLobbyingItem
 */
export async function fetchLobbyingInvestigations(
  options: { timeoutMs?: number; maxPages?: number } = {},
): Promise<RawLobbyingItem[]> {
  const maxPages = options.maxPages ?? 3;
  const allItems: RawLobbyingItem[] = [];

  for (let page = 1; page <= maxPages; page++) {
    try {
      const pageUrl = page === 1
        ? OCL_INVESTIGATIONS_URL
        : `${OCL_INVESTIGATIONS_URL}?page=${page}`;

      const result = await fetchUrl(pageUrl, options);
      const html = result.body;
      const items = parseOCLListingHtml(html);

      if (items.length === 0) break;
      allItems.push(...items);
    } catch {
      break;
    }
  }

  // Fetch detail pages for investigation body HTML
  for (const item of allItems) {
    try {
      const detail = await fetchUrl(item.url, options);
      item.bodyHtml = detail.body;
    } catch {
      item.bodyHtml = '';
    }
  }

  return allItems;
}

/**
 * Parse OCL investigations listing page HTML to extract investigation items.
 * The Lobbying Commissioner site typically lists investigations in a structured
 * format with title, date, subject, and links to the full report.
 */
function parseOCLListingHtml(html: string): RawLobbyingItem[] {
  const items: RawLobbyingItem[] = [];

  // Pattern 1: Drupal/GCWeb listing with article cards
  const cardPattern = /<article[^>]*>([\s\S]*?)<\/article>/gi;
  let cardMatch: RegExpExecArray | null;

  while ((cardMatch = cardPattern.exec(html)) !== null) {
    const cardHtml = cardMatch[1];

    // Look for a link to an investigation page
    const linkMatch = cardHtml.match(/<a[^>]*href="([^"]*investigations[^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const url = oclInvestigationUrl(linkMatch[1].trim());
    const title = linkMatch[2].replace(/<[^>]*>/g, '').trim();
    if (!title) continue;

    // Extract date
    const dateMatch = cardHtml.match(/(\d{4})[./-](\d{2})[./-](\d{2})/);
    const dateStr = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : '';

    // Look for subject/person name in the card
    const subjectMatch = cardHtml.match(/(?:Subject|Respondent|Registrant|Lobbyist):\s*([^<]+)/i);
    const subject = subjectMatch ? subjectMatch[1].trim() : null;

    // Look for outcome
    const outcomeMatch = cardHtml.match(/(?:Outcome|Result|Decision|Penalty):\s*([^<]+)/i);
    const outcome = outcomeMatch ? outcomeMatch[1].trim() : null;

    // Look for Lobbying Act provision
    const provisionMatch = cardHtml.match(/(?:Section|Rule|Provision)\s+(\d[\d().]*)/i);
    const actProvision = provisionMatch ? provisionMatch[1].trim() : null;

    // Extract parties
    const parties: string[] = [];
    if (subject) parties.push(subject);
    const companyMatch = cardHtml.match(/(?:Company|Organization|Client):\s*([^<]+)/i);
    if (companyMatch) parties.push(companyMatch[1].trim());

    items.push({
      title,
      date: dateStr,
      url,
      bodyHtml: '',
      subject,
      outcome,
      parties,
      actProvision,
      reportNumber: null,
    });
  }

  // Pattern 2: Simple link list (fallback)
  if (items.length === 0) {
    const linkPattern = /<a[^>]*href="([^"]*\/investigations\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let linkMatch: RegExpExecArray | null;

    while ((linkMatch = linkPattern.exec(html)) !== null) {
      const url = oclInvestigationUrl(linkMatch[1].trim());
      const title = linkMatch[2].replace(/<[^>]*>/g, '').trim();
      if (!title || url.includes('feed') || url.includes('rss')) continue;

      // Look for nearby date
      const context = html.substring(Math.max(0, linkMatch.index - 200), linkMatch.index + 200);
      const dateMatch = context.match(/(?:\d{4})[./-](?:\d{2})[./-](?:\d{2})/);
      const dateStr = dateMatch ? dateMatch[0] : '';

      items.push({
        title,
        date: dateStr,
        url,
        bodyHtml: '',
        subject: null,
        outcome: null,
        parties: [],
        actProvision: null,
        reportNumber: null,
      });
    }
  }

  return items;
}
