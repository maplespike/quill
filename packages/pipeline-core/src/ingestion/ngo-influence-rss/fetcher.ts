import { hashString } from '../rss.js';
import type { NgoRssItem, NgoRssIngestionResult, NgoRssConfig } from './types.js';
import { NGO_RSS_SOURCES, NGO_RSS_FETCH_TIMEOUT_MS, NGO_RSS_USER_AGENT, MAX_ITEMS_PER_SOURCE } from './constants.js';

async function fetchXml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NGO_RSS_FETCH_TIMEOUT_MS);
    const resp = await fetch(url, {
      headers: { 'User-Agent': NGO_RSS_USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timer);
    return resp.ok ? await resp.text() : null;
  } catch { return null; }
}

function parseRssItems(xml: string, source: NgoRssConfig): NgoRssItem[] {
  const items: NgoRssItem[] = [];
  const itemMatches = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || [];
  for (const block of itemMatches) {
    const title = (block.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i)?.[1] ?? '').trim();
    const link = (block.match(/<link[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/i)?.[1] ?? '').trim();
    const desc = (block.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1] ?? '').replace(/<[^>]+>/g, ' ').trim();
    const pubDate = (block.match(/<pubDate[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/pubDate>/i)?.[1] ?? '').trim();
    if (!title && !link) continue;
    items.push({
      title: title || '(no title)',
      url: link,
      summary: desc.substring(0, 500),
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      source: source.name,
      category: source.category,
      narrativeTags: source.narrativeTags,
      hash: hashString(link || title),
    });
    if (items.length >= MAX_ITEMS_PER_SOURCE) break;
  }
  return items;
}

/** Fetch a single NGO/influence RSS source */
export async function fetchNgoSource(source: NgoRssConfig): Promise<NgoRssItem[]> {
  const xml = await fetchXml(source.url);
  if (!xml) return [];
  return parseRssItems(xml, source);
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
