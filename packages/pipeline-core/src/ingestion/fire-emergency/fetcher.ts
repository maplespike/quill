// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import { FIRE_DEPARTMENTS, FIRE_TIMEOUT_MS, FIRE_USER_AGENT } from './constants.js';

interface CkanResponse {
  result?: { records?: Record<string, unknown>[] };
  records?: Record<string, unknown>[];
}

export interface FireFetchResult {
  city: string;
  province: string;
  rawRecords: Record<string, unknown>[];
  error?: string;
}

export async function fetchFireIncidents(city: string): Promise<FireFetchResult> {
  const dept = FIRE_DEPARTMENTS.find(d => d.city === city);
  if (!dept) {
    return { city, province: '', rawRecords: [], error: `Unknown city: ${city}` };
  }

  try {
    const resp = await httpGet(dept.url, {
      timeoutMs: FIRE_TIMEOUT_MS,
      headers: { 'User-Agent': FIRE_USER_AGENT },
    });

    if (resp.statusCode >= 400) {
      return { city, province: dept.province, rawRecords: [], error: `HTTP ${resp.statusCode}` };
    }

    const body = (await resp.json()) as CkanResponse;
    const records = body?.result?.records ?? body?.records ?? [];
    return { city, province: dept.province, rawRecords: records };
  } catch (err) {
    return { city, province: dept.province, rawRecords: [], error: String(err) };
  }
}

export async function fetchAllFireDepartments(): Promise<FireFetchResult[]> {
  const results: FireFetchResult[] = [];
  for (const dept of FIRE_DEPARTMENTS) {
    const result = await fetchFireIncidents(dept.city);
    results.push(result);
  }
  return results;
}
