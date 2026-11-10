// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Species at Risk Registry Fetcher — Quill
 *
 * Fetches species listing data from the SARA (Species at Risk Act) registry
 * JSON API at https://species-registry.canada.ca/registre-especes/api/v1/
 *
 * Uses undici for HTTP (consistent with the rest of the pipeline).
 */

import { httpGet } from '../../utils/http.js';
import {
  SARA_SOURCES,
  SARA_STATUS_MAP,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_HEADERS,
} from './constants.js';
import type { RawSaraSpecies, SaraApiResponse } from './types.js';
import type { HttpResponse } from '../../utils/http.js';

/* ------------------------------------------------------------------ */
/*  Error Class                                                        */
/* ------------------------------------------------------------------ */

export class SaraFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'SaraFetchError';
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
    throw new SaraFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.json<T>();
}

/* ------------------------------------------------------------------ */
/*  Species Fetching                                                   */
/* ------------------------------------------------------------------ */

/**
 * Fetch a list of SARA species from the JSON API.
 *
 * Supports pagination via the API's built-in page parameter.
 *
 * @param options - Fetch options (page, pageSize, taxonomicGroup, status)
 * @returns Parsed SARA API response
 */
export async function fetchSaraSpecies(
  options: {
    page?: number;
    pageSize?: number;
    taxonomicGroup?: string;
    status?: string;
  } = {},
): Promise<SaraApiResponse> {
  const params = new URLSearchParams();

  if (options.page) params.set('page', String(options.page));
  if (options.pageSize) {
    params.set('pageSize', String(options.pageSize));
  } else {
    params.set('pageSize', String(SARA_SOURCES.PAGE_SIZE));
  }
  if (options.taxonomicGroup) params.set('taxonomicGroup', options.taxonomicGroup);
  if (options.status) params.set('status', options.status);

  const url = `${SARA_SOURCES.API.SPECIES}?${params.toString()}`;

  try {
    const resp = await fetchJson<SaraApiResponse>(url);
    return resp;
  } catch (err) {
    console.warn('[SARA] Species fetch failed:', (err as Error).message);
    return { data: [] };
  }
}

/**
 * Fetch all SARA species across all pages.
 *
 * @param options - Fetch options (taxonomicGroup, status)
 * @returns All species records across all pages
 */
export async function fetchAllSaraSpecies(
  options: {
    taxonomicGroup?: string;
    status?: string;
    maxRecords?: number;
  } = {},
): Promise<RawSaraSpecies[]> {
  const allSpecies: RawSaraSpecies[] = [];
  let page = 1;
  const maxRecords = options.maxRecords ?? 1000;

  while (allSpecies.length < maxRecords) {
    const resp = await fetchSaraSpecies({
      page,
      pageSize: SARA_SOURCES.PAGE_SIZE,
      taxonomicGroup: options.taxonomicGroup,
      status: options.status,
    });

    if (!resp.data || resp.data.length === 0) break;

    allSpecies.push(...resp.data);
    page++;

    // If we got fewer results than page size, we've reached the end
    if (resp.data.length < SARA_SOURCES.PAGE_SIZE) break;
  }

  return allSpecies.slice(0, maxRecords);
}

/**
 * Fetch a single SARA species by ID.
 *
 * @param speciesId - SARA species UUID
 * @returns Raw species data or null
 */
export async function fetchSaraSpeciesDetail(
  speciesId: string,
): Promise<RawSaraSpecies | null> {
  const url = `${SARA_SOURCES.API.SPECIES_DETAIL}/${speciesId}`;

  try {
    const resp = await fetchJson<RawSaraSpecies>(url);
    return resp;
  } catch (err) {
    console.warn(`[SARA] Species detail fetch failed for ${speciesId}:`, (err as Error).message);
    return null;
  }
}

/**
 * Fetch recovery strategies from the SARA API.
 *
 * @param options - Fetch options
 * @returns Raw recovery strategy data
 */
export async function fetchSaraRecoveryStrategies(
  options: {
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{ data: RawSaraSpecies[] }> {
  const params = new URLSearchParams();
  if (options.page) params.set('page', String(options.page));
  if (options.pageSize) params.set('pageSize', String(options.pageSize));

  const url = `${SARA_SOURCES.API.RECOVERY_STRATEGIES}?${params.toString()}`;

  try {
    const resp = await fetchJson<{ data: RawSaraSpecies[] }>(url);
    return resp;
  } catch (err) {
    console.warn('[SARA] Recovery strategies fetch failed:', (err as Error).message);
    return { data: [] };
  }
}

/**
 * Fetch listing decisions from the SARA API.
 *
 * @param options - Fetch options
 * @returns Raw listing decision data
 */
export async function fetchSaraListingDecisions(
  options: {
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{ data: RawSaraSpecies[] }> {
  const params = new URLSearchParams();
  if (options.page) params.set('page', String(options.page));
  if (options.pageSize) params.set('pageSize', String(options.pageSize));

  const url = `${SARA_SOURCES.API.LISTING_DECISIONS}?${params.toString()}`;

  try {
    const resp = await fetchJson<{ data: RawSaraSpecies[] }>(url);
    return resp;
  } catch (err) {
    console.warn('[SARA] Listing decisions fetch failed:', (err as Error).message);
    return { data: [] };
  }
}
