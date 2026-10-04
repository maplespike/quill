/**
 * NPRI (National Pollutant Release Inventory) Fetcher — Quill
 *
 * Fetches NPRI facility pollutant release records from the Government of
 * Canada's open.canada.ca CKAN portal and the ECCC data portal.
 *
 * Primary source:
 *   CKAN API on open.canada.ca — search for NPRI datasets
 *   https://open.canada.ca/data/api/3/action/package_search?q=npri
 *
 * Uses undici for HTTP (consistent with the rest of the pipeline).
 */

import { httpGet } from '../../utils/http.js';
import {
  NPRI_SOURCES,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_HEADERS,
} from './constants.js';
import type { RawNpriCkanPackage, RawNpriRecord } from './types.js';
import type { HttpResponse } from '../../utils/http.js';

import { parseCsvLine } from '../../utils/csv.js';
/* ------------------------------------------------------------------ */
/*  Error Class                                                        */
/* ------------------------------------------------------------------ */

export class NpriFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'NpriFetchError';
  }
}

/* ------------------------------------------------------------------ */
/*  HTTP Helpers                                                       */
/* ------------------------------------------------------------------ */

/**
 * Fetch JSON from a URL.
 */
async function fetchJson<T = unknown>(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const resp: HttpResponse = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new NpriFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.json<T>();
}

/**
 * Fetch raw text from a URL.
 */
async function fetchText(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const resp: HttpResponse = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new NpriFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.body;
}

/* ------------------------------------------------------------------ */
/*  CKAN Response Types                                                */
/* ------------------------------------------------------------------ */

interface CkanPackageSearchResponse {
  success: boolean;
  result: {
    count: number;
    results: RawNpriCkanPackage[];
    facets?: Record<string, unknown>;
  };
  error?: { message?: string };
}

interface CkanPackageShowResponse {
  success: boolean;
  result: RawNpriCkanPackage;
  error?: { message?: string };
}

/* ------------------------------------------------------------------ */
/*  CKAN Search                                                        */
/* ------------------------------------------------------------------ */

/**
 * Search the open.canada.ca CKAN for NPRI-related packages.
 *
 * @param query - CKAN search query (default: NPRI query)
 * @param rows - Max results per page
 * @param orgFilter - Optional CKAN organization name to filter by department
 * @returns Array of matching CKAN packages
 */
export async function searchNpriCkanPackages(
  query: string = NPRI_SOURCES.NPRI_CKAN_QUERY,
  rows: number = 50,
  orgFilter?: string,
): Promise<RawNpriCkanPackage[]> {
  let url = `${NPRI_SOURCES.CKAN.PACKAGE_SEARCH}?q=${encodeURIComponent(query)}&rows=${rows}&sort=metadata_modified desc`;

  if (orgFilter) {
    url += `&fq=organization:${encodeURIComponent(orgFilter)}`;
  }

  try {
    const resp = await fetchJson<CkanPackageSearchResponse>(url);

    if (!resp.success || !resp.result?.results) {
      if (resp.error?.message) {
        console.warn('[NPRI] CKAN search error:', resp.error.message);
      }
      return [];
    }

    return resp.result.results;
  } catch (err) {
    console.warn('[NPRI] CKAN search failed:', (err as Error).message);
    return [];
  }
}

/**
 * Fetch a specific CKAN package by ID.
 *
 * @param packageId - CKAN package UUID
 * @returns Raw CKAN package data
 */
export async function fetchNpriCkanPackage(
  packageId: string,
): Promise<RawNpriCkanPackage | null> {
  const url = `${NPRI_SOURCES.CKAN.PACKAGE_SHOW}?id=${packageId}`;

  try {
    const resp = await fetchJson<CkanPackageShowResponse>(url);

    if (!resp.success || !resp.result) {
      return null;
    }

    return resp.result;
  } catch (err) {
    console.warn(`[NPRI] CKAN package fetch failed for ${packageId}:`, (err as Error).message);
    return null;
  }
}

/**
 * Fetch NPRI data from a CKAN resource URL (CSV or JSON).
 *
 * @param resourceUrl - URL of the CKAN resource
 * @returns Raw text content
 */
export async function fetchNpriResource(
  resourceUrl: string,
): Promise<string> {
  return fetchText(resourceUrl);
}

/* ------------------------------------------------------------------ */
/*  Main Fetch Entry Points                                            */
/* ------------------------------------------------------------------ */

/**
 * Fetch NPRI releases for a specific substance or facility.
 *
 * Strategy:
 *   1. Search CKAN for NPRI packages
 *   2. Parse CSV/JSON resources from matched packages
 *
 * @param options - Fetch options
 * @returns Raw NPRI records + source metadata
 */
export async function fetchNpriReleases(
  options: {
    fiscalYear?: string;
    province?: string;
    limit?: number;
  } = {},
): Promise<{
  records: RawNpriRecord[];
  source: string;
  errors: string[];
}> {
  const errors: string[] = [];
  let records: RawNpriRecord[] = [];
  let source = 'none';

  try {
    const query = options.fiscalYear
      ? `npri ${options.fiscalYear} pollutant release inventory`
      : NPRI_SOURCES.NPRI_CKAN_QUERY;

    const packages = await searchNpriCkanPackages(query, 50, 'environment-and-climate-change-canada');

    if (packages.length > 0) {
      source = 'ckan';
      records.push(...packages.map(pkg => npriCkanPackageToRaw(pkg)));

      // Try to fetch CSV resources from packages for detailed data
      for (const pkg of packages) {
        for (const resource of pkg.resources ?? []) {
          if (resource.format?.toUpperCase() === 'CSV' || resource.format?.toUpperCase() === 'JSON') {
            try {
              const csvText = await fetchNpriResource(resource.url);
              const csvRecords = parseNpriCsvToRaw(csvText, resource.url);
              records.push(...csvRecords);
            } catch (err) {
              errors.push(`NPRI resource fetch failed for ${resource.url}: ${(err as Error).message}`);
            }
          }
        }
      }
    }
  } catch (err) {
    errors.push(`NPRI CKAN search failed: ${(err as Error).message}`);
  }

  if (options.limit && records.length > options.limit) {
    records = records.slice(0, options.limit);
  }

  return { records, source, errors };
}

/**
 * Fetch all NPRI releases across multiple years/provinces.
 *
 * @param options - Fetch options
 * @returns Results grouped by source
 */
export async function fetchAllNpriReleases(
  options: {
    fiscalYears?: string[];
    limit?: number;
  } = {},
): Promise<{
  records: RawNpriRecord[];
  source: string;
  errors: string[];
}> {
  return fetchNpriReleases({
    limit: options.limit,
  });
}

/* ------------------------------------------------------------------ */
/*  Parsing Helpers (within fetcher)                                   */
/* ------------------------------------------------------------------ */

/**
 * Convert a CKAN package to a raw NPRI record.
 */
function npriCkanPackageToRaw(
  pkg: RawNpriCkanPackage,
): RawNpriRecord {
  return {
    sourceUrl: `${NPRI_SOURCES.CKAN.BASE}/dataset/${pkg.name}`,
    ckanPackageId: pkg.id,
    sourceSystem: 'open-canada-ckan',
    facilityName: pkg.title,
    substanceName: pkg.title,
    fiscalYear: extractFiscalYear(pkg.title) || extractFiscalYear(pkg.notes ?? '') || '',
  };
}

/**
 * Parse a CSV resource from a CKAN NPRI package into raw records.
 * NPRI CSVs typically have columns for facility, substance, release quantities.
 */
function parseNpriCsvToRaw(
  csvText: string,
  sourceUrl: string,
): RawNpriRecord[] {
  const results: RawNpriRecord[] = [];
  const lines = csvText.split('\n').filter(line => line.trim().length > 0);

  if (lines.length < 2) return results;

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const record: RawNpriRecord = {
      sourceUrl,
      sourceSystem: 'ckan-csv',
    };

    headers.forEach((header, idx) => {
      const value = values[idx] ?? '';
      const normalizedHeader = header
        .replace(/[\s-]+/g, '_')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .toLowerCase();

      switch (normalizedHeader) {
        case 'facility_name':
        case 'facilityname':
        case 'company_name':
        case 'facility':
          record.facilityName = value;
          break;
        case 'facility_location':
        case 'city':
        case 'municipality':
          record.facilityLocation = value;
          break;
        case 'province':
        case 'province_territory':
        case 'prov':
          record.province = value.toUpperCase();
          break;
        case 'latitude':
        case 'lat':
          record.latitude = value;
          break;
        case 'longitude':
        case 'lon':
        case 'lng':
          record.longitude = value;
          break;
        case 'substance_name':
        case 'substancename':
        case 'pollutant':
        case 'chemical':
          record.substanceName = value;
          break;
        case 'cas':
        case 'cas_number':
        case 'cas_registry':
        case 'substance_cas':
          record.substanceCas = value;
          break;
        case 'release_air_kg':
        case 'air_release_kg':
        case 'release_to_air_kg':
        case 'air_emissions_kg':
          record.releaseAirKg = value;
          break;
        case 'release_water_kg':
        case 'water_release_kg':
        case 'release_to_water_kg':
        case 'water_emissions_kg':
          record.releaseWaterKg = value;
          break;
        case 'release_land_kg':
        case 'land_release_kg':
        case 'release_to_land_kg':
        case 'land_emissions_kg':
          record.releaseLandKg = value;
          break;
        case 'disposal_kg':
        case 'off_site_disposal_kg':
        case 'disposal_quantity_kg':
          record.disposalKg = value;
          break;
        case 'recycling_kg':
        case 'off_site_recycling_kg':
        case 'recycling_quantity_kg':
          record.recyclingKg = value;
          break;
        case 'fiscal_year':
        case 'reporting_year':
        case 'year':
        case 'report_year':
          record.fiscalYear = value;
          break;
        case 'reported_by':
        case 'parent_company':
        case 'company':
        case 'owner':
          record.reportedBy = value;
          break;
        default:
          record[normalizedHeader] = value;
          break;
      }
    });

    results.push(record);
  }

  return results;
}



/**
 * Extract a 4-digit year from text.
 */
function extractFiscalYear(text: string | null): string | null {
  if (!text) return null;
  const yearPattern = /\b(20\d{2})\b/;
  const yearMatch = text.match(yearPattern);
  return yearMatch ? yearMatch[1] : null;
}
