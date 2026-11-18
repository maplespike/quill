// SPDX-License-Identifier: AGPL-3.0-only
/**
 * UNHCR Refugee Data Ingestion Module
 *
 * Ingests refugee population and asylum data from UNHCR API.
 * No authentication required - public API.
 *
 * Data includes:
 * - Refugee population stocks by country and year
 * - Asylum applications and decisions
 * - Demographics (age, sex, location)
 * - Solutions (repatriation, resettlement, naturalization)
 *
 * API Documentation: https://api.unhcr.org/docs/refugee-statistics.html
 */

import { httpGet } from '../../utils/http.js';

import type {
  UNHCRPopulationResponse,
  UNHCRAsylumResponse,
  GetRefugeeByCountryResult,
} from './types.js';

const UNHCR_API_BASE = 'https://api.unhcr.org';
const UNHCR_TIMEOUT_MS = 15_000;
const UNHCR_USER_AGENT = 'MapleSpike-UNHCR/1.0 (+https://github.com/reverb256/quill)';

export interface UNHCRModuleMetadata {
  sourcesAttempted: number;
  sourcesSucceeded: number;
  errors: Array<{ source: string; error: string }>;
}

/**
 * Fetch refugee population stocks by country for a given year.
 * @param year - The year to fetch data for (default: latest available)
 * @returns Population data by country
 */
export async function fetchRefugeePopulation(year?: number): Promise<UNHCRPopulationResponse> {
  const url = year
    ? `${UNHCR_API_BASE}/rs/Populations?${year}=${year}&yearTo=${year}`
    : `${UNHCR_API_BASE}/rs/Populations`;

  const resp = await httpGet(url, {
    timeoutMs: UNHCR_TIMEOUT_MS,
    headers: { 'User-Agent': UNHCR_USER_AGENT, 'Accept': 'application/json' },
  });

  if (resp.statusCode >= 400) {
    throw new Error(`UNHCR API error: HTTP ${resp.statusCode}`);
  }

  const data = JSON.parse(resp.body);

  return {
    year: data.year || new Date().getFullYear(),
    refugeeStocks: data.refugeeStocks || [],
    total: data.total || 0,
  };
}

/**
 * Fetch asylum applications and decisions by country for a given year.
 * @param year - The year to fetch data for (default: latest available)
 * @returns Asylum application data by country
 */
export async function fetchAsylumApplications(year?: number): Promise<UNHCRAsylumResponse> {
  const url = year
    ? `${UNHCR_API_BASE}/rs/AsylumSeekers?${year}=${year}&yearTo=${year}`
    : `${UNHCR_API_BASE}/rs/AsylumSeekers`;

  const resp = await httpGet(url, {
    timeoutMs: UNHCR_TIMEOUT_MS,
    headers: { 'User-Agent': UNHCR_USER_AGENT, 'Accept': 'application/json' },
  });

  if (resp.statusCode >= 400) {
    throw new Error(`UNHCR API error: HTTP ${resp.statusCode}`);
  }

  const data = JSON.parse(resp.body);

  return {
    year: data.year || new Date().getFullYear(),
    applications: data.asylumApplications || [],
    total: data.total || 0,
  };
}

/**
 * Get all refugee population data by country.
 * @returns Complete population data for all countries
 */
export async function getAllCountriesPopulation(): Promise<Array<{
  iso3: string;
  countryName: string;
  refugees: number;
  asylumSeekers: number;
  year: number;
}>> {
  const data = await fetchRefugeePopulation();
  return data.refugeeStocks.map((s) => ({ ...s, year: data.year }));
}

/**
 * Get all asylum application data by country.
 * @returns Complete asylum data for all countries
 */
export async function getAllCountriesAsylum(): Promise<Array<{
  iso3: string;
  countryName: string;
  applications: number;
  decisions: number;
  recognized: number;
  year: number;
}>> {
  const data = await fetchAsylumApplications();
  return data.applications.map((a) => ({ ...a, year: data.year }));
}

/**
 * Get refugee data for a specific country.
 * @param iso3 - Country ISO 3 code (e.g., 'CAN', 'USA', 'SYR')
 * @returns Refugee and asylum data for the specified country
 */
export async function getRefugeeByCountry(iso3: string): Promise<GetRefugeeByCountryResult | null> {
  const [population, asylum] = await Promise.all([
    fetchRefugeePopulation(),
    fetchAsylumApplications(),
  ]);

  const countryPopulation = population.refugeeStocks.find(s => s.iso3 === iso3);
  const countryAsylum = asylum.applications.find(a => a.iso3 === iso3);

  if (!countryPopulation && !countryAsylum) {
    return null;
  }

  return {
    countryName: countryPopulation?.countryName || countryAsylum?.countryName || iso3,
    iso3,
    year: population.year,
    refugees: countryPopulation?.refugees || 0,
    asylumSeekers: countryPopulation?.asylumSeekers || 0,
    applications: countryAsylum?.applications || 0,
    decisions: countryAsylum?.decisions || 0,
    recognized: countryAsylum?.recognized || 0,
  };
}

export type {
  GetCanadaRefugeeDataResult,
  GetGlobalRefugeeStatsResult,
  GetRefugeeByCountryResult,
} from './types.js';