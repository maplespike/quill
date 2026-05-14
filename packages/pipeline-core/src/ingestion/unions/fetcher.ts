import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import type { UnionRecord, UnionIngestionResult, UnionSource } from './types.js';
import { UNION_SOURCES, UNION_FETCH_TIMEOUT_MS, UNION_USER_AGENT, MAX_RECORDS_PER_SOURCE } from './constants.js';

/**
 * Fetch HTML page from a union source URL.
 * Uses regex-based extraction to find article/report links and titles.
 */
async function fetchHtmlRecords(source: UnionSource): Promise<UnionRecord[]> {
  const records: UnionRecord[] = [];
  try {
    const resp = await httpGet(source.url, {
      headers: { 'User-Agent': UNION_USER_AGENT, Accept: 'text/html' },
      timeoutMs: UNION_FETCH_TIMEOUT_MS,
    });
    if (resp.statusCode < 200 || resp.statusCode >= 300) return [];

    const html = resp.body;
    const now = new Date().toISOString();

    // Extract article-like links: <a href="...">title</a> inside common containers
    const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    let count = 0;

    while ((match = linkRegex.exec(html)) !== null && count < MAX_RECORDS_PER_SOURCE) {
      const url = match[1].trim();
      const rawTitle = match[2].replace(/<[^>]+>/g, '').trim();

      // Skip navigation links, empty titles, non-content URLs
      if (!rawTitle || rawTitle.length < 10) continue;
      if (url.startsWith('#') || url.startsWith('javascript:')) continue;
      if (/^(about|contact|privacy|login|search|donate)/i.test(rawTitle)) continue;

      // Resolve relative URLs
      const fullUrl = url.startsWith('http') ? url : new URL(url, source.url).href;

      const hash = await computeHash(`${source.name}:${fullUrl}`, 'sha256');
      records.push({
        title: rawTitle.substring(0, 200),
        url: fullUrl,
        summary: '',
        publishedAt: now,
        source: source.name,
        category: source.category,
        province: source.province,
        narrativeTags: source.narrativeTags,
        hash,
        recordType: 'news',
      });
      count++;
    }

    return records;
  } catch {
    return [];
  }
}

/**
 * Fetch CKAN datasets matching union/labour queries.
 */
async function fetchCkanRecords(source: UnionSource): Promise<UnionRecord[]> {
  const records: UnionRecord[] = [];
  try {
    const resp = await httpGet(source.url, {
      headers: { 'User-Agent': UNION_USER_AGENT, Accept: 'application/json' },
      timeoutMs: UNION_FETCH_TIMEOUT_MS,
    });
    if (resp.statusCode < 200 || resp.statusCode >= 300) return [];

    const data = JSON.parse(resp.body) as {
      result?: { results?: Array<{ title: string; notes?: string; url?: string; metadata_created?: string; id: string }> };
    };
    const results = data?.result?.results ?? [];
    const now = new Date().toISOString();

    for (const pkg of results.slice(0, MAX_RECORDS_PER_SOURCE)) {
      const hash = await computeHash(`${source.name}:${pkg.id}`, 'sha256');
      records.push({
        title: pkg.title,
        url: pkg.url ?? `https://open.canada.ca/data/dataset/${pkg.id}`,
        summary: pkg.notes ?? '',
        publishedAt: pkg.metadata_created ?? now,
        source: source.name,
        category: source.category,
        province: source.province,
        narrativeTags: source.narrativeTags,
        hash,
        recordType: 'dataset',
        metadata: { ckanId: pkg.id },
      });
    }

    return records;
  } catch {
    return [];
  }
}

/**
 * Fetch StatCan labour/union coverage data table listings.
 */
async function fetchStatCanRecords(source: UnionSource): Promise<UnionRecord[]> {
  const records: UnionRecord[] = [];
  try {
    const resp = await httpGet(source.url, {
      headers: { 'User-Agent': UNION_USER_AGENT, Accept: 'text/html' },
      timeoutMs: UNION_FETCH_TIMEOUT_MS,
    });
    if (resp.statusCode < 200 || resp.statusCode >= 300) return [];

    const html = resp.body;
    const now = new Date().toISOString();

    // Extract StatCan data table links
    const tableRegex = /<a[^>]*href="(\/en\/\d+-x\w+[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    let count = 0;

    while ((match = tableRegex.exec(html)) !== null && count < MAX_RECORDS_PER_SOURCE) {
      const url = match[1].trim();
      const rawTitle = match[2].replace(/<[^>]+>/g, '').trim();
      if (!rawTitle || rawTitle.length < 10) continue;

      const fullUrl = url.startsWith('http') ? url : `https://www150.statcan.gc.ca${url}`;
      const hash = await computeHash(`${source.name}:${fullUrl}`, 'sha256');
      records.push({
        title: rawTitle.substring(0, 200),
        url: fullUrl,
        summary: '',
        publishedAt: now,
        source: source.name,
        category: source.category,
        province: source.province,
        narrativeTags: source.narrativeTags,
        hash,
        recordType: 'coverage-stat',
      });
      count++;
    }

    return records;
  } catch {
    return [];
  }
}

/** Fetch a single union source by its config */
export async function fetchUnionSource(source: UnionSource): Promise<UnionRecord[]> {
  try {
    switch (source.fetchType) {
      case 'html':
        return await fetchHtmlRecords(source);
      case 'ckan':
        return await fetchCkanRecords(source);
      case 'statcan':
        return await fetchStatCanRecords(source);
      default:
        return [];
    }
  } catch {
    return [];
  }
}

/** Fetch all enabled union sources */
export async function fetchAllUnionSources(): Promise<UnionIngestionResult> {
  const startTime = Date.now();
  const allRecords: UnionRecord[] = [];
  const errors: { source: string; error: string }[] = [];
  let succeeded = 0;

  const enabled = UNION_SOURCES.filter(s => s.enabled);
  const results = await Promise.allSettled(
    enabled.map(async (source) => {
      const items = await fetchUnionSource(source);
      return { source: source.name, items };
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allRecords.push(...result.value.items);
      if (result.value.items.length > 0) succeeded++;
    } else {
      errors.push({ source: 'unknown', error: result.reason?.message ?? 'unknown' });
    }
  }

  // Deduplicate by hash
  const seen = new Set<string>();
  const deduped = allRecords.filter(r => {
    if (seen.has(r.hash)) return false;
    seen.add(r.hash);
    return true;
  });

  return {
    records: deduped,
    sourcesAttempted: enabled.length,
    sourcesSucceeded: succeeded,
    errors,
    durationMs: Date.now() - startTime,
  };
}

/** Search across union records */
export function searchUnionRecords(records: UnionRecord[], query: string): UnionRecord[] {
  const q = query.toLowerCase();
  return records.filter(r =>
    r.title.toLowerCase().includes(q) ||
    r.summary.toLowerCase().includes(q) ||
    r.source.toLowerCase().includes(q) ||
    r.narrativeTags.some(t => t.includes(q))
  );
}
