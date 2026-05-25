// SPDX-License-Identifier: AGPL-3.0-or-later

import { cacheGet, cacheSet, cacheKey } from '../optimization/cache.js';

const USER_AGENT = 'MapleSpike/0.2 (+https://maplespike.lan)';
const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchJson<T>(url: string, timeoutMs = 10_000): Promise<T> {
  const resp = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  return resp.json() as Promise<T>;
}

async function fetchText(url: string, timeoutMs = 10_000): Promise<string> {
  const resp = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  return resp.text();
}

function cached<T>(tool: string, params: Record<string, unknown>, fn: () => Promise<T>): Promise<T> {
  const key = cacheKey(tool, params);
  const cached = cacheGet<T>(key);
  if (cached) return Promise.resolve(cached);
  return fn().then(result => {
    // Auto-attach citation metadata for search results
    if (result && typeof result === 'object' && 'results' in (result as any) && 'total' in (result as any)) {
      const r = result as any;
      const meta = { source: tool, retrievedAt: new Date().toISOString(), license: 'OGL-Canada (https://open.canada.ca/en/open-government-licence-canada)' };
      result = { ...r, results: r.results.map((item: any) => ({ ...item, ...meta })), total: r.total };
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

export async function fetchGazette(query: string, limit = 10): Promise<{ results: Record<string, unknown>[]; total: number }> {
  return cached('gazette', { query, limit }, async () => {
    const items: Record<string, unknown>[] = [];
    for (const feed of GAZETTE_RSS_URLS) {
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
      } catch { continue; }
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

export async function fetchCanlii(query: string, limit = 10): Promise<{ results: Record<string, unknown>[]; total: number }> {
  return cached('canlii', { query, limit }, async () => {
    // CanLII v1 search — public endpoint
    const json = await fetchJson<{ results: Record<string, unknown>[]; total: number }>(
      `https://api.canlii.org/v1/search/en?q=${encodeURIComponent(query)}&limit=${limit}&type=decision`,
      8000,
    );
    return { results: json.results ?? [], total: json.total ?? 0 };
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

export async function searchCkan(query: string, limit = 10): Promise<{ results: Record<string, unknown>[]; total: number }> {
  return cached('ckan', { query, limit }, async () => {
    const json = await fetchJson<{ result: { results: Record<string, unknown>[]; total: number } }>(
      `https://ouvert.canada.ca/data/api/3/action/package_search?q=${encodeURIComponent(query)}&rows=${limit}`,
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

export async function fetchProvincialData(province: string, query: string, limit = 10): Promise<{ results: Record<string, unknown>[]; total: number }> {
  const prov = province.toLowerCase();
  // Socrata provinces
  if (prov === 'ns' || prov === 'novascotia') {
    try { const r = await searchSocrata('novascotia', query, limit); if (r.total > 0) return r; } catch {}
  }
  if (prov === 'nb' || prov === 'newbrunswick') {
    try { const r = await searchSocrata('newbrunswick', query, limit); if (r.total > 0) return r; } catch {}
  }
  // CKAN provinces (try provincial portal first, fall back to federal CKAN)
  try {
    const r = await fetchProvincialCkan(prov, query, limit);
    if (r.total > 0) return r;
  } catch {}
  // Federal CKAN fallback
  const { searchCkan } = await import('./upstream-fetcher.js');
  try { return await searchCkan(query + ' ' + province, limit); } catch { return { results: [], total: 0 }; }
}

// ── Provincial CKAN endpoints ──────────────────────────────────────

const PROVINCIAL_CKAN: Record<string, string> = {
  qc: 'https://www.donneesquebec.ca/api/3/action/package_search?q=',
  bc: 'https://catalogue.data.gov.bc.ca/api/3/action/package_search?q=',
  yt: 'https://open.yukon.ca/api/3/action/package_search?q=',
  on: 'https://data.ontario.ca/api/3/action/package_search?q=',
  nl: 'https://opendata.gov.nl.ca/api/3/action/package_search?q=',
  nt: 'https://opendata.gov.nt.ca/api/3/action/package_search?q=',
  ns: 'https://data.novascotia.ca/api/views?q=',
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
    } catch { return { results: [], total: 0 }; }
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
  } catch { return { results: [], total: 0 }; }
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
    } catch { return { results: [], total: 0 }; }
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
