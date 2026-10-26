// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import { FAO_API_BASE } from './constants.js';
import type { FaoRecord } from './types.js';
import { parseFaoResponse } from './parser.js';

/**
 * Fetch a dataset from the FAO FAOSTAT REST API.
 * API docs: https://www.fao.org/faostat/en/#data
 */
export async function fetchFaoDataset(
  domainCode: string,
  areaCode?: string,
  year?: number,
): Promise<FaoRecord[]> {
  const params = new URLSearchParams({
    area: areaCode ?? '351', // 351 = Canada
    area_cs: 'FAO',
    show_codes: 'true',
    show_unit: 'true',
    show_flags: 'true',
    null_values: 'false',
  });

  if (year) {
    params.set('year', String(year));
  }

  const url = `${FAO_API_BASE}/data/${domainCode}?${params.toString()}`;

  try {
    const resp = await httpGet(url, { timeoutMs: 30_000 });
    if (resp.statusCode >= 400) {
      console.error(`FAO API error: ${resp.statusCode}`);
      return [];
    }
    const body = await resp.json() as any;
    return parseFaoResponse(body, domainCode);
  } catch (error) {
    console.error(`FAO fetch error (${domainCode}):`, error);
    return [];
  }
}

/**
 * Fetch FAO domain list for discovery.
 */
export async function fetchFaoDomainList(): Promise<any[]> {
  try {
    const resp = await httpGet(`${FAO_API_BASE}/domain`, { timeoutMs: 15_000 });
    if (resp.statusCode >= 400) {
      return [];
    }
    const body = await resp.json() as any;
    return Array.isArray(body) ? body : [];
  } catch (error) {
    console.error('FAO domain list fetch error:', error);
    return [];
  }
}
