// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import { ABS_BASE_URL, ABS_TIMEOUT_MS, ABS_THROTTLE, ABS_USER_AGENT } from './constants.js';
import type { AbsDataflow, AbsSdmxJsonData } from './types.js';

export async function fetchDataflows(): Promise<AbsDataflow[]> {
  const url = `${ABS_BASE_URL}/dataflow/ABS/all`;
  try {
    const resp = await httpGet(url, {
      timeoutMs: ABS_TIMEOUT_MS,
      headers: { 'User-Agent': ABS_USER_AGENT, 'Accept': 'application/vnd.sdmx.structure+json' },
      throttle: ABS_THROTTLE,
    });
    if (resp.statusCode >= 400) return [];
    const body = (await resp.json()) as { data?: { dataflows?: AbsDataflow[] } };
    return body.data?.dataflows ?? [];
  } catch { return []; }
}

export async function fetchDataflowData(
  dataflowId: string,
  options?: { startPeriod?: string; endPeriod?: string; detail?: string },
): Promise<AbsSdmxJsonData | null> {
  const params = new URLSearchParams();
  if (options?.startPeriod) params.set('startPeriod', options.startPeriod);
  if (options?.endPeriod) params.set('endPeriod', options.endPeriod);
  if (options?.detail) params.set('detail', options.detail);
  const qs = params.toString();
  const url = `${ABS_BASE_URL}/data/${dataflowId}/all${qs ? '?' + qs : ''}`;
  try {
    const resp = await httpGet(url, {
      timeoutMs: ABS_TIMEOUT_MS,
      headers: { 'User-Agent': ABS_USER_AGENT, 'Accept': 'application/vnd.sdmx.data+json' },
      throttle: ABS_THROTTLE,
    });
    if (resp.statusCode >= 400) return null;
    return (await resp.json()) as AbsSdmxJsonData;
  } catch { return null; }
}

export async function fetchMultiDataflowData(
  dataflowIds: string[],
  options?: { startPeriod?: string; endPeriod?: string },
): Promise<Map<string, AbsSdmxJsonData>> {
  const results = new Map<string, AbsSdmxJsonData>();
  for (const id of dataflowIds) {
    try {
      const data = await fetchDataflowData(id, options);
      if (data) results.set(id, data);
    } catch { /* skip */ }
  }
  return results;
}
