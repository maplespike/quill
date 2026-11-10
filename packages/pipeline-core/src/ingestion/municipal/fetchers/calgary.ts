// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from '../../../utils/http.js';
const BASE_URL = 'https://data.calgary.ca';
import type { MunicipalRecord } from '../types.js';
export async function searchCalgary(query: string, limit = 10, offset = 0): Promise<MunicipalRecord[]> {
  try {
    const url = `${BASE_URL}/api/catalog/v1?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`;
    const resp = await httpGet(url, { timeoutMs: 15000, headers: { Accept: 'application/json' } });
    if (resp.statusCode >= 400) return [];
    const body = JSON.parse(resp.body);
    return (body?.results ?? []).map((r: any) => ({
      id: r.resource?.id || `calgary:${r.resource?.name}`,
      municipality: 'Calgary', municipalityId: 'calgary', province: 'AB',
      dataset: r.resource?.name || '', title: r.resource?.name || '',
      url: r.resource?.download_url || r.link || BASE_URL,
      format: r.resource?.format || 'socrata',
      lastModified: r.resource?.updated_at || null, created: r.resource?.created_at || null, portalType: 'socrata' as const,
    }));
  } catch { return []; }
}
