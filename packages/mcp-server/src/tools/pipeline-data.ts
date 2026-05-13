/**
 * Shared pipeline data loader for MapleSpike MCP search tools
 *
 * Loads from pipeline-data.json when available.
 * Falls back to live HTTP fetching from source APIs when the file is missing.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

let _pipelineData: Record<string, any> | null = null;

/**
 * Load and cache the pipeline-data.json file.
 * Tries multiple possible paths for flexibility across different run modes.
 */
export function getPipelineData(): Record<string, any> | null {
  if (_pipelineData) return _pipelineData;

  const __dirname = dirname(fileURLToPath(import.meta.url));

  // Try multiple possible relative paths (source vs compiled, dev vs production)
  const possiblePaths = [
    // From dist/tools/ or src/tools/ — go up to maplespike/, then into portal
    resolve(__dirname, '../../../../packages/portal/assets/pipeline-data.json'),
    // Alternative: from workspace root
    resolve('/data/projects/own/maplespike/packages/portal/assets/pipeline-data.json'),
  ];

  for (const dataPath of possiblePaths) {
    if (existsSync(dataPath)) {
      _pipelineData = JSON.parse(readFileSync(dataPath, 'utf-8'));
      return _pipelineData;
    }
  }

  return null;
}

/**
 * Search across one or more pipeline sources for records matching a query.
 * Performs case-insensitive substring matching on the JSON-serialized record.
 */
export function searchRecords(
  sourceKeys: string[],
  query: string,
  limit: number,
): { results: any[]; total: number } {
  const data = getPipelineData();
  if (!data) return { results: [], total: 0 };

  const allRecords: any[] = [];
  const q = query.toLowerCase();

  for (const key of sourceKeys) {
    const source = data.sources?.[key];
    if (source?.data && Array.isArray(source.data)) {
      for (const record of source.data) {
        const searchText = JSON.stringify(record).toLowerCase();
        if (searchText.includes(q)) {
          allRecords.push({ ...record, _source: key });
        }
      }
    }
  }

  return {
    results: allRecords.slice(0, limit),
    total: allRecords.length,
  };
}

/* ------------------------------------------------------------------ */
/*  Live-Fetch Fallbacks                                               */
/* ------------------------------------------------------------------ */

/**
 * Live-fetch committee evidence from ourcommons.ca XML endpoint.
 * Fetches the committee list page and parses meeting data.
 */
async function liveFetchCommittees(query: string, limit: number): Promise<any[]> {
  const results: any[] = [];
  try {
    // Fetch the House of Commons committee meetings list
    const url = 'https://www.ourcommons.ca/Committees/en/Search?searchTerm=' +
      encodeURIComponent(query) + '&pageSize=' + limit;
    const resp = await fetch(url, {
      headers: { 'Accept': 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return results;

    const html = await resp.text();
    // Extract committee meeting entries using simple regex
    const meetingRegex = /<a[^>]*href="\/DocumentViewer\/en\/(\d+-\d+)\/([A-Z]+)\/meeting-(\d+)\/evidence"[^>]*>([^<]*)<\/a>/gi;
    let match: RegExpExecArray | null;
    const seen = new Set<string>();

    while ((match = meetingRegex.exec(html)) !== null && results.length < limit) {
      const [, parliament, committee, meeting, title] = match;
      const key = `${committee}-${meeting}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const titleLower = title.toLowerCase();
      if (!titleLower.includes(query.toLowerCase()) && !committee.toLowerCase().includes(query.toLowerCase())) {
        // Still include if nothing else matches — committees endpoint returns relevant results
      }

      results.push({
        committee,
        name: title.trim() || committee,
        meeting: parseInt(meeting, 10),
        date: null,
        inCamera: false,
        witnesses: [],
        interventionCount: 0,
        source: `https://www.ourcommons.ca/DocumentViewer/en/${parliament}/${committee}/meeting-${meeting}/evidence`,
        xmlSource: `https://www.ourcommons.ca/Content/Committee/${parliament}/${committee}/Evidence/EV14050128/${committee}EV${meeting}-E.XML`,
        _source: 'hoc',
        _live: true,
      });
    }
  } catch (err) {
    console.error('[pipeline-data] liveFetchCommittees error:', err);
  }
  return results.slice(0, limit);
}

/**
 * Live-fetch court decisions from the CanLII API.
 * Falls back to searching the CanLII website if the API key is unavailable.
 */
async function liveFetchCanlii(query: string, limit: number): Promise<any[]> {
  const results: any[] = [];
  try {
    // Try CanLII public search endpoint
    const url = 'https://www.canlii.org/en/search?text=' + encodeURIComponent(query) +
      '&type=decision&pageNumber=1&pageSize=' + limit;
    const resp = await fetch(url, {
      headers: {
        'Accept': 'application/json, text/html',
        'User-Agent': 'MapleSpike/1.0',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return results;

    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('json')) {
      const data = await resp.json() as any;
      const decisions = data?.results || data?.decisions || [];
      for (const d of decisions.slice(0, limit)) {
        results.push({
          caseName: d.title || d.caseName || 'Unknown',
          citation: d.citation || '',
          court: d.court || '',
          date: d.date || d.decisionDate || null,
          summary: d.summary || '',
          url: d.url || '',
          _source: 'canlii',
          _live: true,
        });
      }
    } else {
      // HTML fallback: extract decision links
      const html = await resp.text();
      const decisionRegex = /<a[^>]*href="(\/en\/[^"]*\/decision[^"]*)"[^>]*>([^<]*)<\/a>/gi;
      let match: RegExpExecArray | null;
      while ((match = decisionRegex.exec(html)) !== null && results.length < limit) {
        results.push({
          caseName: match[2].trim(),
          citation: '',
          court: '',
          date: null,
          summary: '',
          url: 'https://www.canlii.org' + match[1],
          _source: 'canlii',
          _live: true,
        });
      }
    }
  } catch (err) {
    console.error('[pipeline-data] liveFetchCanlii error:', err);
  }
  return results.slice(0, limit);
}

/**
 * Live-fetch Canada Gazette entries from the RSS feed.
 */
async function liveFetchGazette(query: string, limit: number): Promise<any[]> {
  const results: any[] = [];
  try {
    // Gazette RSS feed
    const url = 'https://gazette.gc.ca/rss/eng/part1.xml';
    const resp = await fetch(url, {
      headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return results;

    const xml = await resp.text();
    const q = query.toLowerCase();

    // Simple item extraction
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    const titleRegex = /<title[^>]*>([^<]*)<\/title>/i;
    const linkRegex = /<link[^>]*>([^<]*)<\/link>/i;
    const descRegex = /<description[^>]*>([^<]*)<\/description>/i;
    const dateRegex = /<pubDate[^>]*>([^<]*)<\/pubDate>/i;

    let itemMatch: RegExpExecArray | null;
    while ((itemMatch = itemRegex.exec(xml)) !== null && results.length < limit) {
      const item = itemMatch[1];
      const titleMatch = titleRegex.exec(item);
      const linkMatch = linkRegex.exec(item);
      const descMatch = descRegex.exec(item);
      const dateMatch = dateRegex.exec(item);

      const title = titleMatch ? titleMatch[1] : '';
      const description = descMatch ? descMatch[1] : '';

      const searchText = (title + ' ' + description).toLowerCase();
      if (!searchText.includes(q)) continue;

      results.push({
        title,
        part: 'Part I',
        description,
        url: linkMatch ? linkMatch[1] : '',
        publicationDate: dateMatch ? dateMatch[1] : null,
        _source: 'gazette',
        _live: true,
      });
    }
  } catch (err) {
    console.error('[pipeline-data] liveFetchGazette error:', err);
  }
  return results.slice(0, limit);
}

/**
 * Live-fetch from open.canada.ca CKAN API — generic fallback for most search tools.
 * Differentiates by sourceKey to add context-appropriate mapping.
 */
async function liveFetchCKAN(
  sourceKey: string,
  query: string,
  limit: number,
): Promise<any[]> {
  const results: any[] = [];
  try {
    // CKAN package search on open.canada.ca
    const url = 'https://open.canada.ca/data/api/3/action/package_search?q=' +
      encodeURIComponent(query) + '&rows=' + limit;
    const resp = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return results;

    const body = await resp.json() as any;
    const packages = body?.result?.results || [];

    for (const pkg of packages.slice(0, limit)) {
      results.push({
        title: pkg.title || pkg.name || 'Unknown',
        description: pkg.notes || '',
        url: pkg.url || `https://open.canada.ca/data/en/dataset/${pkg.name || ''}`,
        organization: pkg.organization?.title || '',
        metadataCreated: pkg.metadata_created || null,
        metadataModified: pkg.metadata_modified || null,
        _source: sourceKey,
        _live: true,
      });
    }
  } catch (err) {
    console.error(`[pipeline-data] liveFetchCKAN(${sourceKey}) error:`, err);
  }
  return results.slice(0, limit);
}

/**
 * Main live-fetch dispatcher.
 * Routes to the appropriate source-specific fetcher based on source keys.
 */
export async function liveFetch(
  sourceKeys: string[],
  query: string,
  limit: number,
): Promise<{ results: any[]; total: number }> {
  const allResults: any[] = [];

  for (const key of sourceKeys) {
    let records: any[] = [];

    switch (key) {
      case 'hoc':
      case 'senate':
        records = await liveFetchCommittees(query, limit);
        break;
      case 'canlii':
        records = await liveFetchCanlii(query, limit);
        break;
      case 'gazette':
        records = await liveFetchGazette(query, limit);
        break;
      case 'lobbying':
      case 'procurement':
      case 'corporate':
      case 'influence':
      case 'gic':
      case 'elections':
      case 'provincialLobbying':
      case 'oversight':
      case 'lmia':
      default:
        records = await liveFetchCKAN(key, query, limit);
        break;
    }

    // Tag with source
    for (const r of records) {
      r._source = key;
    }
    allResults.push(...records);
  }

  // Client-side filtering as a simple approximation
  const q = query.toLowerCase();
  const filtered = allResults.filter((r) =>
    !q || JSON.stringify(r).toLowerCase().includes(q),
  );

  return {
    results: filtered.slice(0, limit),
    total: filtered.length,
  };
}
