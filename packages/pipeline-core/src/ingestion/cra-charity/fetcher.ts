// SPDX-License-Identifier: AGPL-3.0-only
/**
 * CRA Charity T3010 Fetcher — Quill
 *
 * HTTP fetcher for the CRA List of Charities open data on open.canada.ca.
 * Downloads identification, financial data, and charitable programs CSVs
 * for a given year using CKAN API discovery.
 *
 * Uses undici for cross-platform HTTP (Node, Workers, Bun).
 *
 * Sources:
 *   - CKAN: https://open.canada.ca/data/api/3/action/package_show?id={PACKAGE_ID}
 *   - CSV:  https://open.canada.ca/data/dataset/{PKG_ID}/resource/{RES_ID}/download/{filename}
 *
 * The CRA charity data is published yearly from 1991 through 2024.
 * Each year has multiple CSV files that need to be joined by BN.
 */

import { httpGet } from '../../utils/http.js';
import {
  CRA_CKAN,
  CRA_RESOURCE_PATTERNS,
  CRA_CHARITY_PACKAGE_IDS,
  CRA_DEFAULT_YEAR,
  ckanPackageUrl,
  ckanDownloadUrl,
} from './constants.js';


export class CraCharityFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'CraCharityFetchError';
  }
}


const DEFAULT_HEADERS = {
  'User-Agent': 'MapleSpike/0.1 (civic-tech; mailto:hello@maplespike.ca)',
  Accept: 'text/csv,application/json,text/plain,*/*',
} as const;


/* ------------------------------------------------------------------ */
/*  CKAN Metadata Types                                                */
/* ------------------------------------------------------------------ */

export interface CkanResource {
  id: string;
  name: string;
  description: string | null;
  format: string;
  url: string;
  created: string;
  last_modified: string;
}

export interface CkanPackageResponse {
  id: string;
  title: string;
  notes: string | null;
  resources: CkanResource[];
  organization: { name: string; title: string } | null;
}

export interface CraCharityResources {
  /** CKAN package ID for the year */
  packageId: string;
  /** Dataset year */
  year: string;

  /** Identification CSV resource */
  identResource: CkanResource | null;
  /** Financial data CSV resource */
  financialResource: CkanResource | null;
  /** General information CSV resource */
  generalInfoResource: CkanResource | null;
  /** Charitable programs CSV resource */
  programsResource: CkanResource | null;
}


/* ------------------------------------------------------------------ */
/*  Generic Fetch Helpers                                              */
/* ------------------------------------------------------------------ */

/**
 * Fetch raw text from a URL using undici.
 */
export async function fetchUrl(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<{ statusCode: number; body: string; headers: Record<string, string> }> {
  const resp = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS as Record<string, string> },
    timeoutMs: options.timeoutMs ?? 30_000,
  });

  if (resp.statusCode >= 400) {
    throw new CraCharityFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return { statusCode: resp.statusCode, body: resp.body, headers: resp.headers };
}


/* ------------------------------------------------------------------ */
/*  CKAN Metadata Discovery                                            */
/* ------------------------------------------------------------------ */

/**
 * Fetch CKAN package metadata for a given charity dataset year.
 *
 * @param year - Year string (e.g. "2024", "2014"). Uses latest known if omitted.
 * @returns CKAN package metadata
 */
export async function fetchCraCkanMetadata(
  year: string = CRA_DEFAULT_YEAR,
  options: { timeoutMs?: number } = {},
): Promise<CkanPackageResponse> {
  const url = ckanPackageUrl(year);
  const result = await fetchUrl(url, options);

  try {
    const parsed = JSON.parse(result.body);
    if (!parsed.success || !parsed.result) {
      throw new CraCharityFetchError(
        `CKAN API returned error for ${year}: ${parsed.error?.message ?? 'Unknown error'}`,
        undefined,
        url,
      );
    }
    return parsed.result as CkanPackageResponse;
  } catch (err) {
    if (err instanceof CraCharityFetchError) throw err;
    throw new CraCharityFetchError(
      `Failed to parse CKAN metadata for ${year}: ${err instanceof Error ? err.message : String(err)}`,
      undefined,
      url,
    );
  }
}


/**
 * Discover specific CSV resources within a CKAN package for a given year.
 * Matches resource names against known patterns to find the identification
 * and financial data CSVs.
 *
 * @param year - Year to discover resources for
 * @returns Resource descriptors for all matched CSV types
 */
export async function discoverCraResources(
  year: string = CRA_DEFAULT_YEAR,
  options: { timeoutMs?: number } = {},
): Promise<CraCharityResources> {
  const metadata = await fetchCraCkanMetadata(year, options);
  const pkgId = metadata.id;

  const resources: CraCharityResources = {
    packageId: pkgId,
    year,
    identResource: null,
    financialResource: null,
    generalInfoResource: null,
    programsResource: null,
  };

  for (const r of metadata.resources) {
    const name = (r.name || '').trim();
    const format = (r.format || '').toUpperCase();

    if (format !== 'CSV') continue;

    if (CRA_RESOURCE_PATTERNS.IDENTIFICATION.test(name)) {
      resources.identResource = r;
    } else if (CRA_RESOURCE_PATTERNS.FINANCIAL.test(name)) {
      resources.financialResource = r;
    } else if (CRA_RESOURCE_PATTERNS.GENERAL_INFO.test(name)) {
      resources.generalInfoResource = r;
    } else if (CRA_RESOURCE_PATTERNS.PROGRAMS.test(name)) {
      resources.programsResource = r;
    }
  }

  return resources;
}


/* ------------------------------------------------------------------ */
/*  CSV Downloaders                                                    */
/* ------------------------------------------------------------------ */

/**
 * Download the identification CSV for a given year.
 * Contains BN, legal name, operating name, status, category, designation.
 */
export async function fetchCraIdentCsv(
  year: string = CRA_DEFAULT_YEAR,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  let resources: CraCharityResources;

  try {
    resources = await discoverCraResources(year, options);
  } catch (err) {
    // Fallback: try downloading known resource URLs directly
    return fallbackFetch(year, 'ident', options);
  }

  if (!resources.identResource) {
    // Try fallback
    return fallbackFetch(year, 'ident', options);
  }

  // The resource URL might be relative (starts with /data/)
  const url = resolveUrl(resources.identResource.url, resources.packageId, resources.identResource.id);
  const result = await fetchUrl(url, options);
  return result.body;
}


/**
 * Download the financial data CSV for a given year.
 * Contains total revenue, expenses, assets, liabilities, political activities.
 */
export async function fetchCraFinancialCsv(
  year: string = CRA_DEFAULT_YEAR,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  let resources: CraCharityResources;

  try {
    resources = await discoverCraResources(year, options);
  } catch {
    return fallbackFetch(year, 'financial', options);
  }

  if (!resources.financialResource) {
    return fallbackFetch(year, 'financial', options);
  }

  const url = resolveUrl(resources.financialResource.url, resources.packageId, resources.financialResource.id);
  const result = await fetchUrl(url, options);
  return result.body;
}


/**
 * Download the general information CSV (Section A, B, C).
 * Contains fiscal year info and compensation data.
 */
export async function fetchCraGeneralCsv(
  year: string = CRA_DEFAULT_YEAR,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  let resources: CraCharityResources;

  try {
    resources = await discoverCraResources(year, options);
  } catch {
    return fallbackFetch(year, 'general', options);
  }

  if (!resources.generalInfoResource) {
    return fallbackFetch(year, 'general', options);
  }

  const url = resolveUrl(resources.generalInfoResource.url, resources.packageId, resources.generalInfoResource.id);
  const result = await fetchUrl(url, options);
  return result.body;
}


/**
 * Download the charitable programs CSV.
 */
export async function fetchCraProgramsCsv(
  year: string = CRA_DEFAULT_YEAR,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  let resources: CraCharityResources;

  try {
    resources = await discoverCraResources(year, options);
  } catch {
    return fallbackFetch(year, 'programs', options);
  }

  if (!resources.programsResource) {
    return fallbackFetch(year, 'programs', options);
  }

  const url = resolveUrl(resources.programsResource.url, resources.packageId, resources.programsResource.id);
  const result = await fetchUrl(url, options);
  return result.body;
}


/**
 * Fetch all CSV data for a given year (ident, financial, general, programs).
 */
export async function fetchCraAllCsvs(
  year: string = CRA_DEFAULT_YEAR,
  options: { timeoutMs?: number } = {},
): Promise<{
  identCsv: string;
  financialCsv: string;
  generalCsv: string;
  programsCsv: string;
}> {
  const [identCsv, financialCsv, generalCsv, programsCsv] = await Promise.all([
    fetchCraIdentCsv(year, options).catch(() => ''),
    fetchCraFinancialCsv(year, options).catch(() => ''),
    fetchCraGeneralCsv(year, options).catch(() => ''),
    fetchCraProgramsCsv(year, options).catch(() => ''),
  ]);

  return { identCsv, financialCsv, generalCsv, programsCsv };
}


/* ------------------------------------------------------------------ */
/*  Fallback Fetch                                                     */
/* ------------------------------------------------------------------ */

/**
 * Fallback: attempt to download a known-resource URL pattern.
 * The CRA data uses predictable URL patterns for each year.
 *
 * Pattern: https://open.canada.ca/data/dataset/{PKG_ID}/resource/{RES_ID}/download/{filename}
 */
async function fallbackFetch(
  year: string,
  type: 'ident' | 'financial' | 'general' | 'programs',
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const pkgId = CRA_CHARITY_PACKAGE_IDS[year];
  if (!pkgId) {
    throw new CraCharityFetchError(
      `No known CKAN package for year ${year} and no resources discovered for ${type} CSV`,
    );
  }

  // We don't know the resource ID, so fetch the package metadata to find it
  const metadata = await fetchCraCkanMetadata(year, options);

  // Try to find a matching resource by name pattern
  let pattern: RegExp;
  switch (type) {
    case 'ident':     pattern = CRA_RESOURCE_PATTERNS.IDENTIFICATION; break;
    case 'financial': pattern = CRA_RESOURCE_PATTERNS.FINANCIAL; break;
    case 'general':   pattern = CRA_RESOURCE_PATTERNS.GENERAL_INFO; break;
    case 'programs':  pattern = CRA_RESOURCE_PATTERNS.PROGRAMS; break;
  }

  for (const r of metadata.resources) {
    const name = (r.name || '').trim();
    const format = (r.format || '').toUpperCase();
    if (format === 'CSV' && pattern.test(name)) {
      const url = resolveUrl(r.url, pkgId, r.id);
      const result = await fetchUrl(url, options);
      return result.body;
    }
  }

  throw new CraCharityFetchError(
    `Could not find ${type} CSV resource for year ${year}`,
  );
}


/* ------------------------------------------------------------------ */
/*  URL Resolution                                                     */
/* ------------------------------------------------------------------ */

/**
 * Resolve a potentially relative CKAN resource URL to an absolute URL.
 */
function resolveUrl(url: string, packageId: string, resourceId: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Relative URL — construct from CKAN download pattern
  return `${CRA_CKAN.DOWNLOAD_BASE}/${packageId}/resource/${resourceId}/download/${url.split('/').pop() || 'data.csv'}`;
}


/**
 * List all available years for the List of charities datasets.
 */
export async function listAvailableYears(
  options: { timeoutMs?: number } = {},
): Promise<string[]> {
  const searchUrl = `${CRA_CKAN.SEARCH}?q=${CRA_CKAN.CHARITY_QUERY}&rows=50&sort=title_translated+desc`;

  try {
    const result = await fetchUrl(searchUrl, options);
    const parsed = JSON.parse(result.body);
    if (!parsed.success || !parsed.result?.results) return Object.keys(CRA_CHARITY_PACKAGE_IDS);

    const years: string[] = [];
    for (const pkg of parsed.result.results) {
      const title: string = pkg.title || '';
      const match = title.match(/^(\d{4})\s+List/);
      if (match) {
        years.push(match[1]);
      }
    }
    return years.sort().reverse();
  } catch {
    return Object.keys(CRA_CHARITY_PACKAGE_IDS);
  }
}
