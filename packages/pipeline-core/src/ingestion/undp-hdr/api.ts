// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import { UNDP_API_BASE, UNDP_TIMEOUT_MS } from './constants.js';
import type { UndpApiResponse, UndpApiRow } from './types.js';

export async function fetchHdrIndicator(
  indicatorCode: string,
  country?: string,
  yearRange?: string,
): Promise<UndpApiResponse> {
  const url = new URL(`${UNDP_API_BASE}/${indicatorCode.toLowerCase()}`);

  if (country) {
    url.searchParams.set('country', country.toUpperCase());
  }

  if (yearRange) {
    url.searchParams.set('year', yearRange);
  }

  const apiKey = process.env.UNDP_API_KEY;
  if (apiKey) {
    url.searchParams.set('api_key', apiKey);
  }

  const resp = await httpGet(url.toString(), {
    timeoutMs: UNDP_TIMEOUT_MS,
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'MapleSpike-UNDP-HDR/1.0',
    },
  });

  if (resp.statusCode >= 400) {
    throw new Error(`UNDP API returned ${resp.statusCode}: ${resp.body}`);
  }

  const body = await resp.json() as unknown;
  
  if (Array.isArray(body)) {
    return { data: body };
  }

  if (body && typeof body === 'object' && 'data' in body) {
    return body as UndpApiResponse;
  }

  return { data: body as UndpApiRow[] };
}