import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import type { NgoRssItem, NgoRssIngestionResult, NgoRssConfig } from './types.js';
import { NGO_RSS_SOURCES, NGO_RSS_FETCH_TIMEOUT_MS, NGO_RSS_USER_AGENT, MAX_ITEMS_PER_SOURCE } from './constants.js';

/**
 * Fetch RSS XML from a URL using the shared httpGet utility.
 * Returns null on any failure (network, HTTP error, timeout).
 */
async function fetchXml(url: string): Promise<string | null> {
  try {
    const resp = await httpGet(url, {
      headers: { 'User-Agent': NGO_RSS_USER_AGENT, Accept: 'application/rss+xml, application/xml, text/xml' },
      timeoutMs: NGO_RSS_FETCH_TIMEOUT_MS,
    });
    return resp.statusCode >= 200 && resp.statusCode < 300 ? resp.body : null;
  } catch {
    return null;
  }
}

/**
 * Parse RSS XML text into NgoRssItem[] using regex extraction.
 * Matches both RSS 2.0 <item> blocks and Atom <entry> blocks.
 */
async function parseFeedItems(xml: string, source: NgoRssConfig): Promise<NgoRssItem[]> {
  const items: NgoRssItem[] = [];

  // Try RSS 2.0 <item> blocks
  const itemMatches = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || [];
  // Try Atom <entry> blocks if no RSS items found
  const entryMatches = xml.match(/<entry[^>]*>[\s\S]*?<\/entry>/gi) || [];

  const blocks = itemMatches.length > 0 ? itemMatches : entryMatches;
  const isAtom = itemMatches.length === 0 && entryMatches.length > 0;

  for (const block of blocks) {
    let title: string;
    let link: string;
    let desc: string;
    let pubDate: string;

    if (isAtom) {
      title = (block.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i)?.[1] ?? '').trim();
      // Atom uses <link href="..."/>
      const linkMatch = block.match(/<link[^>]*href\s*=\s*"([^"]*)"[^>]*\/?>/i);
      link = linkMatch?.[1] ?? '';
      desc = (block.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i)?.[1] ?? '').replace(/<[^>]+>/g, ' ').trim();
      if (!desc) {
        desc = (block.match(/<content[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content>/i)?.[1] ?? '').replace(/<[^>]+>/g, ' ').trim();
      }
      pubDate = (block.match(/<published[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/published>/i)?.[1] ?? '').trim();
      if (!pubDate) {
        pubDate = (block.match(/<updated[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/updated>/i)?.[1] ?? '').trim();
      }
    } else {
      title = (block.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i)?.[1] ?? '').trim();
      link = (block.match(/<link[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/i)?.[1] ?? '').trim();
      desc = (block.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1] ?? '').replace(/<[^>]+>/g, ' ').trim();
      pubDate = (block.match(/<pubDate[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/pubDate>/i)?.[1] ?? '').trim();
    }

    if (!title && !link) continue;

    const hashInput = link || title;
    const hash = await computeHash(hashInput, 'sha256');

    items.push({
      title: title || '(no title)',
      url: link,
      summary: desc.substring(0, 500),
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      source: source.name,
      category: source.category,
      narrativeTags: source.narrativeTags,
      hash,
    });

    if (items.length >= MAX_ITEMS_PER_SOURCE) break;
  }

  return items;
}

/** Fetch a single NGO/influence RSS source */
export async function fetchNgoSource(source: NgoRssConfig): Promise<NgoRssItem[]> {
  try {
    const xml = await fetchXml(source.url);
    if (!xml) return [];
    return await parseFeedItems(xml, source);
  } catch {
    return [];
  }
}

/** Fetch all enabled NGO/influence RSS sources */
export async function fetchAllNgoSources(): Promise<NgoRssIngestionResult> {
  const startTime = Date.now();
  const allItems: NgoRssItem[] = [];
  const errors: { source: string; error: string }[] = [];
  let succeeded = 0;

  const enabled = NGO_RSS_SOURCES.filter(s => s.enabled);
  const results = await Promise.allSettled(
    enabled.map(async (source) => {
      const items = await fetchNgoSource(source);
      return { source: source.name, items };
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allItems.push(...result.value.items);
      succeeded++;
    } else {
      errors.push({ source: 'unknown', error: result.reason?.message ?? 'unknown' });
    }
  }

  // Deduplicate by hash
  const seen = new Set<string>();
  const deduped = allItems.filter(item => {
    if (seen.has(item.hash)) return false;
    seen.add(item.hash);
    return true;
  });

  return {
    items: deduped,
    sourcesAttempted: enabled.length,
    sourcesSucceeded: succeeded,
    errors,
    durationMs: Date.now() - startTime,
  };
}

/** Search across ingested NGO RSS items */
export function searchNgoItems(items: NgoRssItem[], query: string): NgoRssItem[] {
  const q = query.toLowerCase();
  return items.filter(item =>
    item.title.toLowerCase().includes(q) ||
    item.summary.toLowerCase().includes(q) ||
    item.source.toLowerCase().includes(q) ||
    item.narrativeTags.some(t => t.includes(q))
  );
}
