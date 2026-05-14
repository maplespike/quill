import { computeHash } from '../../verification/hashing.js';
import type { CultureRecord, CultureIngestionResult } from './types.js';

const CKAN_BASE = 'https://open.canada.ca/data/api/3/action';
const CULTURE_UA = 'MapleSpike-Culture/1.0';

async function fetchJson(url: string): Promise<any> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': CULTURE_UA } });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

async function searchCkan(query: string, rows = 30): Promise<any[]> {
  const data = await fetchJson(`${CKAN_BASE}/package_search?q=${encodeURIComponent(query)}&rows=${rows}`);
  return data?.result?.results ?? [];
}

export async function ingestAllCulture(): Promise<CultureIngestionResult> {
  const startTime = Date.now();
  const records: CultureRecord[] = [];
  const errors: string[] = [];
  const now = new Date().toISOString();

  // Canadian Heritage grants and funding
  for (const q of ['heritage+grants', 'canadian+heritage+funding', 'culture+programs', 'museums+grants', 'film+funding']) {
    try {
      const results = await searchCkan(q);
      for (const item of results) {
        records.push({
          id: await computeHash(`culture:${item.id}`, 'sha256'),
          year: item.metadata_created?.substring(0, 4) ? parseInt(item.metadata_created.substring(0, 4)) : new Date().getFullYear(),
          category: item.organization?.title || 'Canadian Heritage',
          value: 1,
          description: item.title || item.name || '',
          region: 'Canada',
          sourceUrl: `https://open.canada.ca/data/en/dataset/${item.id}`,
          ingestedAt: now,
        });
      }
    } catch (e) { errors.push(`CKAN ${q}: ${e instanceof Error ? e.message : 'unknown'}`); }
  }

  // Canada Council for the Arts
  try {
    const [ccData] = await Promise.all([
      fetchJson('https://canadacouncil.ca/research/data-tables').catch(() => null),
    ]);
    if (ccData) {
      records.push({
        id: await computeHash('culture:canada-council', 'sha256'),
        year: new Date().getFullYear(), category: 'Canada Council for the Arts',
        value: 1, description: 'Canada Council for the Arts research data and grant tables',
        region: 'Canada', sourceUrl: 'https://canadacouncil.ca/research/data-tables', ingestedAt: now,
      });
    }
  } catch { errors.push('Canada Council: unreachable'); }

  // Telefilm Canada
  try {
    records.push({
      id: await computeHash('culture:telefilm', 'sha256'),
      year: new Date().getFullYear(), category: 'Telefilm Canada',
      value: 1, description: 'Telefilm Canada production funding data and reports',
      region: 'Canada', sourceUrl: 'https://telefilm.ca/en/studies-and-reports', ingestedAt: now,
    });
  } catch { errors.push('Telefilm: unreachable'); }

  // CRTC broadcasting ownership (for cultural/media ownership context)
  try {
    const crtcOwn = await fetchJson('https://crtc.gc.ca/ownership/eng/');
    if (crtcOwn) {
      records.push({
        id: await computeHash('culture:crtc-ownership', 'sha256'),
        year: new Date().getFullYear(), category: 'CRTC Broadcasting Ownership',
        value: 1, description: 'CRTC broadcasting ownership charts and media concentration data',
        region: 'Canada', sourceUrl: 'https://crtc.gc.ca/ownership/eng/', ingestedAt: now,
      });
    }
  } catch { errors.push('CRTC ownership: unreachable'); }

  return { records, errors, durationMs: Date.now() - startTime };
}

export async function searchCulture(query: string): Promise<CultureIngestionResult> {
  const all = await ingestAllCulture();
  const q = query.toLowerCase();
  return {
    records: all.records.filter(r =>
      r.description.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)),
    errors: all.errors,
    durationMs: all.durationMs,
  };
}

export type { CultureRecord, CultureIngestionResult } from './types.js';
