// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Government Data API Clients — Quill
 *
 * Fetchers for Canadian open government data sources.
 * Implements StatCan WDS/SDMX and CKAN portals.
 *
 * Originally planned in: docs/plans/2026-05-10-intelligence-upgrade.md
 * Gov data schema: cloudflare/schema.sql (gov_releases_cache table)
 */

import { httpGet } from '../utils/http.js';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface GovRelease {
  source: string;
  title: string;
  description: string | null;
  release_date: string | null;
  data_url: string | null;
  jurisdiction: string;
  category: string | null;
}

export interface CKANPackage {
  id: string;
  title: string;
  notes: string | null;
  url: string | null;
  metadata_created: string;
  metadata_modified: string;
  organization: { name: string; title: string } | null;
}

export interface StatCanRelease {
  productId: string;
  title: string;
  summary: string | null;
  releaseDate: string;
  url: string;
}

/* ------------------------------------------------------------------ */
/*  Statistics Canada WDS REST API                                     */
/* ------------------------------------------------------------------ */

const USER_AGENT = 'MapleSpike/0.2 (+https://maplespike.lan)';
const STATCAN_WDS_BASE = 'https://www150.statcan.gc.ca/t1/wds/rest';

/**
 * Fetch latest releases from Statistics Canada's Web Data Service.
 * Returns normalized GovRelease objects.
 */
export async function fetchStatCanReleases(
  options: { limit?: number } = {},
): Promise<GovRelease[]> {
  const { limit = 25 } = options;

  try {
    // getAllCubesListLite is the current endpoint (getAllCubes deprecated)
    const resp = await httpGet(`${STATCAN_WDS_BASE}/getAllCubesListLite`, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      timeoutMs: 15000,
    });

    if (resp.statusCode === 409) {
      // WDS locked during maintenance window (midnight-8:30 AM ET)
      // Return a minimal set of known key StatCan tables as fallback
      const fallback = [
        { productId: '18100004', cubeTitleEn: 'Consumer Price Index (CPI)', cubeSummaryEn: 'Monthly CPI for Canada, provinces and selected cities', releaseTime: null },
        { productId: '36100114', cubeTitleEn: 'Gross Domestic Product (GDP)', cubeSummaryEn: 'Monthly GDP at basic prices, by industry', releaseTime: null },
        { productId: '14100270', cubeTitleEn: 'Labour Force Survey', cubeSummaryEn: 'Employment and unemployment rates', releaseTime: null },
        { productId: '17100009', cubeTitleEn: 'Population estimates', cubeSummaryEn: 'Population estimates for Canada, provinces and territories', releaseTime: null },
        { productId: '12100090', cubeTitleEn: 'International trade', cubeSummaryEn: 'Merchandise imports and exports', releaseTime: null },
      ];
      return fallback.slice(0, limit).map((c: any) => ({
        source: 'statcan', title: c.cubeTitleEn, description: c.cubeSummaryEn,
        release_date: c.releaseTime, data_url: `https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=${c.productId}`,
        jurisdiction: 'federal', category: classifyStatCanCube(c.productId, c.cubeTitleEn || ''),
      }));
    }
    if (resp.statusCode >= 400) {
      throw new Error(`StatCan WDS error: ${resp.statusCode}`);
    }

    const data: any[] = await resp.json();
    const cubes = (Array.isArray(data) ? data : []).slice(0, limit);

    return cubes
      .filter((c: any) => c.productId && (c.cubeTitleEn || c.title))
      .map((c: any) => ({
        source: 'statcan',
        title: c.cubeTitleEn || c.title || 'Untitled',
        description: c.cubeSummaryEn || c.summary || null,
        release_date: c.releaseTime || c.releaseDate || null,
        data_url: `https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=${c.productId}`,
        jurisdiction: 'federal',
        category: classifyStatCanCube(c.productId, c.cubeTitleEn || c.title || ''),
      }));
  } catch (error) {
    console.error('StatCan fetch failed:', (error as Error).message);
    return [];
  }
}

/** Crude category assignment based on StatCan product ID ranges and title keywords. */
function classifyStatCanCube(productId: string, title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('gdp') || lower.includes('gross domestic') || lower.includes('inflation') || lower.includes('cpi') || lower.includes('trade') || lower.includes('unemployment')) return 'economy';
  if (lower.includes('population') || lower.includes('demographic') || lower.includes('immigration') || lower.includes('census')) return 'demographics';
  if (lower.includes('crime') || lower.includes('justice') || lower.includes('court') || lower.includes('police')) return 'justice';
  if (lower.includes('health') || lower.includes('hospital') || lower.includes('mortality') || lower.includes('covid')) return 'health';
  if (lower.includes('energy') || lower.includes('emission') || lower.includes('environment') || lower.includes('climate')) return 'environment';
  if (lower.includes('education') || lower.includes('school') || lower.includes('student') || lower.includes('graduate')) return 'education';
  if (lower.includes('income') || lower.includes('poverty') || lower.includes('housing') || lower.includes('tax')) return 'social';
  return 'economy';
}

/* ------------------------------------------------------------------ */
/*  CKAN Portal Client                                                 */
/* ------------------------------------------------------------------ */

/**
 * Fetch packages from a CKAN data portal.
 * Works with open.canada.ca, data.ontario.ca, catalogue.data.gov.bc.ca, etc.
 */
export async function fetchCKANPackages(
  portal: string,
  options: { rows?: number; query?: string } = {},
): Promise<CKANPackage[]> {
  const { rows = 20, query = '' } = options;

  const url = `${portal}/api/3/action/package_search?rows=${rows}${query ? `&q=${encodeURIComponent(query)}` : ''}`;

  try {
    const resp = await httpGet(url, {
      timeoutMs: 15000,
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    });

    if (resp.statusCode >= 400) {
      throw new Error(`CKAN error (${portal}): ${resp.statusCode}`);
    }

    const data: any = await resp.json();
    if (!data.success || !data.result?.results) {
      return [];
    }

    return data.result.results.map((p: any) => ({
      id: p.id,
      title: p.title,
      notes: p.notes || null,
      url: (p.resources?.[0]?.url) || null,
      metadata_created: p.metadata_created,
      metadata_modified: p.metadata_modified,
      organization: p.organization
        ? { name: p.organization.name, title: p.organization.title }
        : null,
    }));
  } catch (error) {
    console.error(`CKAN fetch failed (${portal}):`, (error as Error).message);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Non-CKAN Open Data Portal Client (Socrata / ArcGIS / generic)      */
/* ------------------------------------------------------------------ */

export interface OpenDataPortalConfig {
  baseUrl: string | null;
  apiType: 'SOCRATA' | 'ARCGIS' | 'OTHER' | 'NONE';
}

export interface OpenDataPortalDataset {
  source: string;
  title: string;
  description: string | null;
  release_date: string | null;
  data_url: string | null;
  jurisdiction: string;
}

/**
 * Fetch datasets from a non-CKAN open data portal.
 *
 * Handles:
 * - Socrata portals (NS: data.novascotia.ca) via SODA catalog API
 * - ArcGIS Hub portals (PE: data.princeedwardisland.ca) via ArcGIS REST API
 * - Generic stats portals (NT: statsnwt.ca) with fallback extraction
 * - Returns empty array for portals with no known API (NB, NU)
 */
export async function fetchOpenDataPortal(
   source: (typeof GOV_DATA_SOURCES)[number],
   options: { limit?: number } = {},
): Promise<OpenDataPortalDataset[]> {
   const { limit = 20 } = options;

   // Validate source is a known GOV_DATA_SOURCES entry
   const knownSource = GOV_DATA_SOURCES.find(s => s.name === source.name);
   if (!knownSource) {
     throw new Error(`Unknown source: ${(source as any).name ?? source}`);
   }

   if (!source.endpoint || source.api === 'NONE') {
     return [];
   }

   switch (source.api) {
     case 'SOCRATA':
       return fetchSocrataDatasets(source, limit);
     case 'ARCGIS':
       return fetchArcGISDatasets(source, limit);
     case 'OTHER':
     default:
       return fetchGenericPortal(source, limit);
   }
}

/**
 * Fetch datasets from a Socrata-based open data portal using
 * its DCAT-US /data.json catalog endpoint.
 */
async function fetchSocrataDatasets(
  source: (typeof GOV_DATA_SOURCES)[number],
  limit: number,
): Promise<OpenDataPortalDataset[]> {
  try {
    const catalogUrl = `${source.endpoint}/data.json`;
    const resp = await httpGet(catalogUrl, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      timeoutMs: 15000,
    });

    if (resp.statusCode >= 400) {
      throw new Error(`Socrata catalog error (${source.endpoint}): ${resp.statusCode}`);
    }

    const catalog: any = await resp.json();
    const datasets = catalog.dataset || [];

    return datasets.slice(0, limit).map((ds: any) => ({
      source: source.name,
      title: ds.title || ds.accessURL || 'Untitled',
      description: ds.description || null,
      release_date: ds.issued || ds.modified || null,
      data_url: ds.accessURL || ds.landingPage || source.endpoint,
      jurisdiction: source.jurisdiction,
    }));
  } catch (error) {
    console.error(`Socrata fetch failed (${source.endpoint}):`, (error as Error).message);
    return [];
  }
}

/**
 * Fetch datasets from an ArcGIS Hub-based portal using
 * the ArcGIS REST API /search endpoint.
 */
async function fetchArcGISDatasets(
  source: (typeof GOV_DATA_SOURCES)[number],
  limit: number,
): Promise<OpenDataPortalDataset[]> {
  try {
    const searchUrl = `${source.endpoint}/api/search/v1?q=*&size=${limit}`;
    const resp = await httpGet(searchUrl, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      timeoutMs: 15000,
    });

    if (resp.statusCode >= 400) {
      throw new Error(`ArcGIS search error (${source.endpoint}): ${resp.statusCode}`);
    }

    const data: any = await resp.json();
    const results = data.results || [];

    return results.map((item: any) => ({
      source: source.name,
      title: item.title || item.name || 'Untitled',
      description: item.description || item.snippet || null,
      release_date: item.updatedAt || item.createdAt || null,
      data_url: item.url || item.landingPage || source.endpoint,
      jurisdiction: source.jurisdiction,
    }));
  } catch (error) {
    console.error(`ArcGIS fetch failed (${source.endpoint}):`, (error as Error).message);
    return [];
  }
}

/**
 * Generic fallback for portals without a standard API (stats portals, etc.).
 * Returns an empty array by default — subclasses or future enhancements
 * can add scraping logic for specific portals.
 */
async function fetchGenericPortal(
  source: (typeof GOV_DATA_SOURCES)[number],
  _limit: number,
): Promise<OpenDataPortalDataset[]> {
  // NT (statsnwt.ca) is a statistical reporting site, not a dataset portal.
  // No automated data extraction available via REST API.
  return [];
}

/**
 * Returns the appropriate API client for a given government data source.
 */
export function getGovDataSourceClient(
  source: (typeof GOV_DATA_SOURCES)[number],
) {
  if (source.api === 'CKAN') {
    return {
      type: 'CKAN' as const,
      fetch: (opts?: { rows?: number; query?: string }) =>
        fetchCKANPackages(source.endpoint!, opts),
    };
  }

  return {
    type: source.api as string,
    fetch: (opts?: { limit?: number }) =>
      fetchOpenDataPortal(source, opts),
  };
}

/* ------------------------------------------------------------------ */
/*  Source Map                                                         */
/* ------------------------------------------------------------------ */

/**
 * Index of known government data sources.
 * The goal: one API key, every Canadian government dataset,
 * citations on every response.
 */
export const GOV_DATA_SOURCES = [
  // --- Federal ---
  { name: 'Statistics Canada', jurisdiction: 'federal', api: 'WDS', endpoint: STATCAN_WDS_BASE },
  { name: 'Open Government Portal', jurisdiction: 'federal', api: 'CKAN', endpoint: 'https://open.canada.ca/data/en' },

  // --- Provincial CKAN portals (verified 2026-07-01) ---
  { name: 'Ontario Data Catalogue', jurisdiction: 'ontario', api: 'CKAN', endpoint: 'https://data.ontario.ca' },
  { name: 'BC Data Catalogue', jurisdiction: 'bc', api: 'CKAN', endpoint: 'https://catalogue.data.gov.bc.ca' },
  { name: 'Alberta Open Data', jurisdiction: 'alberta', api: 'CKAN', endpoint: 'https://open.alberta.ca' },
  { name: 'Québec Données', jurisdiction: 'quebec', api: 'CKAN', endpoint: 'https://donneesquebec.ca' },
  { name: 'Saskatchewan Open Data', jurisdiction: 'saskatchewan', api: 'NONE', endpoint: null, notes: 'DOMAIN DECOMMISSIONED — data.saskatchewan.ca and dashboard.saskatchewan.ca have no CKAN API. Use federal CKAN cross-reference.' },
  { name: 'Manitoba Open Data', jurisdiction: 'manitoba', api: 'NONE', endpoint: null, notes: 'DOMAIN DECOMMISSIONED — opendata.manitoba.ca and data.gov.mb.ca DNS removed. Use federal CKAN cross-reference.' },
  { name: 'Newfoundland & Labrador Open Data', jurisdiction: 'newfoundland', api: 'CKAN', endpoint: 'https://opendata.gov.nl.ca', notes: 'Provincial CKAN portal' },

  // --- Territorial portals (verified 2026-07-01) ---
  { name: 'Yukon Open Data', jurisdiction: 'yukon', api: 'CKAN', endpoint: 'https://open.yukon.ca', notes: 'CKAN 2.11.5 — 3785 datasets. yukon.ca is Cloudflare-protected but open.yukon.ca API is open.' },

  // --- Provincial portals (non-CKAN) ---
  { name: 'Nova Scotia Open Data', jurisdiction: 'nova-scotia', api: 'SOCRATA', endpoint: 'https://data.novascotia.ca', notes: 'Socrata/SODA API' },
  { name: 'Prince Edward Island Open Data', jurisdiction: 'pei', api: 'ARCGIS', endpoint: 'https://data.princeedwardisland.ca', notes: 'ArcGIS Hub — 92 datasets. Org: peigov, Group: 3f3e0df042854ea59560465cde7987cc' },
  { name: 'New Brunswick Open Data', jurisdiction: 'new-brunswick', api: 'SOCRATA', endpoint: 'https://gnb.socrata.com', notes: 'Socrata/SODA API' },

  // --- Territorial portals (no standard API) ---
  { name: 'NWT Open Data', jurisdiction: 'northwest-territories', api: 'OTHER', endpoint: 'https://www.ece.gov.nt.ca/en/services/open-government-product', notes: 'No CKAN/API — HTML pages only. data files on department sites.' },
  { name: 'Nunavut Open Data', jurisdiction: 'nunavut', api: 'OTHER', endpoint: 'https://www.gov.nu.ca/en/nunavummit-kiglisiniartiit-nunavut-bureau-statistics', notes: 'Cloudflare on HTML pages but data files at /sites/default/files/ are open. Bureau of Statistics: statsbureau@gov.nu.ca' },
];
