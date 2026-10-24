// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import { CIA_BASE_URL, CIA_TIMEOUT_MS, CIA_THROTTLE, CIA_USER_AGENT } from './constants.js';
import type { CiaRawProfile } from './types.js';

export async function fetchCountryProfile(countryCode: string): Promise<CiaRawProfile | null> {
  const code = countryCode.toLowerCase();
  const url = `${CIA_BASE_URL}/countries/${code}`;
  try {
    const resp = await httpGet(url, {
      timeoutMs: CIA_TIMEOUT_MS,
      headers: { 'User-Agent': CIA_USER_AGENT },
      throttle: CIA_THROTTLE,
    });
    if (resp.statusCode >= 400) return null;
    const body = (await resp.json()) as { data?: CiaRawProfile };
    return body.data ?? null;
  } catch { return null; }
}

export async function fetchMultiCountryProfiles(countryCodes: string[]): Promise<Map<string, CiaRawProfile>> {
  const results = new Map<string, CiaRawProfile>();
  for (const code of countryCodes) {
    try {
      const profile = await fetchCountryProfile(code);
      if (profile) results.set(code.toUpperCase(), profile);
    } catch { /* skip */ }
  }
  return results;
}

export async function fetchFieldComparison(field: string): Promise<Array<{ country: string; value: string | number | null; rank: number | null }>> {
  const url = `${CIA_BASE_URL}/fields/${field}`;
  try {
    const resp = await httpGet(url, {
      timeoutMs: CIA_TIMEOUT_MS,
      headers: { 'User-Agent': CIA_USER_AGENT },
      throttle: CIA_THROTTLE,
    });
    if (resp.statusCode >= 400) return [];
    const body = (await resp.json()) as { data?: Array<{ country: string; value: string | number | null; rank: number | null }> };
    return body.data ?? [];
  } catch { return []; }
}
