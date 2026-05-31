// SPDX-License-Identifier: AGPL-3.0-or-later

import { httpGet } from '../../utils/http.js';
import { POLICE_AGENCIES, POLICE_TIMEOUT_MS, POLICE_USER_AGENT } from './constants.js';

export interface PoliceFetchResult {
  city: string;
  province: string;
  rawRecords: Record<string, unknown>[];
  error?: string;
}

export async function fetchPoliceData(city: string): Promise<PoliceFetchResult> {
  const agency = POLICE_AGENCIES.find(a => a.city === city);
  if (!agency) {
    return { city, province: '', rawRecords: [], error: `Unknown city: ${city}` };
  }

  try {
    const resp = await httpGet(agency.url, {
      timeoutMs: POLICE_TIMEOUT_MS,
      headers: { 'User-Agent': POLICE_USER_AGENT },
    });

    if (resp.statusCode >= 400) {
      return { city, province: agency.province, rawRecords: [], error: `HTTP ${resp.statusCode}` };
    }

    const body = await resp.json<Record<string, unknown>>();
    const records = ((body as any)?.result?.records ?? (body as any)?.records ?? []) as Record<string, unknown>[];

    return { city, province: agency.province, rawRecords: records };
  } catch (err) {
    return { city, province: agency.province, rawRecords: [], error: String(err) };
  }
}

export async function fetchAllPoliceAgencies(): Promise<PoliceFetchResult[]> {
  const results: PoliceFetchResult[] = [];
  for (const agency of POLICE_AGENCIES) {
    const result = await fetchPoliceData(agency.city);
    results.push(result);
  }
  return results;
}
