// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import {
  WGI_BASE_URL,
  WGI_TIMEOUT_MS,
  WGI_PER_PAGE,
  WGI_USER_AGENT,
} from './constants.js';

export async function fetchCountryIndicator(
  countryCode: string,
  indicatorCode: string,
  dateRange?: string,
  perPage?: number,
): Promise<any[]> {
  const url = new URL(`${WGI_BASE_URL}/country/${countryCode}/indicator/${indicatorCode}`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('per_page', String(perPage ?? WGI_PER_PAGE));
  url.searchParams.set('date', dateRange ?? '2000:2025');

  const resp = await httpGet(url.toString(), {
    timeoutMs: WGI_TIMEOUT_MS,
    headers: { 'User-Agent': WGI_USER_AGENT },
  });

  if (resp.statusCode >= 400) {
    return [];
  }

  const body = await resp.json() as any;
  if (!Array.isArray(body) || body.length < 2 || !body[1]) {
    return [];
  }

  return body[1];
}

export async function fetchMultiCountryIndicator(
  countryCodes: string[],
  indicatorCode: string,
  dateRange?: string,
): Promise<Map<string, any[]>> {
  const results = new Map<string, any[]>();

  for (const country of countryCodes) {
    try {
      const data = await fetchCountryIndicator(country, indicatorCode, dateRange);
      if (data.length > 0) {
        results.set(country, data);
      }
    } catch {
      // skip failed fetches
    }
  }

  return results;
}

export async function fetchCountryAllIndicators(
  countryCode: string,
  indicatorCodes: string[],
  dateRange?: string,
): Promise<Map<string, any[]>> {
  const results = new Map<string, any[]>();

  const fetches = indicatorCodes.map(async (indicator) => {
    try {
      const data = await fetchCountryIndicator(countryCode, indicator, dateRange);
      if (data.length > 0) {
        results.set(indicator, data);
      }
    } catch {
      // skip failed fetches
    }
  });

  await Promise.all(fetches);
  return results;
}
