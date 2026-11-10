// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from '../../../utils/http.js';
const BASE_URL = 'https://data-surrey.opendata.arcgis.com';
import type { MunicipalRecord } from '../types.js';
export async function searchSurrey(query: string, limit = 10, offset = 0): Promise<MunicipalRecord[]> {
  try {
    const url = `${BASE_URL}/api/search/v1/collections/all/items?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`;
    const resp = await httpGet(url, { timeoutMs: 15000, headers: { Accept: 'application/json' } });
    if (resp.statusCode >= 400) return [];
    const body = JSON.parse(resp.body);
    return (body?.features ?? body?.results ?? []).map((f: any, i: number) => ({
      id: f.id || `surrey:${i}`, municipality: 'Surrey', municipalityId: 'surrey', province: 'BC',
      dataset: f.properties?.title || f.title || `item-${i}`, title: f.properties?.title || f.title || '',
      url: f.properties?.url || f.url || BASE_URL,
      format: f.properties?.format || 'arcgis',
      lastModified: f.properties?.modified || null, created: f.properties?.created || null, portalType: 'arcgis' as const,
    }));
  } catch { return []; }
}
