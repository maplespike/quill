/**
 * Cross-Reference Fetcher — MapleSpike Pipeline
 *
 * Searches across all 7 pipeline modules for entity mentions:
 *   Lobbying Registry, GIC Appointments, Parliamentary Committees,
 *   Elections & Campaign Finance, Government Contracts,
 *   Influence Tracking, Court Decisions (CanLII)
 *
 * Each module is queried via its public API or web interface.
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import type { CrossReferenceResult, CrossReferenceMatch, CrossReferenceTimelineEntry, CrossReferenceQuery } from './types.js';
import {
  CROSS_REF_TIMEOUT_MS, CROSS_REF_UA,
  MAX_MATCHES_PER_SOURCE, CROSS_REF_MODULES,
} from './constants.js';

async function fetchText(url: string): Promise<string | null> {
  try {
    const resp = await httpGet(url, { headers: { 'User-Agent': CROSS_REF_UA }, timeoutMs: CROSS_REF_TIMEOUT_MS });
    return resp.statusCode >= 400 ? null : resp.body;
  } catch { return null; }
}

async function fetchJson(url: string): Promise<any> {
  const t = await fetchText(url);
  return t ? JSON.parse(t) : null;
}

/* ------------------------------------------------------------------ */
/*  Module-specific search functions                                   */
/* ------------------------------------------------------------------ */

/** 1. Lobbying Registry — direct web scrape */
async function searchLobbying(query: string, limit: number): Promise<CrossReferenceMatch[]> {
  const matches: CrossReferenceMatch[] = [];
  const html = await fetchText(
    `https://lobbycanada.gc.ca/app/secure/ocr/lobbyistsregistry/registrationsearch.shtml?search=${encodeURIComponent(query)}`,
  );
  if (!html) return matches;
  const re = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && matches.length < limit) {
    const t = m[2].replace(/<[^>]+>/g, '').trim();
    if (t.length < 5) continue;
    matches.push({
      module: 'lobbying', sourceUrl: m[1].startsWith('http') ? m[1] : `https://lobbycanada.gc.ca${m[1]}`,
      date: '', title: t, description: `Lobbying registration related to "${query}"`, relevance: 'direct',
    });
  }
  return matches;
}

/** 2. GIC Appointments — CKAN search */
async function searchGIC(query: string, limit: number): Promise<CrossReferenceMatch[]> {
  const matches: CrossReferenceMatch[] = [];
  const data = await fetchJson(
    `https://open.canada.ca/data/api/3/action/package_search?q=${encodeURIComponent(`governor+in+council+${query}`)}&rows=${limit}`,
  );
  for (const pkg of data?.result?.results ?? []) {
    matches.push({
      module: 'gic', sourceUrl: `https://open.canada.ca/data/en/dataset/${pkg.id}`,
      date: pkg.metadata_created?.substring(0, 10) || '',
      title: pkg.title || '', description: (pkg.notes || '').substring(0, 300),
      relevance: 'indirect',
    });
  }
  return matches;
}

/** 3. Parliamentary Committees — ourcommons.ca */
async function searchCommittees(query: string, limit: number): Promise<CrossReferenceMatch[]> {
  const matches: CrossReferenceMatch[] = [];
  const html = await fetchText(
    `https://www.ourcommons.ca/Committees/en/Search?search=all&text=${encodeURIComponent(query)}`,
  );
  if (!html) return matches;
  const re = /<a[^>]*href=["'](\/Committees\/en\/[^"']+)["'][^>]*>([^<]+)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && matches.length < limit) {
    const t = m[2].trim();
    if (t.length < 5) continue;
    matches.push({
      module: 'committees', sourceUrl: `https://www.ourcommons.ca${m[1]}`,
      date: '', title: t, description: `Committee mention of "${query}"`, relevance: 'indirect',
    });
  }
  return matches;
}

/** 4. Elections Canada — CKAN */
async function searchElections(query: string, limit: number): Promise<CrossReferenceMatch[]> {
  const matches: CrossReferenceMatch[] = [];
  const data = await fetchJson(
    `https://open.canada.ca/data/api/3/action/package_search?q=${encodeURIComponent(`elections+${query}`)}&rows=${limit}`,
  );
  for (const pkg of data?.result?.results ?? []) {
    matches.push({
      module: 'elections', sourceUrl: `https://open.canada.ca/data/en/dataset/${pkg.id}`,
      date: pkg.metadata_created?.substring(0, 10) || '',
      title: pkg.title || '', description: (pkg.notes || '').substring(0, 300),
      relevance: 'indirect',
    });
  }
  return matches;
}

/** 5. Government Contracts — CKAN proactive disclosure */
async function searchContracts(query: string, limit: number): Promise<CrossReferenceMatch[]> {
  const matches: CrossReferenceMatch[] = [];
  const data = await fetchJson(
    `https://open.canada.ca/data/api/3/action/package_search?q=${encodeURIComponent(`contract+${query}`)}&rows=${limit}`,
  );
  for (const pkg of data?.result?.results ?? []) {
    matches.push({
      module: 'proactive-disclosure', sourceUrl: `https://open.canada.ca/data/en/dataset/${pkg.id}`,
      date: pkg.metadata_created?.substring(0, 10) || '',
      title: pkg.title || '', description: (pkg.notes || '').substring(0, 300),
      relevance: 'indirect',
    });
  }
  return matches;
}

/** 6. Influence Tracking — CKAN funding/grants */
async function searchInfluence(query: string, limit: number): Promise<CrossReferenceMatch[]> {
  return searchCkanGeneric(query, limit, 'influence', `grant+${query}`);
}

/** 7. Court Decisions — CanLII web search */
async function searchCanLII(query: string, limit: number): Promise<CrossReferenceMatch[]> {
  const matches: CrossReferenceMatch[] = [];
  const html = await fetchText(
    `https://www.canlii.org/en/search?text=${encodeURIComponent(query)}&page=1&resultCount=${limit}`,
  );
  if (!html) return matches;
  const re = /<a[^>]*href=["'](\/[^"']+\/en\/[^"']+)["'][^>]*>([^<]+)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && matches.length < limit) {
    const t = m[2].trim();
    if (t.length < 5) continue;
    matches.push({
      module: 'canlii', sourceUrl: `https://www.canlii.org${m[1]}`,
      date: '', title: t, description: `Court decision referencing "${query}"`, relevance: 'direct',
    });
  }
  return matches;
}

/** Generic CKAN package search helper */
async function searchCkanGeneric(query: string, limit: number, module: string, searchQuery?: string): Promise<CrossReferenceMatch[]> {
  const matches: CrossReferenceMatch[] = [];
  const data = await fetchJson(
    `https://open.canada.ca/data/api/3/action/package_search?q=${encodeURIComponent(searchQuery || query)}&rows=${limit}`,
  );
  for (const pkg of data?.result?.results ?? []) {
    matches.push({
      module, sourceUrl: `https://open.canada.ca/data/en/dataset/${pkg.id}`,
      date: pkg.metadata_created?.substring(0, 10) || '',
      title: pkg.title || '', description: (pkg.notes || '').substring(0, 300),
      relevance: 'indirect',
    });
  }
  return matches;
}

/* ------------------------------------------------------------------ */
/*  Main Cross-Reference Search                                        */
/* ------------------------------------------------------------------ */

export async function crossReferenceSearch(query: CrossReferenceQuery): Promise<CrossReferenceResult> {
  const now = new Date().toISOString();
  const entity = query.query.trim();
  const limit = query.limit ?? MAX_MATCHES_PER_SOURCE;
  const allMatches: CrossReferenceMatch[] = [];

  // Search ALL 7 pipeline modules in parallel
  const results = await Promise.allSettled([
    searchLobbying(entity, limit),
    searchGIC(entity, limit),
    searchCommittees(entity, limit),
    searchElections(entity, limit),
    searchContracts(entity, limit),
    searchInfluence(entity, limit),
    searchCanLII(entity, limit),
  ]);

  for (const r of results) {
    if (r.status === 'fulfilled') allMatches.push(...r.value);
  }

  // Build timeline sorted by date (newest first)
  const dated = allMatches.filter(m => m.date);
  dated.sort((a, b) => b.date.localeCompare(a.date));
  const timeline: CrossReferenceTimelineEntry[] = dated.slice(0, 50).map(m => ({
    date: m.date, module: m.module, event: m.title, sourceUrl: m.sourceUrl,
  }));

  // Deduplicate by sourceUrl
  const seen = new Set<string>();
  const unique = allMatches.filter(m => {
    if (seen.has(m.sourceUrl)) return false;
    seen.add(m.sourceUrl);
    return true;
  });

  return {
    entity, entityType: 'organization',
    matches: unique, totalMatches: unique.length,
    timeline, ingestedAt: now,
  };
}
