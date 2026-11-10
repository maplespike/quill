// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from '../../../utils/http.js';
const BASE_URL = 'https://donnees.montreal.ca';
import type { MunicipalRecord } from '../types.js';
export async function searchMontreal(query: string, limit = 10, offset = 0): Promise<MunicipalRecord[]> {
  try {
    const url = `${BASE_URL}/api/3/action/package_search?q=${encodeURIComponent(query)}&rows=${limit}&start=${offset}`;
    const resp = await httpGet(url, { timeoutMs: 15000, headers: { Accept: 'application/json' } });
    if (resp.statusCode >= 400) return [];
    const body = JSON.parse(resp.body);
    return (body?.result?.results ?? []).map((p: any) => ({
      id: p.id || `montreal:${p.name}`, municipality: 'Montreal', municipalityId: 'montreal', province: 'QC',
      dataset: p.name, title: p.title || p.name, url: p.resources?.[0]?.url || BASE_URL,
      format: p.resources?.[0]?.format || 'ckan',
      lastModified: p.metadata_modified || null, created: p.metadata_created || null, portalType: 'ckan' as const,
    }));
  } catch { return []; }
}
