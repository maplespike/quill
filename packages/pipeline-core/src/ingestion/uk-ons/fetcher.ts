// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import { ONS_BASE_URL, ONS_TIMEOUT_MS, ONS_THROTTLE, ONS_USER_AGENT } from './constants.js';
import type { OnsTimeseriesData, OnsDatasetResult } from './types.js';

export async function fetchTimeseries(cdid: string): Promise<OnsTimeseriesData | null> {
  const url = `${ONS_BASE_URL}/timeseries/${cdid}/dataset`;
  try {
    const resp = await httpGet(url, {
      timeoutMs: ONS_TIMEOUT_MS,
      headers: { 'User-Agent': ONS_USER_AGENT, 'Accept': 'application/json' },
      throttle: ONS_THROTTLE,
    });
    if (resp.statusCode >= 400) return null;
    return (await resp.json()) as OnsTimeseriesData;
  } catch { return null; }
}

export async function fetchMultiTimeseries(cdids: string[]): Promise<Map<string, OnsTimeseriesData>> {
  const results = new Map<string, OnsTimeseriesData>();
  for (const cdid of cdids) {
    try {
      const data = await fetchTimeseries(cdid);
      if (data) results.set(cdid, data);
    } catch { /* skip */ }
  }
  return results;
}

export async function searchDatasets(query: string): Promise<OnsDatasetResult[]> {
  const url = `${ONS_BASE_URL}/search/datasets?q=${encodeURIComponent(query)}`;
  try {
    const resp = await httpGet(url, {
      timeoutMs: ONS_TIMEOUT_MS,
      headers: { 'User-Agent': ONS_USER_AGENT },
      throttle: ONS_THROTTLE,
    });
    if (resp.statusCode >= 400) return [];
    const body = (await resp.json()) as { results?: OnsDatasetResult[] };
    return body.results ?? [];
  } catch { return []; }
}
