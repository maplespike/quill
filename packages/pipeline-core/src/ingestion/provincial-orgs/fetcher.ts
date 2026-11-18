// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Provincial Orgs Fetcher — Quill
 *
 * HTTP fetchers for provincial oversight body records across all
 * 13 Canadian provinces and territories.
 *
 * Handles multiple fetch strategies:
 *   - RSS feeds for regular publication updates
 *   - CKAN dataset queries where open-data portals exist
 *   - Generic HTML page scraping for static listing pages
 *
 * The main entry point is fetchProvincialOrgReport() which dispatches
 * to the appropriate strategy per body config.
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  PROVINCIAL_ORGS,
  PROVINCIAL_FETCH_TIMEOUT_MS,
  PROVINCIAL_USER_AGENT,
  MAX_RECORDS_PER_BODY,
} from './constants.js';
import type { ProvincialOrgConfig, ProvincialOrgRecord, ProvincialOrgIngestionResult } from './types.js';

/**
 * Fetch records from an RSS feed endpoint.
 */
async function fetchRssFeed(config: ProvincialOrgConfig): Promise<ProvincialOrgRecord[]> {
  const records: ProvincialOrgRecord[] = [];
  try {
    const resp = await httpGet(config.feedUrl!, {
      headers: { 'User-Agent': PROVINCIAL_USER_AGENT, Accept: 'application/rss+xml, application/xml, text/xml' },
      timeoutMs: PROVINCIAL_FETCH_TIMEOUT_MS,
    });
    if (resp.statusCode < 200 || resp.statusCode >= 300) return [];

    const xml = resp.body;
    const now = new Date().toISOString();

    // Extract <item> elements with title, link, description, pubDate
    const itemRegex = /<item>[\s\S]*?<\/item>/gi;
    let itemMatch: RegExpExecArray | null;
    let count = 0;

    while ((itemMatch = itemRegex.exec(xml)) !== null && count < MAX_RECORDS_PER_BODY) {
      const item = itemMatch[0];
      const title = extractXmlValue(item, 'title');
      const link = extractXmlValue(item, 'link');
      const description = extractXmlValue(item, 'description');
      const pubDate = extractXmlValue(item, 'pubDate');

      if (!title || !link) continue;

      const hash = await computeHash(`${config.code}:${link}`, 'sha256');
      records.push({
        bodyCode: config.code,
        bodyName: config.name,
        bodyType: config.bodyType,
        province: config.province,
        title: title.substring(0, 300),
        url: link,
        summary: description ? description.substring(0, 500) : '',
        publishedAt: pubDate ? new Date(pubDate).toISOString() : now,
        hash,
        ingestedAt: now,
      });
      count++;
    }

    return records;
  } catch {
    return [];
  }
}

/**
 * Fetch records from a CKAN data portal.
 */
async function fetchCkanRecords(config: ProvincialOrgConfig): Promise<ProvincialOrgRecord[]> {
  const records: ProvincialOrgRecord[] = [];
  try {
    if (!config.ckanBaseUrl || !config.ckanPackageId) return [];

    const searchUrl = `${config.ckanBaseUrl}/package_show?id=${config.ckanPackageId}`;
    const resp = await httpGet(searchUrl, {
      headers: { 'User-Agent': PROVINCIAL_USER_AGENT, Accept: 'application/json' },
      timeoutMs: PROVINCIAL_FETCH_TIMEOUT_MS,
    });
    if (resp.statusCode < 200 || resp.statusCode >= 300) return [];

    const data = JSON.parse(resp.body) as {
      result?: { resources?: Array<{ name?: string; url?: string; description?: string; created?: string; id: string }> };
    };
    const resources = data?.result?.resources ?? [];
    const now = new Date().toISOString();

    for (const res of resources.slice(0, MAX_RECORDS_PER_BODY)) {
      const hash = await computeHash(`${config.code}:${res.id}`, 'sha256');
      records.push({
        bodyCode: config.code,
        bodyName: config.name,
        bodyType: config.bodyType,
        province: config.province,
        title: res.name ?? 'Untitled Resource',
        url: res.url ?? config.baseUrl,
        summary: res.description ?? '',
        publishedAt: res.created ?? now,
        hash,
        ingestedAt: now,
      });
    }

    return records;
  } catch {
    return [];
  }
}

/**
 * Fetch records from a generic HTML listing page.
 */
async function fetchHtmlRecords(config: ProvincialOrgConfig): Promise<ProvincialOrgRecord[]> {
  const records: ProvincialOrgRecord[] = [];
  try {
    const resp = await httpGet(config.baseUrl, {
      headers: { 'User-Agent': PROVINCIAL_USER_AGENT, Accept: 'text/html' },
      timeoutMs: PROVINCIAL_FETCH_TIMEOUT_MS,
    });
    if (resp.statusCode < 200 || resp.statusCode >= 300) return [];

    const html = resp.body;
    const now = new Date().toISOString();

    // Extract article/report links: <a href="...">title</a>
    const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    let count = 0;

    while ((match = linkRegex.exec(html)) !== null && count < MAX_RECORDS_PER_BODY) {
      const url = match[1].trim();
      const rawTitle = match[2].replace(/<[^>]+>/g, '').trim();

      if (!rawTitle || rawTitle.length < 10) continue;
      if (url.startsWith('#') || url.startsWith('javascript:')) continue;
      if (/^(about|contact|privacy|login|search|donate)/i.test(rawTitle)) continue;

      const fullUrl = url.startsWith('http') ? url : new URL(url, config.baseUrl).href;
      const hash = await computeHash(`${config.code}:${fullUrl}`, 'sha256');

      records.push({
        bodyCode: config.code,
        bodyName: config.name,
        bodyType: config.bodyType,
        province: config.province,
        title: rawTitle.substring(0, 300),
        url: fullUrl,
        summary: '',
        publishedAt: now,
        hash,
        ingestedAt: now,
      });
      count++;
    }

    return records;
  } catch {
    return [];
  }
}

/** Extract a single XML tag value */
function extractXmlValue(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = regex.exec(xml);
  if (!match) return null;
  return (match[1] ?? match[2] ?? '').trim();
}

/**
 * Fetch a report from a single provincial oversight body.
 * Dispatches to the appropriate fetch strategy based on config.
 */
export async function fetchProvincialOrgReport(code: string): Promise<ProvincialOrgRecord[]> {
  const config = PROVINCIAL_ORGS.find(o => o.code === code);
  if (!config || !config.enabled) return [];

  try {
    if (config.feedUrl) {
      return await fetchRssFeed(config);
    }
    if (config.ckanBaseUrl && config.ckanPackageId) {
      return await fetchCkanRecords(config);
    }
    return await fetchHtmlRecords(config);
  } catch {
    return [];
  }
}

/**
 * Fetch reports from all enabled provincial oversight bodies.
 */
export async function fetchAllProvincialOrgReports(): Promise<ProvincialOrgIngestionResult> {
  const startTime = Date.now();
  const allRecords: ProvincialOrgRecord[] = [];
  const errors: { source: string; error: string }[] = [];
  let succeeded = 0;

  const enabled = PROVINCIAL_ORGS.filter(o => o.enabled);
  const results = await Promise.allSettled(
    enabled.map(async (config) => {
      const items = await fetchProvincialOrgReport(config.code);
      return { source: config.code, items };
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

/**
 * Search across provincial org records.
 */
export function searchProvincialOrgRecords(records: ProvincialOrgRecord[], query: string): ProvincialOrgRecord[] {
  const q = query.toLowerCase();
  return records.filter(r =>
    r.title.toLowerCase().includes(q) ||
    r.summary.toLowerCase().includes(q) ||
    r.bodyName.toLowerCase().includes(q) ||
    r.bodyType.toLowerCase().includes(q)
  );
}
