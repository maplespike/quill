// SPDX-License-Identifier: AGPL-3.0-or-later

import { httpGet } from '../../utils/http.js';
import {
  WDI_BASE_URL,
  WDI_TIMEOUT_MS,
  WDI_PER_PAGE,
  WDI_USER_AGENT,
} from './constants.js';
import type { WdiApiResponse, WdiIndicatorDatum } from './types.js';

export async function fetchCountryIndicator(
  countryCode: string,
  indicatorCode: string,
): Promise<WdiIndicatorDatum[]> {
  const url = `${WDI_BASE_URL}/country/${countryCode}/indicator/${indicatorCode}?format=json&per_page=${WDI_PER_PAGE}&date=1960:2025`;

  const resp = await httpGet(url, {
    timeoutMs: WDI_TIMEOUT_MS,
    headers: { 'User-Agent': WDI_USER_AGENT },
  });

  if (resp.statusCode >= 400) {
    return [];
  }

  const body = (await resp.json()) as WdiApiResponse;
  if (!Array.isArray(body) || body.length < 2 || !body[1]) {
    return [];
  }

  return body[1];
}

export async function fetchMultiCountryIndicator(
  countryCodes: string[],
  indicatorCode: string,
): Promise<Map<string, WdiIndicatorDatum[]>> {
  const results = new Map<string, WdiIndicatorDatum[]>();

  for (const country of countryCodes) {
    try {
      const data = await fetchCountryIndicator(country, indicatorCode);
      if (data.length > 0) {
        results.set(country, data);
      }
    } catch {
      // Skip countries that fail
    }
  }

  return results;
}

export async function fetchCountryAllIndicators(
  countryCode: string,
  indicatorCodes: string[],
): Promise<Map<string, WdiIndicatorDatum[]>> {
  const results = new Map<string, WdiIndicatorDatum[]>();

  const fetches = indicatorCodes.map(async (indicator) => {
    try {
      const data = await fetchCountryIndicator(countryCode, indicator);
      if (data.length > 0) {
        results.set(indicator, data);
      }
    } catch {
      // Skip failed indicators
    }
  });

  await Promise.all(fetches);
  return results;
}
