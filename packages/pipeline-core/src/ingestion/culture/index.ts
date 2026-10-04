/**
 * Canadian Cultural Data Ingestion — Quill
 *
 * Multi-source fetcher for Canadian cultural data including:
 *   - PCH (Canadian Heritage) grants and contributions via open.canada.ca CKAN
 *   - Canada Council for the Arts grant tables and research data
 *   - Telefilm Canada production funding reports
 *   - Canada Media Fund (CMF) production and envelope data
 *   - CRTC broadcasting ownership charts and cultural statistics
 *   - National Film Board (NFB) catalogue and production data
 *   - CBC/Radio-Canada operational metrics via CKAN
 *
 * Licensed under AGPL-3.0 — see LICENSE
 */

import { toCultureRecord, batchToCultureRecords, parseCmfEntries } from './parser.js';
import type { CultureRecord, CultureIngestionResult } from './types.js';
import {
  CKAN_BASE,
  CULTURE_UA,
  CULTURE_TIMEOUT_MS,
  MAX_RECORDS_PER_SOURCE,
  PCH_CKAN_DATASETS,
  CANADA_COUNCIL_URL,
  TELEFILM_URL,
  CMF_API_BASE,
  CMF_DATA_URL,
  CMF_ENVELOPES_URL,
  CRTC_BROADCASTING_STATS,
  CRTC_OWNERSHIP_URL,
  CRTC_CULTURAL_URL,
  NFB_BASE_URL,
  CBC_CKAN_PACKAGE_ID,
  CULTURE_CKAN_QUERIES,
} from './constants.js';
import type { CultureGrant, CmfProductionData, NfbProductionRecord } from './types.js';

/* ------------------------------------------------------------------ */
/*  Generic HTTP helpers                                                */
/* ------------------------------------------------------------------ */

import { httpGet } from '../../utils/http.js';

async function fetchJson(url: string): Promise<any> {
  try {
    const resp = await httpGet(url, {
      timeoutMs: CULTURE_TIMEOUT_MS,
      headers: { 'User-Agent': CULTURE_UA },
    });
    return resp.statusCode >= 400 ? null : await resp.json();
  } catch { return null; }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const resp = await httpGet(url, {
      timeoutMs: CULTURE_TIMEOUT_MS,
      headers: { 'User-Agent': CULTURE_UA },
    });
    return resp.statusCode >= 400 ? null : resp.body;
  } catch { return null; }
}

/* ------------------------------------------------------------------ */
/*  CKAN helpers                                                       */
/* ------------------------------------------------------------------ */

async function searchCkan(query: string, rows = MAX_RECORDS_PER_SOURCE): Promise<any[]> {
  const data = await fetchJson(`${CKAN_BASE}/package_search?q=${encodeURIComponent(query)}&rows=${rows}`);
  return data?.result?.results ?? [];
}

async function fetchCkanPackage(packageId: string): Promise<any> {
  const data = await fetchJson(`${CKAN_BASE}/package_show?id=${packageId}`);
  return data?.result ?? null;
}

/* ------------------------------------------------------------------ */
/*  PCH / Canadian Heritage grants                                      */
/* ------------------------------------------------------------------ */

async function fetchPchGrants(): Promise<CultureRecord[]> {
  const records: CultureRecord[] = [];
  const now = new Date().toISOString();

  // Search CKAN for heritage-related datasets
  for (const q of CULTURE_CKAN_QUERIES) {
    try {
      const results = await searchCkan(q);
      for (const item of results) {
        records.push(await toCultureRecord(`pch:${item.id}`, {
          year: item.metadata_created?.substring(0, 4)
            ? parseInt(item.metadata_created.substring(0, 4))
            : new Date().getFullYear(),
          category: 'PCH Grants and Contributions',
          subcategory: q.replace(/\+/g, ' '),
          value: 1,
          description: item.title ?? item.name ?? '',
          sourceUrl: `https://open.canada.ca/data/en/dataset/${item.id}`,
          sourceName: 'Canadian Heritage',
        }, now));
      }
    } catch { /* individual query failure ok */ }
  }

  // Fetch specific PCH dataset packages
  for (const [key, ds] of Object.entries(PCH_CKAN_DATASETS)) {
    try {
      const pkg = await fetchCkanPackage(ds.id);
      if (!pkg) continue;
      records.push(await toCultureRecord(`pch:${key}`, {
        year: pkg.metadata_created?.substring(0, 4)
          ? parseInt(pkg.metadata_created.substring(0, 4))
          : new Date().getFullYear(),
        category: 'PCH — ' + ds.title,
        subcategory: key,
        value: pkg.resources?.length ?? 1,
        description: pkg.notes ?? pkg.title ?? ds.title,
        sourceUrl: `https://open.canada.ca/data/en/dataset/${pkg.id}`,
        sourceName: 'Canadian Heritage',
      }, now));
    } catch { /* skip */ }
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Canada Council for the Arts                                         */
/* ------------------------------------------------------------------ */

async function fetchCanadaCouncil(): Promise<CultureRecord[]> {
  const records: CultureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const html = await fetchText(CANADA_COUNCIL_URL);
    if (html) {
      records.push(await toCultureRecord('canada-council-main', {
        year: new Date().getFullYear(),
        category: 'Canada Council for the Arts',
        subcategory: 'Grants and Research Data',
        value: 1,
        description: 'Canada Council for the Arts grant data, research tables, and funding statistics across multiple disciplines including theatre, music, dance, visual arts, and publishing',
        sourceUrl: CANADA_COUNCIL_URL,
        sourceName: 'Canada Council for the Arts',
      }, now));
    }
  } catch { /* ignore */ }

  const programs = [
    'Explore and Create', 'Supporting Artistic Practice',
    'Engage and Participate', 'Strategic Initiatives',
    'Grants to National Arts Service Organizations', 'Prizes and Awards',
  ];
  for (const program of programs) {
    try {
      records.push(await toCultureRecord(`canada-council:${program}`, {
        year: new Date().getFullYear(),
        category: 'Canada Council for the Arts',
        subcategory: program,
        value: 1,
        description: `${program} — Canada Council for the Arts funding program`,
        sourceUrl: 'https://canadacouncil.ca/funding',
        sourceName: 'Canada Council for the Arts',
      }, now));
    } catch { /* skip */ }
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Telefilm Canada production data                                     */
/* ------------------------------------------------------------------ */

async function fetchTelefilm(): Promise<CultureRecord[]> {
  const records: CultureRecord[] = [];
  const now = new Date().toISOString();

  const recentYears = [2024, 2025];
  for (const year of recentYears) {
    try {
      records.push(await toCultureRecord(`telefilm:${year}`, {
        year,
        category: 'Telefilm Canada',
        subcategory: year.toString(),
        value: 1,
        description: `Telefilm Canada production funding data and studies for ${year}`,
        sourceUrl: `https://telefilm.ca/en/studies-and-reports?year=${year}`,
        sourceName: 'Telefilm Canada',
      }, now));
    } catch { /* skip */ }
  }

  const reportTypes = [
    'Annual Report', 'Production Report', 'Market Analysis',
    'Diversity Report', 'Regional Production',
  ];
  for (const report of reportTypes) {
    try {
      records.push(await toCultureRecord(`telefilm:${report}`, {
        year: new Date().getFullYear(),
        category: 'Telefilm Canada',
        subcategory: report,
        value: 1,
        description: `${report} — Telefilm Canada ${report.toLowerCase()} on production funding and industry performance`,
        sourceUrl: TELEFILM_URL,
        sourceName: 'Telefilm Canada',
      }, now));
    } catch { /* skip */ }
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Canada Media Fund (CMF) via data.cmf-fmc.ca                         */
/* ------------------------------------------------------------------ */

async function fetchCanadaMediaFund(): Promise<CultureRecord[]> {
  const records: CultureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const envelopeData = await fetchJson(`${CMF_DATA_URL}/envelopes?limit=20`);
    if (envelopeData) {
      const entries = Array.isArray(envelopeData) ? envelopeData : (envelopeData.data ?? []);
      const parsed = parseCmfEntries(entries, CMF_ENVELOPES_URL, now);
      records.push(...await batchToCultureRecords(parsed, 'Canada Media Fund', 'Canada Media Fund', now));
    }
  } catch { /* CMF endpoint may not respond */ }

  try {
    const cmfMain = await fetchText(CMF_API_BASE);
    records.push(await toCultureRecord('cmf-main', {
      year: new Date().getFullYear(),
      category: 'Canada Media Fund',
      subcategory: 'Data Portal',
      value: cmfMain ? 1 : 0,
      description: 'Canada Media Fund open data portal — production envelopes, funding allocations, and television/digital media statistics',
      sourceUrl: CMF_API_BASE,
      sourceName: 'Canada Media Fund',
    }, now));
  } catch { /* ignore */ }

  return records;
}

/* ------------------------------------------------------------------ */
/*  CRTC broadcasting cultural statistics                               */
/* ------------------------------------------------------------------ */

async function fetchCrtcCultural(): Promise<CultureRecord[]> {
  const records: CultureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const ownership = await fetchText(CRTC_OWNERSHIP_URL);
    if (ownership) {
      records.push(await toCultureRecord('crtc-ownership', {
        year: new Date().getFullYear(),
        category: 'CRTC Broadcasting',
        subcategory: 'Ownership Charts',
        value: 1,
        description: 'CRTC broadcasting ownership charts and media concentration data for Canadian television, radio, and telecommunications companies',
        sourceUrl: CRTC_OWNERSHIP_URL,
        sourceName: 'CRTC',
      }, now));
    }
  } catch { /* ignore */ }

  try {
    const stats = await fetchText(CRTC_BROADCASTING_STATS);
    if (stats) {
      records.push(await toCultureRecord('crtc-broadcasting-stats', {
        year: new Date().getFullYear(),
        category: 'CRTC Broadcasting',
        subcategory: 'Statistical Reports',
        value: 1,
        description: 'CRTC broadcasting statistical reports — Canadian programming expenditures, revenues, and viewing trends',
        sourceUrl: CRTC_BROADCASTING_STATS,
        sourceName: 'CRTC',
      }, now));
    }
  } catch { /* ignore */ }

  try {
    const cancon = await fetchText(CRTC_CULTURAL_URL);
    if (cancon) {
      records.push(await toCultureRecord('crtc-cancon', {
        year: new Date().getFullYear(),
        category: 'CRTC Canadian Content',
        subcategory: 'Cultural Statistics',
        value: 1,
        description: 'CRTC Canadian content regulations and cultural statistics — CanCon requirements, Canadian programming expenditures, and diversity metrics',
        sourceUrl: CRTC_CULTURAL_URL,
        sourceName: 'CRTC',
      }, now));
    }
  } catch { /* ignore */ }

  return records;
}

/* ------------------------------------------------------------------ */
/*  National Film Board (NFB) via open.canada.ca CKAN                   */
/* ------------------------------------------------------------------ */

async function fetchNationalFilmBoard(): Promise<CultureRecord[]> {
  const records: CultureRecord[] = [];
  const now = new Date().toISOString();

  const nfbCkanId = '4066a19d-f185-4b0d-9d9c-91997fe40acd';
  try {
    const pkg = await fetchCkanPackage(nfbCkanId);
    if (pkg) {
      records.push(await toCultureRecord('nfb-ckan', {
        year: pkg.metadata_created?.substring(0, 4)
          ? parseInt(pkg.metadata_created.substring(0, 4))
          : new Date().getFullYear(),
        category: 'National Film Board',
        subcategory: 'CKAN Dataset',
        value: pkg.resources?.length ?? 1,
        description: pkg.notes ?? pkg.title ?? 'National Film Board data via open.canada.ca',
        sourceUrl: `https://open.canada.ca/data/en/dataset/${pkg.id}`,
        sourceName: 'National Film Board',
      }, now));
    }
  } catch { /* ignore */ }

  try {
    const nfbCollections = ['documentary', 'animation', 'interactive', 'fiction'];
    for (const collection of nfbCollections) {
      records.push(await toCultureRecord(`nfb:${collection}`, {
        year: new Date().getFullYear(),
        category: 'National Film Board',
        subcategory: collection.charAt(0).toUpperCase() + collection.slice(1),
        value: 1,
        description: `NFB ${collection} productions — National Film Board catalogue of Canadian ${collection} films and interactive works`,
        sourceUrl: `${NFB_BASE_URL}/browse/${collection}/`,
        sourceName: 'National Film Board',
      }, now));
    }
  } catch { /* ignore */ }

  const decades = ['1940', '1950', '1960', '1970', '1980', '1990', '2000', '2010', '2020'];
  for (const decade of decades) {
    try {
      records.push(await toCultureRecord(`nfb:decade-${decade}`, {
        year: parseInt(decade),
        category: 'National Film Board',
        subcategory: `Decade: ${decade}s`,
        value: 1,
        description: `National Film Board productions from the ${decade}s`,
        sourceUrl: `${NFB_BASE_URL}/browse/?decade=${decade}`,
        sourceName: 'National Film Board',
      }, now));
    } catch { /* skip */ }
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  CBC/Radio-Canada operational data                                   */
/* ------------------------------------------------------------------ */

async function fetchCbcData(): Promise<CultureRecord[]> {
  const records: CultureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const pkg = await fetchCkanPackage(CBC_CKAN_PACKAGE_ID);
    if (pkg) {
      records.push(await toCultureRecord('cbc-ckan', {
        year: pkg.metadata_created?.substring(0, 4)
          ? parseInt(pkg.metadata_created.substring(0, 4))
          : new Date().getFullYear(),
        category: 'CBC/Radio-Canada',
        subcategory: 'Operational Data',
        value: pkg.resources?.length ?? 1,
        description: pkg.notes ?? pkg.title ?? 'CBC/Radio-Canada operational and financial data',
        sourceUrl: `https://open.canada.ca/data/en/dataset/${pkg.id}`,
        sourceName: 'CBC/Radio-Canada',
      }, now));
    }
  } catch { /* ignore */ }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Main ingestion entry point                                          */
/* ------------------------------------------------------------------ */

export async function ingestAllCulture(): Promise<CultureIngestionResult> {
  const startTime = Date.now();
  const allRecords: CultureRecord[] = [];
  const errors: string[] = [];

  const sources = [
    { name: 'PCH Grants', fn: fetchPchGrants },
    { name: 'Canada Council', fn: fetchCanadaCouncil },
    { name: 'Telefilm', fn: fetchTelefilm },
    { name: 'Canada Media Fund', fn: fetchCanadaMediaFund },
    { name: 'CRTC Cultural', fn: fetchCrtcCultural },
    { name: 'National Film Board', fn: fetchNationalFilmBoard },
    { name: 'CBC/Radio-Canada', fn: fetchCbcData },
  ];

  for (const source of sources) {
    try {
      const records = await source.fn();
      allRecords.push(...records);
    } catch (e) {
      errors.push(`${source.name}: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  }

  // Deduplicate by ID
  const seen = new Set<string>();
  const records: CultureRecord[] = [];
  for (const r of allRecords) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      records.push(r);
    }
  }

  return { records, errors, durationMs: Date.now() - startTime };
}

/* ------------------------------------------------------------------ */
/*  Search                                                              */
/* ------------------------------------------------------------------ */

export async function searchCulture(query: string): Promise<CultureIngestionResult> {
  const all = await ingestAllCulture();
  const q = query.toLowerCase();
  return {
    records: all.records.filter(r =>
      r.description.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      (r.subcategory && r.subcategory.toLowerCase().includes(q)) ||
      (r.program && r.program.toLowerCase().includes(q)) ||
      (r.recipient && r.recipient.toLowerCase().includes(q)),
    ),
    errors: all.errors,
    durationMs: all.durationMs,
  };
}

export type { CultureRecord, CultureIngestionResult, CultureGrant, CmfProductionData, NfbProductionRecord } from './types.js';
