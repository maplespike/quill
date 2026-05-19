// SPDX-License-Identifier: AGPL-3.0-or-later
import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import type { ProvincialDeepDataset, ProvincialDeepIngestionResult } from './types.js';
import { PD_USER_AGENT, PD_TIMEOUT_MS, LARGER_PROVINCES, SECTOR_KEYWORDS, PROVINCIAL_CKAN, MAX_DATASETS_PER_SECTOR } from './constants.js';

async function fetchJson(url: string): Promise<any> {
  try {
    const resp = await httpGet(url, { headers: { 'User-Agent': PD_USER_AGENT }, timeoutMs: PD_TIMEOUT_MS });
    return resp.statusCode >= 400 ? null : await resp.json();
  } catch { return null; }
}

export async function fetchAllProvincialDeep(): Promise<ProvincialDeepIngestionResult> {
  const start = Date.now(); const datasets: ProvincialDeepDataset[] = []; const errors: string[] = [];
  const now = new Date().toISOString();
  const entries = Object.entries(PROVINCIAL_CKAN).filter(([p]) => LARGER_PROVINCES.includes(p));

  const results = await Promise.allSettled(entries.map(async ([prov, baseUrl]) => {
    const provDatasets: ProvincialDeepDataset[] = [];
    for (const sector of SECTOR_KEYWORDS) {
      const data = await fetchJson(`${baseUrl}/package_search?q=${sector}&rows=10`);
      if (!data?.result?.results) continue;
      for (const pkg of data.result.results) {
        if (provDatasets.length >= MAX_DATASETS_PER_SECTOR) break;
        const title = pkg.title || pkg.name || '';
        if (!title) continue;
        provDatasets.push({
          province: prov, sector, title, url: `${baseUrl}/package_show?id=${pkg.id}`,
          format: pkg.resources?.[0]?.format || 'unknown', description: (pkg.notes || '').substring(0, 200),
          hash: await computeHash(`pd-${prov}-${pkg.id}`, 'sha256'), ingestedAt: now,
        });
      }
    }
    return provDatasets;
  }));

  for (const r of results) {
    if (r.status === 'fulfilled') datasets.push(...r.value);
    else errors.push(r.reason?.message ?? 'unknown');
  }
  return { datasets, portalsChecked: entries.length, datasetsFound: datasets.length, errors, durationMs: Date.now() - start };
}