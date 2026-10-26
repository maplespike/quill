// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import { WHO_GHO_API_URL, WHO_GHO_TIMEOUT_MS, WHO_GHO_USER_AGENT } from './constants.js';
import type { WhoGhoRawRecord } from './types.js';

export interface WhoGhoFetchResult {
  records: WhoGhoRawRecord[];
  error?: string;
}

export async function fetchIndicatorData(
  indicatorCode: string,
  countryCode?: string,
): Promise<WhoGhoFetchResult> {
  try {
    let url = `${WHO_GHO_API_URL}/${indicatorCode}`;
    if (countryCode) {
      url += `?$filter=SpatialDim eq '${countryCode}'`;
    }
    const resp = await httpGet(url, {
      timeoutMs: WHO_GHO_TIMEOUT_MS,
      headers: { 'User-Agent': WHO_GHO_USER_AGENT },
    });

    if (resp.statusCode >= 400) {
      return { records: [], error: `HTTP ${resp.statusCode}` };
    }

    const data = (await resp.json()) as { value: WhoGhoRawRecord[] };
    return { records: Array.isArray(data?.value) ? data.value : [] };
  } catch (err) {
    return { records: [], error: String(err) };
  }
}

export async function fetchMultipleIndicators(
  indicatorCodes: string[],
  countryCodes?: string[],
): Promise<WhoGhoFetchResult> {
  const allRecords: WhoGhoRawRecord[] = [];
  let errors: string[] = [];

  for (const indicatorCode of indicatorCodes) {
    const countries = countryCodes ?? [''];
    for (const countryCode of countries) {
      const result = await fetchIndicatorData(indicatorCode, countryCode || undefined);
      if (result.error) {
        errors.push(`${indicatorCode}${countryCode ? `/${countryCode}` : ''}: ${result.error}`);
      } else {
        allRecords.push(...result.records);
      }
    }
  }

  return { records: allRecords, error: errors.length ? errors.join('; ') : undefined };
}