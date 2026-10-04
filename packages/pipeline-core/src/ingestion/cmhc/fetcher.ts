/**
 * CMHC (Canada Mortgage and Housing Corporation) Fetcher — Quill
 *
 * Fetches housing market data from CMHC:
 *   - Housing starts, completions, under construction (monthly)
 *   - Vacancy rates (annual rental market survey)
 *   - Rental rates (annual rental market survey)
 *   - Affordability indicators
 *
 * Sources:
 *   - CMHC Housing Market Information web portal
 *   - CMHC open data (CKAN datasets)
 *
 * Uses undici for HTTP (consistent with the rest of the pipeline).
 */

import { httpGet } from '../../utils/http.js';
import {
  CMHC_SOURCES,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_HEADERS,
} from './constants.js';
import type {
  CmhcMetric,
  RawCmhcRecord,
} from './types.js';
import type { HttpResponse } from '../../utils/http.js';

/* ------------------------------------------------------------------ */
/*  Error Class                                                        */
/* ------------------------------------------------------------------ */

export class CmhcFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
    public readonly metric?: CmhcMetric,
  ) {
    super(message);
    this.name = 'CmhcFetchError';
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
    headers: { ...DEFAULT_HEADERS, Accept: 'application/json' },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new CmhcFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.json<T>();
}

/**
 * Fetch CSV text from a URL.
 */
async function fetchCsv(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const resp: HttpResponse = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS, Accept: 'text/csv' },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new CmhcFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.body;
}

/* ------------------------------------------------------------------ */
/*  CKAN Fetch Helpers                                                 */
/* ------------------------------------------------------------------ */

/**
 * Fetch a CKAN package search result.
 */
async function fetchCkanSearch(query: string): Promise<{ results?: Array<Record<string, unknown>> }> {
  const url = `${CMHC_SOURCES.CKAN_API}/package_search?q=${encodeURIComponent(query)}`;
  return fetchJson<{ result?: { results?: Array<Record<string, unknown>> } }>(url)
    .then(r => r.result ?? { results: [] });
}

/**
 * Fetch a CKAN package show result.
 */
async function fetchCkanPackage(packageId: string): Promise<Record<string, unknown> | null> {
  const url = `${CMHC_SOURCES.CKAN_API}/package_show?id=${encodeURIComponent(packageId)}`;
  const resp = await fetchJson<{ result?: Record<string, unknown>; success?: boolean }>(url);
  return resp.success ? (resp.result ?? null) : null;
}

/* ------------------------------------------------------------------ */
/*  Fetch Functions — by Metric                                        */
/* ------------------------------------------------------------------ */

/**
 * Fetch housing starts data from CMHC.
 *
 * @param year - Filter by year (optional)
 * @param options - Fetch options
 * @returns Raw records and any errors
 */
export async function fetchCmhcHousingStarts(
  year?: number,
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<{ records: RawCmhcRecord[]; errors: string[] }> {
  const errors: string[] = [];

  try {
    // Attempt to fetch via CMHC CKAN
    const pkg = await fetchCkanPackage(CMHC_SOURCES.CKAN_PACKAGE_IDS.HOUSING_STARTS);
    if (pkg) {
      // CKAN package found — actual data parsing is TBD; return empty for now
      return { records: [], errors };
    }

    return { records: [], errors };
  } catch (err) {
    const msg = `CMHC housing starts fetch failed: ${(err as Error).message}`;
    errors.push(msg);
    return { records: [], errors };
  }
}

/**
 * Fetch vacancy rate data from CMHC.
 *
 * @param year - Filter by year (optional)
 * @param options - Fetch options
 * @returns Raw records and any errors
 */
export async function fetchCmhcVacancyRates(
  year?: number,
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<{ records: RawCmhcRecord[]; errors: string[] }> {
  const errors: string[] = [];

  try {
    const pkg = await fetchCkanPackage(CMHC_SOURCES.CKAN_PACKAGE_IDS.VACANCY_RATES);
    if (pkg) {
      // CKAN package found — actual data parsing is TBD; return empty for now
      return { records: [], errors };
    }

    return { records: [], errors };
  } catch (err) {
    const msg = `CMHC vacancy rates fetch failed: ${(err as Error).message}`;
    errors.push(msg);
    return { records: [], errors };
  }
}

/**
 * Fetch rental rate data from CMHC.
 *
 * @param year - Filter by year (optional)
 * @param options - Fetch options
 * @returns Raw records and any errors
 */
export async function fetchCmhcRentalRates(
  year?: number,
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<{ records: RawCmhcRecord[]; errors: string[] }> {
  const errors: string[] = [];

  try {
    const pkg = await fetchCkanPackage(CMHC_SOURCES.CKAN_PACKAGE_IDS.RENTAL_MARKET);
    if (pkg) {
      // CKAN package found — actual data parsing is TBD; return empty for now
      return { records: [], errors };
    }

    return { records: [], errors };
  } catch (err) {
    const msg = `CMHC rental rates fetch failed: ${(err as Error).message}`;
    errors.push(msg);
    return { records: [], errors };
  }
}

/**
 * Fetch housing affordability data from CMHC.
 *
 * @param year - Filter by year (optional)
 * @param options - Fetch options
 * @returns Raw records and any errors
 */
export async function fetchCmhcAffordability(
  year?: number,
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<{ records: RawCmhcRecord[]; errors: string[] }> {
  const errors: string[] = [];

  try {
    const pkg = await fetchCkanPackage(CMHC_SOURCES.CKAN_PACKAGE_IDS.AFFORDABILITY);
    if (pkg) {
      // CKAN package found — actual data parsing is TBD; return empty for now
      return { records: [], errors };
    }

    return { records: [], errors };
  } catch (err) {
    const msg = `CMHC affordability fetch failed: ${(err as Error).message}`;
    errors.push(msg);
    return { records: [], errors };
  }
}

/* ------------------------------------------------------------------ */
/*  Orchestrated Fetch                                                 */
/* ------------------------------------------------------------------ */

/**
 * Fetch CMHC records for a given metric type.
 *
 * @param metric - The metric type to fetch
 * @param year - Year filter (optional)
 * @param options - Fetch options
 * @returns Raw records and any errors
 */
export async function fetchCmhcData(
  metric: CmhcMetric,
  year?: number,
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<{ records: RawCmhcRecord[]; errors: string[] }> {
  switch (metric) {
    case 'housing_starts':
      return fetchCmhcHousingStarts(year, options);
    case 'vacancy_rate':
      return fetchCmhcVacancyRates(year, options);
    case 'rental_rate':
      return fetchCmhcRentalRates(year, options);
    case 'affordability':
      return fetchCmhcAffordability(year, options);
    default:
      return { records: [], errors: [`Unknown CMHC metric: ${metric}`] };
  }
}

/**
 * Fetch CMHC metadata from CKAN for all known dataset IDs.
 */
export async function fetchCmhcCkanMetadata(): Promise<{
  packages: Record<string, Record<string, unknown> | null>;
  errors: string[];
}> {
  const errors: string[] = [];
  const packages: Record<string, Record<string, unknown> | null> = {};

  for (const [key, pkgId] of Object.entries(CMHC_SOURCES.CKAN_PACKAGE_IDS)) {
    try {
      packages[key] = await fetchCkanPackage(pkgId);
    } catch (err) {
      errors.push(`CKAN package ${pkgId} fetch failed: ${(err as Error).message}`);
      packages[key] = null;
    }
  }

  return { packages, errors };
}
