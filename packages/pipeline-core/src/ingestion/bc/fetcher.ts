import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import type { BCDataset, BCIngestionResult } from './types.js';
import { BC_USER_AGENT, BC_TIMEOUT_MS, BC_CKAN_ENDPOINT, BC_SECTOR_KEYWORDS, BC_MAX_DATASETS_PER_SECTOR } from './constants.js';

async function fetchJson(url: string): Promise<any> {
  try {
    const resp = await httpGet(url, { headers: { 'User-Agent': BC_USER_AGENT }, timeoutMs: BC_TIMEOUT_MS });
    return resp.statusCode >= 400 ? null : await resp.json();
  } catch { return null; }
}

export async function fetchBCDatasets(options?: { sector?: string; limit?: number }): Promise<BCDataset[]> {
  const datasets: BCDataset[] = [];
  const now = new Date().toISOString();
  const sectors = options?.sector ? [options.sector] : BC_SECTOR_KEYWORDS;
  const limit = options?.limit ?? BC_MAX_DATASETS_PER_SECTOR;

  for (const sector of sectors) {
    const data = await fetchJson(`${BC_CKAN_ENDPOINT}/package_search?q=${encodeURIComponent(sector)}&rows=${limit}`);
    if (!data?.result?.results) continue;

    for (const pkg of data.result.results) {
      if (datasets.length >= sectors.length * limit) break;
      const title = pkg.title || pkg.name || '';
      if (!title) continue;

      const organization = pkg.organization?.title || pkg.owner_org || 'unknown';
      const tags = (pkg.tags || []).map((t: any) => t.display_name || t.name).filter(Boolean);
      const resources = pkg.resources || [];

      datasets.push({
        id: pkg.id,
        title,
        name: pkg.name || '',
        sector,
        url: `https://catalogue.data.gov.bc.ca/dataset/${pkg.id}`,
        format: resources[0]?.format || 'unknown',
        description: (pkg.notes || '').substring(0, 500),
        organization,
        tags,
        resourceCount: resources.length,
        hash: await computeHash(`bc-${pkg.id}`, 'sha256'),
        ingestedAt: now,
      });
    }
  }

  return datasets;
}

export async function fetchAllBCDeep(): Promise<BCIngestionResult> {
  const start = Date.now();
  const errors: string[] = [];

  try {
    const datasets = await fetchBCDatasets();
    return {
      datasets,
      sectorsChecked: BC_SECTOR_KEYWORDS.length,
      datasetsFound: datasets.length,
      errors,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      datasets: [],
      sectorsChecked: BC_SECTOR_KEYWORDS.length,
      datasetsFound: 0,
      errors,
      durationMs: Date.now() - start,
    };
  }
}

export async function searchBCDatasets(query: string, options?: { limit?: number }): Promise<BCDataset[]> {
  const limit = options?.limit ?? 20;
  const data = await fetchJson(`${BC_CKAN_ENDPOINT}/package_search?q=${encodeURIComponent(query)}&rows=${limit}`);
  if (!data?.result?.results) return [];

  const now = new Date().toISOString();
  const datasets: BCDataset[] = [];

  for (const pkg of data.result.results) {
    const title = pkg.title || pkg.name || '';
    if (!title) continue;

    const organization = pkg.organization?.title || pkg.owner_org || 'unknown';
    const tags = (pkg.tags || []).map((t: any) => t.display_name || t.name).filter(Boolean);
    const resources = pkg.resources || [];

    datasets.push({
      id: pkg.id,
      title,
      name: pkg.name || '',
      sector: 'search',
      url: `https://catalogue.data.gov.bc.ca/dataset/${pkg.id}`,
      format: resources[0]?.format || 'unknown',
      description: (pkg.notes || '').substring(0, 500),
      organization,
      tags,
      resourceCount: resources.length,
      hash: await computeHash(`bc-${pkg.id}`, 'sha256'),
      ingestedAt: now,
    });
  }

  return datasets;
}
