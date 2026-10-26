// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import { UNHCR_API_URL, UNHCR_TIMEOUT_MS, UNHCR_USER_AGENT } from './constants.js';
import type { UnhcrPopulationRecord } from './types.js';

export interface UnhcrFetchResult {
  records: UnhcrPopulationRecord[];
  error?: string;
}

export async function fetchRefugeePopulation(
  countryCode: string,
  year: number,
): Promise<UnhcrFetchResult> {
  try {
    const url = `${UNHCR_API_URL}/population?iso3=${countryCode}&year=${year}`;
    const resp = await httpGet(url, {
      timeoutMs: UNHCR_TIMEOUT_MS,
      headers: { 'User-Agent': UNHCR_USER_AGENT },
    });

    if (resp.statusCode >= 400) {
      return { records: [], error: `HTTP ${resp.statusCode}` };
    }

    const data = (await resp.json()) as UnhcrPopulationRecord[];
    return { records: Array.isArray(data) ? data : [] };
  } catch (err) {
    return { records: [], error: String(err) };
  }
}

export async function fetchAsylumSeekers(
  destinationCountry: string,
): Promise<UnhcrFetchResult> {
  try {
    const url = `${UNHCR_API_URL}/asylum-seekers?dest=${destinationCountry}`;
    const resp = await httpGet(url, {
      timeoutMs: UNHCR_TIMEOUT_MS,
      headers: { 'User-Agent': UNHCR_USER_AGENT },
    });

    if (resp.statusCode >= 400) {
      return { records: [], error: `HTTP ${resp.statusCode}` };
    }

    const data = (await resp.json()) as UnhcrPopulationRecord[];
    return { records: Array.isArray(data) ? data : [] };
  } catch (err) {
    return { records: [], error: String(err) };
  }
}
