// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import type { NgoRssItem, NgoRssIngestionResult, NgoRssConfig, NgoSourceOutcome } from './types.js';
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
export async function parseFeedItems(xml: string, source: NgoRssConfig): Promise<NgoRssItem[]> {
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

export interface NgoSourceFetch {
  items: NgoRssItem[];
  error: string | null;
}

/** Classify one feed. An error is not an empty success. */
export function ngoSourceOutcome(
  source: string,
  items: NgoRssItem[],
  error: string | null,
): NgoSourceOutcome {
  if (error) return { source, status: 'error', records: 0, error };
  if (items.length === 0) {
    return {
      source,
      status: 'empty',
      records: 0,
      error: null,
      skipReason: 'feed answered but contained no items',
    };
  }
  return { source, status: 'ok', records: items.length, error: null };
}

/** Fetch one feed. A null body or a throw is an error, not an empty feed. */
export async function fetchNgoSourceDetailed(source: NgoRssConfig): Promise<NgoSourceFetch> {
  try {
    const xml = await fetchXml(source.url);
    if (xml === null) {
      return { items: [], error: `feed unreachable: ${source.url}` };
    }
    const items = await parseFeedItems(xml, source);
    return { items, error: null };
  } catch (err) {
    return { items: [], error: err instanceof Error ? err.message : String(err) };
  }
}

/** Fetch a single NGO/influence RSS source */
export async function fetchNgoSource(source: NgoRssConfig): Promise<NgoRssItem[]> {
  const result = await fetchNgoSourceDetailed(source);
  return result.items;
}

/** Fetch all enabled NGO/influence RSS sources */
export async function fetchAllNgoSources(): Promise<NgoRssIngestionResult> {
  const startTime = Date.now();
  const allItems: NgoRssItem[] = [];
  const errors: { source: string; error: string }[] = [];
  const sources: NgoRssIngestionResult['sources'] = [];
  let succeeded = 0;

  const enabled = NGO_RSS_SOURCES.filter(s => s.enabled);
  const results = await Promise.allSettled(
    enabled.map(async (source) => {
      const fetched = await fetchNgoSourceDetailed(source);
      return { source: source.name, ...fetched };
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { source, items, error } = result.value;
      allItems.push(...items);
      const outcome = ngoSourceOutcome(source, items, error);
      sources.push(outcome);
      if (outcome.status === 'error' && error) {
        errors.push({ source, error });
      } else if (outcome.status !== 'error') {
        succeeded++;
      }
    } else {
      const error = result.reason?.message ?? 'unknown';
      errors.push({ source: 'unknown', error });
      sources.push({ source: 'unknown', status: 'error', records: 0, error });
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
    sources,
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
