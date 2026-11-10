// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from '../../utils/http.js';
import { ONTARIO_CKAN_URL, ONTARIO_TIMEOUT_MS, ONTARIO_UA } from './constants.js';

export async function fetchOntarioPackages(query: string, limit = 10) {
  try {
    const url = `${ONTARIO_CKAN_URL}/package_search?q=${encodeURIComponent(query)}&rows=${limit}`;
    const resp = await httpGet(url, { timeoutMs: ONTARIO_TIMEOUT_MS, headers: { 'User-Agent': ONTARIO_UA } });
    if (resp.statusCode >= 400) return { results: [], total: 0 };
    const data = JSON.parse(resp.body);
    return { results: data?.result?.results ?? [], total: data?.result?.total ?? 0 };
  } catch { return { results: [], total: 0 }; }
}

export async function fetchOntarioDataset(id: string) {
  try {
    const url = `${ONTARIO_CKAN_URL}/package_show?id=${encodeURIComponent(id)}`;
    const resp = await httpGet(url, { timeoutMs: ONTARIO_TIMEOUT_MS, headers: { 'User-Agent': ONTARIO_UA } });
    if (resp.statusCode >= 400) return null;
    return JSON.parse(resp.body)?.result ?? null;
  } catch { return null; }
}

export async function ingestOntarioProvincial() {
  const start = Date.now();
  const results: Array<{ topic: string; title: string; id: string; url: string }> = [];
  const errors: string[] = [];
  for (const topic of ['health', 'education', 'environment', 'transportation', 'economy', 'labour', 'housing']) {
    const data = await fetchOntarioPackages(topic, 5);
    results.push(...data.results.map((r: any) => ({ topic, title: r.title, id: r.id, url: `https://data.ontario.ca/dataset/${r.id}` })));
  }
  return { source: 'ontario-provincial', recordsFound: results.length, records: results, errors, durationMs: Date.now() - start };
}

export async function searchOntarioProvincial(query: string) {
  if (!query.trim()) return [];
  const data = await fetchOntarioPackages(query, 20);
  return data.results.map((r: any) => ({ title: r.title, id: r.id, notes: r.notes, url: `https://data.ontario.ca/dataset/${r.id}` }));
}
