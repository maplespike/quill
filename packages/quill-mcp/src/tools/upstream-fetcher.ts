// SPDX-License-Identifier: AGPL-3.0-or-later

import { cacheGet, cacheSet, cacheKey } from '../optimization/cache.js';
import { withPublisherLicense } from '@maplespike/pipeline-core';

const USER_AGENT = 'MapleSpike/0.2 (+https://maplespike.lan)';
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function fetchJson<T>(url: string, timeoutMs = 10_000, extraHeaders: Record<string, string> = {}): Promise<T> {
  const start = Date.now();
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...extraHeaders },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!resp.ok) {
      const elapsed = Date.now() - start;
      console.error(`[FETCH] ${new URL(url).host} ${resp.status} ${resp.statusText} — ${elapsed}ms — ${url.split('?')[0]}`);
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }
    return resp.json() as Promise<T>;
  } catch (err) {
    const elapsed = Date.now() - start;
    const host = (() => { try { return new URL(url).host; } catch { return '?'; } })();
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.startsWith('HTTP ')) {
      // Network error (timeout, DNS, connection refused, TLS) — log with context
      console.error(`[FETCH] ${host} FAIL — ${elapsed}ms — ${msg} — ${url.split('?')[0]}`);
    }
    throw err;
  }
}

async function fetchText(url: string, timeoutMs = 10_000): Promise<string> {
  const start = Date.now();
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!resp.ok) {
      const elapsed = Date.now() - start;
      console.error(`[FETCH] ${new URL(url).host} ${resp.status} ${resp.statusText} — ${elapsed}ms — ${url.split('?')[0]}`);
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }
    return resp.text();
  } catch (err) {
    const elapsed = Date.now() - start;
    const host = (() => { try { return new URL(url).host; } catch { return '?'; } })();
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.startsWith('HTTP ')) {
      console.error(`[FETCH] ${host} FAIL — ${elapsed}ms — ${msg} — ${url.split('?')[0]}`);
    }
    throw err;
  }
}

export function cached<T>(tool: string, params: Record<string, unknown>, fn: () => Promise<T>): Promise<T> {
  // Version the cache namespace so results previously stamped with a blanket
  // OGL-Canada label cannot continue to be served after this correction.
  const key = `publisher-license-v2:${cacheKey(tool, params)}`;
  const cached = cacheGet<T>(key);
  if (cached) return Promise.resolve(cached);
  return fn().then(result => {
    // Auto-attach citation metadata for search results
    if (result && typeof result === 'object' && 'results' in (result as any) && 'total' in (result as any)) {
      const r = result as any;
      const meta = { source: tool, retrievedAt: new Date().toISOString() };
      result = {
        ...r,
        results: r.results.map((item: any) => ({ ...meta, ...withPublisherLicense(item) })),
        total: r.total,
      };
    }
    cacheSet(key, result, CACHE_TTL_MS);
    return result;
  });
}

// ── Committees: open.canada.ca CKAN ───────────────────────────────

export async function fetchCommittees(query: string, limit = 10): Promise<{ results: Record<string, unknown>[]; total: number }> {
  return cached('committees', { query, limit }, async () => {
    const json = await fetchJson<{ result: { results: Record<string, unknown>[]; total: number } }>(
      `https://ouvert.canada.ca/data/api/3/action/package_search?q=${encodeURIComponent(query + ' committees')}&rows=${limit}`,
    );
    return { results: json.result?.results ?? [], total: json.result?.total ?? 0 };
  });
}

// ── Canada Gazette ─────────────────────────────────────────────────

const GAZETTE_RSS_URLS = [
  { part: 'Part I', url: 'https://www.gazette.gc.ca/rss/p1-eng.xml' },
  { part: 'Part II', url: 'https://www.gazette.gc.ca/rss/p2-eng.xml' },
  { part: 'Part III', url: 'https://www.gazette.gc.ca/rss/en-ls-eng.xml' },
];

const GAZETTE_FR_RSS_URLS = [
  { part: 'Partie I', url: 'https://www.gazette.gc.ca/rss/p1-fra.xml' },
  { part: 'Partie II', url: 'https://www.gazette.gc.ca/rss/p2-fra.xml' },
  { part: 'Partie III', url: 'https://www.gazette.gc.ca/rss/fr-ls-fra.xml' },
];

export async function fetchGazette(query: string, limit = 10, lang?: string): Promise<{ results: Record<string, unknown>[]; total: number }> {
  return cached('gazette', { query, limit, lang }, async () => {
    const items: Record<string, unknown>[] = [];
    const feeds = lang === 'fr' ? GAZETTE_FR_RSS_URLS : GAZETTE_RSS_URLS;
    for (const feed of feeds) {
      try {
        const text = await fetchText(feed.url);
        const titles: string[] = []; const links: string[] = [];
        let m: RegExpExecArray | null;
        const tRe = /<title>([^<]*)<\/title>/g;
        while ((m = tRe.exec(text)) !== null) titles.push(m[1]);
        const lRe = /<link>([^<]*)<\/link>/g;
        while ((m = lRe.exec(text)) !== null) links.push(m[1]);
        // Skip first title/link (channel-level), compare 1..n with query
        for (let i = 1; i < Math.min(titles.length, links.length, limit + 1); i++) {
          if (titles[i].toLowerCase().includes(query.toLowerCase())) {
            items.push({ title: titles[i], url: links[i], source: 'Canada ' + feed.part });
          }
        }
      } catch (err) {
        console.warn(`[upstream-fetcher] Gazette RSS fetch failed for ${feed.url}: ${(err as Error).message}`);
        continue;
      }
    }
    return { results: items.slice(0, limit), total: items.length };
  });
}

// ── Lobbying Registry ──────────────────────────────────────────────

export async function fetchCorporate(query: string, limit = 10): Promise<{ results: Record<string, unknown>[]; total: number }> {
  return cached('corporate', { query, limit }, async () => {
    const json = await fetchJson<{ result: { results: Record<string, unknown>[]; total: number } }>(
      `https://ouvert.canada.ca/data/api/3/action/package_search?q=${encodeURIComponent(query + ' lobbying')}&rows=${limit}`,
    );
    return { results: json.result?.results ?? [], total: json.result?.total ?? 0 };
  });
}

// ── GIC Appointments (Infobase) ────────────────────────────────────

export async function fetchGicAppointments(query: string, limit = 10): Promise<{ results: Record<string, unknown>[]; total: number }> {
  return cached('gic', { query, limit }, async () => {
    const json = await fetchJson<{ data: Record<string, unknown>[] }>(
      `https://www.infobasegc.ca/api/v1/search?q=${encodeURIComponent(query)}&limit=${limit}`,
      5000,
    );
    return { results: json.data ?? [], total: (json.data ?? []).length };
  });
}

// ── Elections Canada ───────────────────────────────────────────────

export async function fetchElections(query: string, limit = 10): Promise<{ results: Record<string, unknown>[]; total: number }> {
  return cached('elections', { query, limit }, async () => {
    const json = await fetchJson<{ result: { results: Record<string, unknown>[]; total: number } }>(
      `https://ouvert.canada.ca/data/api/3/action/package_search?q=${encodeURIComponent(query + ' elections')}&rows=${limit}`,
    );
    return { results: json.result?.results ?? [], total: json.result?.total ?? 0 };
  });
}

// ── CanLII Court Decisions ─────────────────────────────────────────

export async function fetchCanlii(query: string, limit = 10, lang?: string): Promise<{ results: Record<string, unknown>[]; total: number }> {
  return cached('canlii', { query, limit, lang }, async () => {
    // Try CKAN as primary search — indexes court decisions with full metadata
    try {
      const ckan = await fetchJson<{ result: { results: Record<string, unknown>[]; total: number } }>(
        `https://ouvert.canada.ca/data/api/3/action/package_search?q=${encodeURIComponent(query + ' court decision')}&rows=${limit}`,
        8000,
      );
      if (ckan?.result?.results?.length) {
        return { results: ckan.result.results, total: ckan.result.total ?? ckan.result.results.length };
      }
    } catch (err) {
      console.warn(`[upstream-fetcher] CanLII CKAN fallback failed: ${(err as Error).message}`);
    }

    // Fallback: CanLII API — use French endpoint when lang=fr
    const apiKey = process.env['CANLII_API_KEY'];
    if (!apiKey) return { results: [], total: 0 };
    try {
      const langPath = lang === 'fr' ? 'fr' : 'en';
      // When lang=fr, also try the French domain
      if (lang === 'fr') {
        try {
          const frResult = await fetchJson<{ results: Record<string, unknown>[]; total: number }>(
            `https://rechercher.canlii.org/api/v1/search/fr?q=${encodeURIComponent(query)}&limit=${limit}&type=decision&api_key=${encodeURIComponent(apiKey)}`,
            8000,
          );
          if (frResult?.results?.length) {
            return { results: frResult.results, total: frResult.total ?? 0 };
          }
        } catch {
          // Fall through to English API
        }
      }
      const json = await fetchJson<{ results: Record<string, unknown>[]; total: number }>(
        `https://api.canlii.org/v1/search/${langPath}?q=${encodeURIComponent(query)}&limit=${limit}&type=decision&api_key=${encodeURIComponent(apiKey)}`,
        8000,
      );
      return { results: json.results ?? [], total: json.total ?? 0 };
    } catch (err) {
      console.warn(`[upstream-fetcher] CanLII API search failed: ${(err as Error).message}`);
      return { results: [], total: 0 };
    }
  });
}

// ── LMIA Data ──────────────────────────────────────────────────────

export async function fetchLmia(query: string, limit = 10): Promise<{ results: Record<string, unknown>[]; total: number }> {
  return cached('lmia', { query, limit }, async () => {
    const json = await fetchJson<{ result: { results: Record<string, unknown>[]; total: number } }>(
      `https://ouvert.canada.ca/data/api/3/action/package_search?q=${encodeURIComponent(query + ' lmia')}&rows=${limit}`,
    );
    return { results: json.result?.results ?? [], total: json.result?.total ?? 0 };
  });
}

// ── Oversight Bodies (OAG, PBO, etc.) ──────────────────────────────

export async function fetchOversight(query: string, limit = 10): Promise<{ results: Record<string, unknown>[]; total: number }> {
  return cached('oversight', { query, limit }, async () => {
    const json = await fetchJson<{ result: { results: Record<string, unknown>[]; total: number } }>(
      `https://ouvert.canada.ca/data/api/3/action/package_search?q=${encodeURIComponent(query + ' oversight')}&rows=${limit}`,
    );
    return { results: json.result?.results ?? [], total: json.result?.total ?? 0 };
  });
}

// ── Generic CKAN Search ────────────────────────────────────────────

export async function searchCkan(query: string, limit = 10, lang?: string): Promise<{ results: Record<string, unknown>[]; total: number }> {
  return cached('ckan', { query, limit, lang }, async () => {
    // When lang=fr, use the French CKAN portal
    const baseUrl = lang === 'fr'
      ? 'https://ouvert.canada.ca/fr/data/api/3/action/package_search'
      : 'https://ouvert.canada.ca/data/api/3/action/package_search';
    const json = await fetchJson<{ result: { results: Record<string, unknown>[]; total: number } }>(
      `${baseUrl}?q=${encodeURIComponent(query)}&rows=${limit}`,
    );
    return { results: json.result?.results ?? [], total: json.result?.total ?? 0 };
  });
}

// ── Open Parliament ────────────────────────────────────────────────

export async function fetchParliamentDebates(query: string, limit = 10): Promise<{ results: Record<string, unknown>[]; total: number }> {
  return cached('debates', { query, limit }, async () => {
    const json = await fetchJson<{ objects: Record<string, unknown>[] }>(
      `https://api.openparliament.ca/debates/?limit=${limit}&format=json`,
    );
    const objects = json.objects ?? [];
    return {
      results: query ? objects.filter(o => JSON.stringify(o).toLowerCase().includes(query.toLowerCase())) : objects,
      total: objects.length,
    };
  });
}

export async function fetchPoliticians(query: string, limit = 10): Promise<{ results: Record<string, unknown>[]; total: number }> {
  return cached('politicians', { query, limit }, async () => {
    const json = await fetchJson<{ objects: Record<string, unknown>[] }>(
      `https://api.openparliament.ca/politicians/?limit=${limit}&format=json`,
    );
    const objects = json.objects ?? [];
    return {
      results: query ? objects.filter(o => JSON.stringify(o).toLowerCase().includes(query.toLowerCase())) : objects,
      total: objects.length,
    };
  });
}

export async function fetchParliamentBills(query: string, limit = 10): Promise<{ results: Record<string, unknown>[]; total: number }> {
  return cached('bills', { query, limit }, async () => {
    const json = await fetchJson<{ objects: Record<string, unknown>[] }>(
      `https://api.openparliament.ca/bills/?limit=${limit}&format=json`,
    );
    const objects = json.objects ?? [];
    return {
      results: query ? objects.filter(o => JSON.stringify(o).toLowerCase().includes(query.toLowerCase())) : objects,
      total: objects.length,
    };
  });
}

// ── Infrastructure (StatCan Core Public Infrastructure) ────────────

export async function fetchBridgeConditions(query: string, limit = 10): Promise<{ results: Record<string, unknown>[]; total: number }> {
  return cached('bridges', { query, limit }, async () => {
    const resp = await fetch('https://www150.statcan.gc.ca/n1/tbl/csv/34100288-eng.zip', {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return { results: [], total: 0 };
    const zipBuf = await resp.arrayBuffer();
    const { extractFromZip } = await import('./optimization/zip-util.js');
    const csvText = await extractFromZip(zipBuf);
    const lines = csvText.split('\n').filter(l => l.trim()).slice(1);
    const results: Record<string, unknown>[] = [];
    for (const line of lines) {
      const cols = line.split(',');
      if (cols.length < 6) continue;
      results.push({
        province: cols[0], assetType: cols[3],
        condition: cols[4], percentage: parseFloat(cols[5]) || 0,
      });
    }
    const filtered = query ? results.filter(r => JSON.stringify(r).toLowerCase().includes(query.toLowerCase())) : results;
    return { results: filtered.slice(0, limit), total: filtered.length };
  });
}

export async function fetchInfrastructureCosts(query: string, limit = 10): Promise<{ results: Record<string, unknown>[]; total: number }> {
  return cached('infra_costs', { query, limit }, async () => {
    const resp = await fetch('https://www150.statcan.gc.ca/n1/tbl/csv/34100284-eng.zip', {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return { results: [], total: 0 };
    const zipBuf = await resp.arrayBuffer();
    const { extractFromZip } = await import('./optimization/zip-util.js');
    const csvText = await extractFromZip(zipBuf);
    const lines = csvText.split('\n').filter(l => l.trim()).slice(1);
    const results: Record<string, unknown>[] = [];
    for (const line of lines) {
      const cols = line.split(',');
      if (cols.length < 6) continue;
      results.push({
        province: cols[0], assetType: cols[3],
        metric: cols[4], value: parseFloat(cols[5]) || 0,
      });
    }
    const filtered = query ? results.filter(r => JSON.stringify(r).toLowerCase().includes(query.toLowerCase())) : results;
    return { results: filtered.slice(0, limit), total: filtered.length };
  });
}

// ── Open Parliament: Extended Tools ────────────────────────────────

export async function fetchParliamentVotes(query: string, limit = 10): Promise<{ results: Record<string, unknown>[]; total: number }> {
  return cached('votes', { query, limit }, async () => {
    const json = await fetchJson<{ objects: Record<string, unknown>[] }>(
      `https://api.openparliament.ca/votes/?limit=${limit}&format=json`,
    );
    const objects = json.objects ?? [];
    return { results: query ? objects.filter((o: Record<string, unknown>) => JSON.stringify(o).toLowerCase().includes(query.toLowerCase())) : objects, total: objects.length };
  });
}

export async function fetchParliamentCommittees(query: string, limit = 10): Promise<{ results: Record<string, unknown>[]; total: number }> {
  return cached('op_committees', { query, limit }, async () => {
    const json = await fetchJson<{ objects: Record<string, unknown>[] }>(
      `https://api.openparliament.ca/committees/?limit=${limit}&format=json`,
    );
    const objects = json.objects ?? [];
    return { results: query ? objects.filter((o: Record<string, unknown>) => JSON.stringify(o).toLowerCase().includes(query.toLowerCase())) : objects, total: objects.length };
  });
}

export async function fetchEntityCrossReference(name: string): Promise<{ mp: Record<string, unknown> | null; lobbyingRecords: number; gicAppointments: number; committeeMemberships: number; sources: string[] }> {
  return cached('entity_xref', { name }, async () => {
    const mpJson = await fetchJson<{ objects: Record<string, unknown>[] }>(
      'https://api.openparliament.ca/politicians/?limit=5&format=json',
    );
    const mp = mpJson.objects?.find((o: Record<string, unknown>) => JSON.stringify(o).toLowerCase().includes(name.toLowerCase())) ?? null;
    const lobbyJson = await fetchJson<{ result: { results: Record<string, unknown>[]; total: number } }>(
      `https://ouvert.canada.ca/data/api/3/action/package_search?q=${encodeURIComponent(name + ' lobbying')}&rows=5`,
    );
    const gicJson = await fetchJson<{ result: { results: Record<string, unknown>[]; total: number } }>(
      `https://ouvert.canada.ca/data/api/3/action/package_search?q=${encodeURIComponent(name + ' governor council appointment')}&rows=5`,
    );
    return { mp, lobbyingRecords: lobbyJson.result?.total ?? 0, gicAppointments: gicJson.result?.total ?? 0, committeeMemberships: 0, sources: ['openparliament.ca', 'ouvert.canada.ca'] };
  });
}

// ── Socrata (SODA API) ─────────────────────────────────────────────

const SOCRATA_DOMAINS: Record<string, string> = {
  'novascotia': 'https://data.novascotia.ca',
  'newbrunswick': 'https://gnb.socrata.com',
  'pei': 'https://data.princeedwardisland.ca',
  'peel': 'https://opendata.peelregion.ca',
  'calgary': 'https://data.calgary.ca',
  'toronto': 'https://open.toronto.ca',
};

export async function searchSocrata(domain: string, query: string, limit = 10): Promise<{ results: Record<string, unknown>[]; total: number }> {
  return cached('socrata_' + domain, { query, limit }, async () => {
    const base = SOCRATA_DOMAINS[domain] || `https://${domain}.socrata.com`;
    const json = await fetchJson<Array<Record<string, unknown>>>(`${base}/api/views?q=${encodeURIComponent(query)}&limit=${limit}`);
    return { results: json ?? [], total: (json ?? []).length };
  });
}

export async function fetchSocrataDataset(domain: string, datasetId: string, limit = 10): Promise<{ results: Record<string, unknown>[]; total: number }> {
  const base = SOCRATA_DOMAINS[domain] || `https://${domain}.socrata.com`;
  const json = await fetchJson<Array<Record<string, unknown>>>(`${base}/resource/${datasetId}.json?$limit=${limit}`);
  return { results: json ?? [], total: (json ?? []).length };
}

// ── Provincial Data: Socrata + CKAN unified ──────────────────────

export async function fetchProvincialData(province: string, query: string, limit = 10, lang?: string): Promise<{ results: Record<string, unknown>[]; total: number }> {
  const prov = province.toLowerCase();
  // Socrata provinces
  if (prov === 'ns' || prov === 'novascotia') {
    try { const r = await searchSocrata('novascotia', query, limit); if (r.total > 0) return r; } catch (err) {
      console.warn(`[upstream-fetcher] Nova Scotia Socrata search failed: ${(err as Error).message}`);
    }
  }
  if (prov === 'nb' || prov === 'newbrunswick') {
    // When lang=fr, prioritize French portal (GNB Socrata)
    try { const r = await searchSocrata('newbrunswick', query, limit); if (r.total > 0) return r; } catch (err) {
      console.warn(`[upstream-fetcher] New Brunswick Socrata search failed: ${(err as Error).message}`);
    }
  }
  // CKAN provinces (try provincial portal first, fall back to federal CKAN)
  try {
    const r = await fetchProvincialCkan(prov, query, limit);
    if (r.total > 0) return r;
  } catch (err) {
    console.warn(`[upstream-fetcher] Provincial CKAN search failed for ${prov}: ${(err as Error).message}`);
  }
  // Federal CKAN fallback — use French portal when lang=fr
  const { searchCkan } = await import('./upstream-fetcher.js');
  try { return await searchCkan(query + ' ' + province, limit, lang); } catch (err) {
    console.warn(`[upstream-fetcher] Federal CKAN fallback failed: ${(err as Error).message}`);
  }
  // Browser extraction cache fallback (for nt, nu — portals with no API)
  try {
    const r = await fetchExtractionCache(prov, query, limit);
    if (r.total > 0) return r;
  } catch (err) {
    console.warn(`[upstream-fetcher] Extraction cache fallback failed: ${(err as Error).message}`);
  }
  return { results: [], total: 0 };
}

// ── Browser Extraction Cache ──────────────────────────────────────
// For portals with no API (NWT, Nunavut), the portal client extracts
// data via browser rendering and POSTs results to the extraction API.
// This fetches those cached results so MCP tools have a fallback.

const EXTRACTION_API_BASE = process.env.QUILL_API_URL
  ? `${process.env.QUILL_API_URL.replace(/\/+$/, '')}`
  : 'http://localhost:8082';

const JURISDICTION_TO_SOURCE: Record<string, string[]> = {
  nt: ['nwt-open-government'],
  nu: ['nunavut-bureau-statistics', 'nunavut-demographics', 'nunavut-economic'],
  nwt: ['nwt-open-government'],
  nunavut: ['nunavut-bureau-statistics', 'nunavut-demographics', 'nunavut-economic'],
};

export async function fetchExtractionCache(jurisdiction: string, query: string, limit = 10): Promise<{ results: Record<string, unknown>[]; total: number }> {
  return cached('extraction_' + jurisdiction, { query, limit }, async () => {
    const sourceIds = JURISDICTION_TO_SOURCE[jurisdiction.toLowerCase()];
    if (!sourceIds) return { results: [], total: 0 };

    const allResults: Record<string, unknown>[] = [];
    for (const sourceId of sourceIds) {
      try {
        const resp = await fetchJson<{ success: boolean; data?: { results: Array<{ title: string; url: string; format: string }> } }>(
          `${EXTRACTION_API_BASE}/v1/extraction/cached/${sourceId}`,
          5000,
        );
        if (resp.success && resp.data?.results) {
          for (const item of resp.data.results) {
            if (query === '' || item.title.toLowerCase().includes(query.toLowerCase())) {
              allResults.push({ ...item, source: 'browser-extraction', jurisdiction });
            }
          }
        }
      } catch {
        // Cache miss or API unreachable — skip silently
      }
    }
    return { results: allResults.slice(0, limit), total: allResults.length };
  });
}

// ── Provincial CKAN endpoints ──────────────────────────────────────

const PROVINCIAL_CKAN: Record<string, string> = {
  qc: 'https://www.donneesquebec.ca/api/3/action/package_search?q=',
  bc: 'https://catalogue.data.gov.bc.ca/api/3/action/package_search?q=',
  yt: 'https://open.yukon.ca/api/3/action/package_search?q=',
  on: 'https://data.ontario.ca/api/3/action/package_search?q=',
  ab: 'https://open.alberta.ca/api/3/action/package_search?q=',
  nl: 'https://opendata.gov.nl.ca/api/3/action/package_search?q=',
  ns: 'https://data.novascotia.ca/api/views?q=',
  // nt, nu, sk, mb — no working CKAN API. Fallback to federal CKAN + browser extraction cache.
};

export async function fetchProvincialCkan(province: string, query: string, limit = 10): Promise<{ results: Record<string, unknown>[]; total: number }> {
  return cached('prov_' + province, { query, limit }, async () => {
    const base = PROVINCIAL_CKAN[province];
    if (!base) return { results: [], total: 0 };
    const url = province === 'ns'
      ? `${base}${encodeURIComponent(query)}&limit=${limit}`
      : `${base}${encodeURIComponent(query)}&rows=${limit}`;
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' }, signal: AbortSignal.timeout(8000) });
      if (!resp.ok) return { results: [], total: 0 };
      const json: any = await resp.json().catch(() => null);
      if (!json) return { results: [], total: 0 };
      // CKAN format
      if (json?.result?.results) return { results: json.result.results, total: json.result.total ?? json.result.results.length };
      // Socrata format (array of views)
      if (Array.isArray(json)) return { results: json, total: json.length };
      return { results: [], total: 0 };
    } catch (err) {
      console.warn(`[upstream-fetcher] Provincial CKAN fetch failed: ${(err as Error).message}`);
      return { results: [], total: 0 };
    }
  });
}

// ── ArcGIS Hub / Portal (MB, SK, PEI) ─────────────────────────────

const ARCGIS_SERVERS: Record<string, { name: string; server: string }> = {
  mb: { name: 'Manitoba', server: 'https://services.arcgis.com/mMUesHYPkXjaFGfS/arcgis/rest/services' },
  sk: { name: 'Saskatchewan', server: 'https://services3.arcgis.com/zcv98lgAl8xQ04cW/arcgis/rest/services' },
  pe: { name: 'Prince Edward Island', server: 'https://gis.princeedwardisland.ca/server/rest/services' },
  pei: { name: 'Prince Edward Island', server: 'https://gis.princeedwardisland.ca/server/rest/services' },
};

export async function listArcGISServices(province: string): Promise<{ results: Record<string, unknown>[]; total: number }> {
  return cached('arcgis_services_' + province, {}, async () => {
    const info = ARCGIS_SERVERS[province];
    if (!info) return { results: [], total: 0 };
    const resp = await fetch(info.server + '?f=json', { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return { results: [], total: 0 };
    const json: any = await resp.json().catch(() => null);
    const services = json?.services ?? [];
    return {
      results: services.map((s: Record<string, unknown>) => ({ name: s.name, type: s.type, url: info.server + '/' + s.name + '/FeatureServer' })),
      total: services.length,
    };
  });
}

export async function queryArcGISService(serverUrl: string, limit = 10): Promise<{ results: Record<string, unknown>[]; total: number }> {
  try {
    const queryUrl = serverUrl.endsWith('/') ? serverUrl + 'query?f=json&returnCountOnly=true' : serverUrl + '/query?f=json&returnCountOnly=true';
    const resp = await fetch(queryUrl, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return { results: [], total: 0 };
    const json: any = await resp.json().catch(() => null);
    return { results: [{ service: serverUrl, count: json?.count ?? 0 }], total: json?.count ?? 0 };
  } catch (err) {
    console.warn(`[upstream-fetcher] ArcGIS service query failed: ${(err as Error).message}`);
    return { results: [], total: 0 };
  }
}

// ── Municipal Data Routing ─────────────────────────────────────────

const MUNICIPAL_PORTALS: Record<string, { url: string; format: string }> = {
  toronto: { url: 'https://open.toronto.ca', format: 'socrata' },
  vancouver: { url: 'https://opendata.vancouver.ca', format: 'ckan' },
  montreal: { url: 'https://donnees.montreal.ca', format: 'ckan' },
  calgary: { url: 'https://data.calgary.ca', format: 'socrata' },
  ottawa: { url: 'https://open.ottawa.ca', format: 'ckan' },
  edmonton: { url: 'https://data.edmonton.ca', format: 'socrata' },
  winnipeg: { url: 'https://data.winnipeg.ca', format: 'ckan' },
  quebec: { url: 'https://donnees.ville.quebec.qc.ca', format: 'ckan' },
  hamilton: { url: 'https://open.hamilton.ca', format: 'ckan' },
  mississauga: { url: 'https://data.mississauga.ca', format: 'ckan' },
};

export async function searchMunicipalData(city: string, query: string, limit = 10): Promise<{ results: Record<string, unknown>[]; total: number }> {
  return cached('muni_' + city, { query, limit }, async () => {
    const info = MUNICIPAL_PORTALS[city];
    if (!info) return { results: [], total: 0 };
    const base = info.url;
    let url: string;
    if (info.format === 'socrata') { url = base + '/api/views?q=' + encodeURIComponent(query) + '&limit=' + limit; }
    else { url = base + '/api/3/action/package_search?q=' + encodeURIComponent(query) + '&rows=' + limit; }
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' }, signal: AbortSignal.timeout(8000) });
      if (!resp.ok) return { results: [], total: 0 };
      const json: any = await resp.json().catch(() => null);
      if (!json) return { results: [], total: 0 };
      if (Array.isArray(json)) return { results: json, total: json.length };
      if (json?.result?.results) return { results: json.result.results, total: json.result.total ?? json.result.results.length };
      return { results: [], total: 0 };
    } catch (err) {
      console.warn(`[upstream-fetcher] Municipal data search failed for ${city}: ${(err as Error).message}`);
      return { results: [], total: 0 };
    }
  });
}

// ── ArcGIS Layer Search ────────────────────────────────────────────

export async function searchArcGISLayers(province: string, keyword: string): Promise<{ results: Record<string, unknown>[]; total: number }> {
  return cached('arcgis_search_' + province + '_' + keyword, {}, async () => {
    const info = ARCGIS_SERVERS[province];
    if (!info) return { results: [], total: 0 };
    const resp = await fetch(info.server + '?f=json', { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return { results: [], total: 0 };
    const json: any = await resp.json().catch(() => null);
    const services = json?.services ?? [];
    const lower = keyword.toLowerCase();
    const matched = services.filter((s: any) => s.name?.toLowerCase().includes(lower));
    return { results: matched.map((s: any) => ({ name: s.name, type: s.type, server: info.server })), total: matched.length };
  });
}
