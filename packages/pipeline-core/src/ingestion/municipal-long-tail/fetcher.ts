// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import type { MunicipalDataset, MunicipalLongTailIngestionResult } from './types.js';
import { PROVINCIAL_CKAN_PATHS, MUNICIPAL_KEYWORDS, CRAWLER_USER_AGENT, CRAWLER_TIMEOUT_MS, MAX_DATASETS_PER_PORTAL } from './constants.js';

async function fetchJson(url: string): Promise<any> {
  try {
    const resp = await httpGet(url, { headers: { 'User-Agent': CRAWLER_USER_AGENT }, timeoutMs: CRAWLER_TIMEOUT_MS });
    return resp.statusCode >= 400 ? null : await resp.json();
  } catch { return null; }
}

async function crawlProvincialPortal(province: string, baseUrl: string): Promise<MunicipalDataset[]> {
  const now = new Date().toISOString();
  const results: MunicipalDataset[] = [];
  for (const kw of MUNICIPAL_KEYWORDS) {
    const data = await fetchJson(`${baseUrl}/package_search?q=${kw}+municipal&rows=20`);
    if (!data?.result?.results) continue;
    for (const pkg of data.result.results) {
      if (results.length >= MAX_DATASETS_PER_PORTAL) break;
      const title = pkg.title || pkg.name || '';
      if (!title) continue;
      const url = `${baseUrl}/package_show?id=${pkg.id}`;
      results.push({
        id: await computeHash(`mt-${province}-${pkg.id}`, 'sha256'), municipality: title.split('—')[0]?.trim() || title,
        province, title, url, format: pkg.resources?.[0]?.format || 'unknown',
        category: kw, hash: await computeHash(`${province}-${pkg.id}`, 'sha256'), ingestedAt: now,
      });
    }
  }
  return results;
}

export async function fetchAllMunicipalLongTail(): Promise<MunicipalLongTailIngestionResult> {
  const start = Date.now(); const allDatasets: MunicipalDataset[] = []; const errors: string[] = [];
  const entries = Object.entries(PROVINCIAL_CKAN_PATHS);
  const results = await Promise.allSettled(entries.map(([prov, url]) => crawlProvincialPortal(prov, url)));
  for (const r of results) {
    if (r.status === 'fulfilled') allDatasets.push(...r.value);
    else errors.push(r.reason?.message ?? 'unknown');
  }
  return { datasets: allDatasets, portalsChecked: entries.length, datasetsFound: allDatasets.length, errors, durationMs: Date.now() - start };
}
