import { computeHash } from '../../verification/hashing.js';
import type { CrossReferenceResult, CrossReferenceMatch, CrossReferenceTimelineEntry, CrossReferenceQuery } from './types.js';
import { CROSS_REF_TIMEOUT_MS, CROSS_REF_UA, MAX_MATCHES_PER_SOURCE, CROSS_REF_MODULES } from './constants.js';

/** Generic HTML search across a URL, extracting links */
async function searchUrl(url: string): Promise<string | null> {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), CROSS_REF_TIMEOUT_MS);
    const r = await fetch(url, { headers: { 'User-Agent': CROSS_REF_UA }, signal: c.signal });
    clearTimeout(t); return r.ok ? await r.text() : null;
  } catch { return null; }
}

/** Search lobbying registry for entity */
async function searchLobbying(query: string, limit: number): Promise<CrossReferenceMatch[]> {
  const matches: CrossReferenceMatch[] = [];
  const html = await searchUrl(`https://lobbycanada.gc.ca/app/secure/ocr/lobbyistsregistry/registrationsearch.shtml?search=${encodeURIComponent(query)}`);
  if (!html) return matches;
  const lp = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = lp.exec(html)) !== null && matches.length < limit) {
    const t = m[2].replace(/<[^>]+>/g, '').trim();
    if (t.length < 5) continue;
    matches.push({ module: 'lobbying', sourceUrl: m[1].startsWith('http') ? m[1] : `https://lobbycanada.gc.ca${m[1]}`, date: '', title: t, description: `Lobbying registration related to "${query}"`, relevance: 'direct' });
  }
  return matches;
}

/** Search open.canada.ca CKAN for entity mentions across modules */
async function searchCkan(entity: string, module: string, limit: number): Promise<CrossReferenceMatch[]> {
  const matches: CrossReferenceMatch[] = [];
  const data = await searchUrl(`https://open.canada.ca/data/api/3/action/package_search?q=${encodeURIComponent(entity)}&rows=${limit}`);
  if (!data) return matches;
  try {
    const parsed = JSON.parse(data);
    for (const pkg of parsed?.result?.results ?? []) {
      matches.push({
        module, sourceUrl: `https://open.canada.ca/data/en/dataset/${pkg.id}`,
        date: pkg.metadata_created?.substring(0, 10) || '',
        title: pkg.title || '', description: (pkg.notes || '').substring(0, 300),
        relevance: 'indirect',
      });
    }
  } catch { /* */ }
  return matches;
}

/** Main cross-reference search across all modules */
export async function crossReferenceSearch(query: CrossReferenceQuery): Promise<CrossReferenceResult> {
  const now = new Date().toISOString();
  const entity = query.query.trim();
  const limit = query.limit ?? MAX_MATCHES_PER_SOURCE;
  const allMatches: CrossReferenceMatch[] = [];

  // Search lobbying registry (primary source)
  const lobbyingMatches = await searchLobbying(entity, limit);
  allMatches.push(...lobbyingMatches);

  // Search CKAN for entity mentions across government datasets
  const ckanModules = ['GIC Appointments', 'Government Contracts', 'Campaign Finance', 'Influence'];
  const ckanResults = await Promise.allSettled(
    ckanModules.map(m => searchCkan(entity, m, Math.ceil(limit / ckanModules.length)))
  );
  for (const r of ckanResults) {
    if (r.status === 'fulfilled') allMatches.push(...r.value);
  }

  // Build timeline (sorted by date, newest first)
  const timeline: CrossReferenceTimelineEntry[] = allMatches
    .filter(m => m.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 50)
    .map(m => ({ date: m.date, module: m.module, event: m.title, sourceUrl: m.sourceUrl }));

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
