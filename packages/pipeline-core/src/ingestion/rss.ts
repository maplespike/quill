/**
 * RSS Ingestion Module — Quill
 *
 * Extracted from MapleSpike Cloudflare Worker.
 * Provides RSS feed fetching, parsing, deduplication, and source management.
 *
 * Originally defined in: cloudflare/worker/src/index.ts (lines 26-71, 104-172, 1093-1101)
 * Merged with: src/lib/ingestion/rss.ts, scripts/ingest-rss.js
 */

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface RSSItem {
  title?: string;
  link?: string;
  guid?: string;
  contentSnippet?: string;
  content?: string;
  pubDate?: string;
}

export interface RSSFeed {
  items?: RSSItem[];
}

export interface RSSSource {
  name: string;
  url: string;
  category: string;
  /** Force HTTP/1.1 for feeds that have HTTP/2 issues (e.g. CBC). */
  preferHttp1?: boolean;
}

/** Canonical article shape produced by the pipeline. */
export interface RawArticle {
  title: string;
  summary: string;
  content?: string;
  url: string;
  source: string;
  publishedAt: string;
  category: string;
}

/* ------------------------------------------------------------------ */
/*  RSS Sources                                                        */
/* ------------------------------------------------------------------ */

/**
 * 43+ Canadian news outlets used by the Quill.
 * Single source of truth — the Worker and ingest-rss.js both derive from this.
 */
export const RSS_SOURCES: RSSSource[] = [
  // National broadcasters
  { name: 'CBC News Top Stories', url: 'https://www.cbc.ca/webfeed/rss/rss-topstories', category: 'news', preferHttp1: true },
  { name: 'CBC Politics', url: 'https://www.cbc.ca/webfeed/rss/rss-politics', category: 'politics', preferHttp1: true },
  { name: 'CBC Business', url: 'https://www.cbc.ca/webfeed/rss/rss-business', category: 'business', preferHttp1: true },
  { name: 'CBC Technology', url: 'https://www.cbc.ca/webfeed/rss/rss-technology', category: 'technology', preferHttp1: true },
  { name: 'CBC Health', url: 'https://www.cbc.ca/webfeed/rss/rss-health', category: 'health', preferHttp1: true },
  { name: 'CBC World', url: 'https://www.cbc.ca/webfeed/rss/rss-world', category: 'world', preferHttp1: true },

  // National newspapers
  { name: 'The Globe and Mail - Canada', url: 'https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/canada/', category: 'politics' },
  { name: 'The Globe and Mail - Politics', url: 'https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/politics/', category: 'politics' },
  { name: 'The Globe and Mail - Business', url: 'https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/business/', category: 'business' },
  { name: 'The Globe and Mail - Opinion', url: 'https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/opinion/', category: 'opinion' },
  { name: 'National Post', url: 'https://nationalpost.com/feed', category: 'news' },
  { name: 'National Post - Politics', url: 'https://nationalpost.com/category/politics/feed', category: 'politics' },
  { name: 'Toronto Star', url: 'https://www.thestar.com/content/feed?category=news', category: 'news' },
  { name: 'Toronto Star - Politics', url: 'https://www.thestar.com/content/feed?category=politics', category: 'politics' },

  // Regional newspapers - Ontario
  { name: 'Toronto Sun', url: 'https://torontosun.com/feed', category: 'news' },
  { name: 'Ottawa Citizen', url: 'https://ottawacitizen.com/feed', category: 'news' },
  { name: 'Hamilton Spectator', url: 'https://thespec.com/feed', category: 'news' },
  { name: 'Windsor Star', url: 'https://windsorstar.com/feed', category: 'news' },
  { name: 'London Free Press', url: 'https://lfpress.com/feed', category: 'news' },
  { name: 'Waterloo Region Record', url: 'https://therecord.com/feed', category: 'news' },

  // Regional newspapers - Quebec
  { name: 'Montreal Gazette', url: 'https://montrealgazette.com/feed', category: 'news' },
  { name: 'Le Devoir', url: 'https://www.ledevoir.com/rss', category: 'news' },

  // Regional newspapers - West
  { name: 'Vancouver Sun', url: 'https://vancouversun.com/feed', category: 'news' },
  { name: 'The Province', url: 'https://theprovince.com/feed', category: 'news' },
  { name: 'Calgary Herald', url: 'https://calgaryherald.com/feed', category: 'news' },
  { name: 'Edmonton Journal', url: 'https://edmontonjournal.com/feed', category: 'news' },
  { name: 'Winnipeg Free Press', url: 'https://www.winnipegfreepress.com/feed', category: 'news' },
  { name: 'Saskatoon StarPhoenix', url: 'https://thestarphoenix.com/feed', category: 'news' },
  { name: 'Regina Leader-Post', url: 'https://leaderpost.com/feed', category: 'news' },

  // Regional newspapers - Atlantic
  { name: 'Chronicle Herald', url: 'https://chronicleherald.ca/feed', category: 'news' },
  { name: 'Telegraph-Journal', url: 'https://telegraphjournal.com/feed', category: 'news' },

  // Digital-first outlets
  { name: 'The Narwhal', url: 'https://www.thenarwhal.ca/feed/', category: 'environment' },
  { name: "Canada's National Observer", url: 'https://www.nationalobserver.com/rss', category: 'environment' },
  { name: 'Tyee', url: 'https://thetyee.ca/RSS', category: 'news' },
  { name: 'PressProgress', url: 'https://pressprogress.ca/feed/', category: 'politics' },

  // Business publications
  { name: 'Financial Post', url: 'https://financialpost.com/feed', category: 'business' },
  { name: 'Canadian Business', url: 'https://www.canadianbusiness.com/feed/', category: 'business' },
  { name: 'Bloomberg News - Canada', url: 'https://www.bnnbloomberg.ca/rss', category: 'business' },

  // Policy and think tanks
  { name: "Maclean's", url: 'https://www.macleans.ca/feed/', category: 'news' },
  { name: 'Policy Options', url: 'https://policyoptions.irpp.org/feed/', category: 'policy' },
  { name: 'The Hill Times', url: 'https://hilltimes.com/feed/', category: 'politics' },

  // Wire services
  { name: 'The Canadian Press', url: 'https://www.cp.org/feed/', category: 'news' },

  // Specialized coverage
  { name: 'First Nations Drum', url: 'https://www.firstnationsdrum.com/feed/', category: 'indigenous' },
  { name: 'Open Canada', url: 'https://www.opencanada.org/feed/', category: 'policy' },

  // Advocacy / legal
  { name: 'Justice Centre for Constitutional Freedoms', url: 'https://www.jccf.ca/feed/', category: 'policy' },

  // NGOs and think tanks (policy research, advocacy)
  { name: 'Fraser Institute', url: 'https://www.fraserinstitute.org/rss', category: 'think-tank' },
  { name: 'C.D. Howe Institute', url: 'https://www.cdhowe.org/feed', category: 'think-tank' },
  { name: 'Macdonald-Laurier Institute', url: 'https://www.macdonaldlaurier.ca/feed/', category: 'think-tank' },
  { name: 'Broadbent Institute', url: 'https://www.broadbentinstitute.ca/feed/', category: 'think-tank' },
  { name: 'Cardus', url: 'https://www.cardus.ca/feed/', category: 'think-tank' },
  { name: 'Canadian Taxpayers Federation', url: 'https://www.taxpayer.com/feed/', category: 'think-tank' },
  { name: 'Canadian Centre for Policy Alternatives', url: 'https://www.policyalternatives.ca/feed/', category: 'think-tank' },
  { name: 'Canada West Foundation', url: 'https://cwf.ca/feed/', category: 'think-tank' },
  { name: 'Conference Board of Canada', url: 'https://www.conferenceboard.ca/feed/', category: 'think-tank' },
];

/* ------------------------------------------------------------------ */
/*  RSS Parser (regex-based, no external deps)                         */
/* ------------------------------------------------------------------ */

/**
 * Parse RSS XML text using regex extraction.
 * No external dependencies — works in Workers, Node, and edge runtimes.
 */
export function parseRSS(xmlText: string): RSSFeed {
  const items: RSSItem[] = [];

  if (!xmlText || typeof xmlText !== 'string') {
    return { items: [] };
  }

  const itemMatches = xmlText.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || [];

  for (const itemBlock of itemMatches) {
    const item: RSSItem = {};

    const titleMatch = itemBlock.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i);
    if (titleMatch) item.title = titleMatch[1].trim();

    const linkMatch = itemBlock.match(/<link[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/i);
    if (linkMatch) item.link = linkMatch[1].trim();

    const guidMatch = itemBlock.match(/<guid[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/guid>/i);
    if (guidMatch) item.guid = guidMatch[1].trim();

    const pubDateMatch = itemBlock.match(/<pubDate[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/pubDate>/i);
    if (pubDateMatch) item.pubDate = pubDateMatch[1].trim();

    const descMatch = itemBlock.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
    if (descMatch) {
      item.contentSnippet = descMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      item.content = descMatch[1];
    }

    const contentMatch = itemBlock.match(/<content:encoded[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/i);
    if (contentMatch) {
      item.content = contentMatch[1];
    }

    if (item.title || item.link) {
      items.push(item);
    }
  }

  return { items };
}

import { httpGet } from '../utils/http.js';

/* ------------------------------------------------------------------ */
/*  Hash / Deduplication                                               */
/* ------------------------------------------------------------------ */

/**
 * Simple stable hash for URL deduplication.
 * Produces consistent base-36 strings — compatible with existing D1 indices.
 */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/* ------------------------------------------------------------------ */
/*  Fetch & Process                                                    */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Conditional GET Cache                                              */
/* ------------------------------------------------------------------ */

interface FeedCacheEntry {
  etag?: string;
  lastModified?: string;
  body: string;
  timestamp: number;
}

const feedCache = new Map<string, FeedCacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000;

export interface FetchOptions {
  userAgent?: string;
  timeout?: number;
  /** Force HTTP/1.1 for this particular fetch (e.g. feeds with HTTP/2 issues). */
  preferHttp1?: boolean;
}

/**
 * Fetch a single RSS feed, parse it, and return items.
 * Throws on HTTP errors or timeouts.
 */
export async function fetchFeed(
  url: string,
  options: FetchOptions = {},
): Promise<RSSFeed> {
  const { userAgent = 'MapleSpike-Canada/1.0 (+https://github.com/reverb256/quill)', timeout = 30_000 } = options;

  const cached = feedCache.get(url);
  const reqHeaders: Record<string, string> = { 'User-Agent': userAgent };

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    if (cached.etag) reqHeaders['If-None-Match'] = cached.etag;
    if (cached.lastModified) reqHeaders['If-Modified-Since'] = cached.lastModified;
  }

  const resp = await httpGet(url, {
    headers: reqHeaders,
    timeoutMs: timeout,
    ...(options.preferHttp1 ? { preferHttp1: true } : {}),
  });

  if (resp.statusCode === 304 && cached) {
    console.warn(`[RSS] 304 Not Modified for ${url} — using cached body`);
    return parseRSS(cached.body);
  }

  if (resp.statusCode >= 400) {
    throw new Error(`HTTP ${resp.statusCode} for ${url}`);
  }

  feedCache.set(url, {
    etag: resp.headers['etag'],
    lastModified: resp.headers['last-modified'],
    body: resp.body,
    timestamp: Date.now(),
  });

  if (feedCache.size > 100) {
    const cutoff = Date.now() - CACHE_TTL_MS;
    for (const [key, entry] of feedCache) {
      if (entry.timestamp < cutoff) feedCache.delete(key);
    }
  }

  return parseRSS(resp.body);
}

/**
 * Deduplicate items against a set of known hashes.
 * Returns only items whose URLs have not been seen.
 */
export function deduplicateItems(
  items: RSSItem[],
  existingHashes: Set<string>,
): RSSItem[] {
  return items.filter((item) => {
    const url = item.link || item.guid || '';
    if (!url) return false;
    return !existingHashes.has(hashString(url));
  });
}
