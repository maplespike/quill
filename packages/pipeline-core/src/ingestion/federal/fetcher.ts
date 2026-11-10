// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import type { FederalDataset, FederalDeepIngestionResult } from './types.js';
import { FD_USER_AGENT, FD_TIMEOUT_MS, CKAN_BASE, CIHI_BASE, CIHI_DATASETS, MAX_FEDERAL_RECORDS } from './constants.js';

async function fetchJson(url: string): Promise<any> {
  try {
    const resp = await httpGet(url, { headers: { 'User-Agent': FD_USER_AGENT }, timeoutMs: FD_TIMEOUT_MS });
    return resp.statusCode >= 400 ? null : await resp.json();
  } catch { return null; }
}

export async function fetchAllFederalDeep(): Promise<FederalDeepIngestionResult> {
  const start = Date.now(); const datasets: FederalDataset[] = []; const errors: string[] = [];
  const now = new Date().toISOString();

  // CIHI wait times datasets
  for (const filename of CIHI_DATASETS) {
    datasets.push({
      agency: 'CIHI', dataset: filename, year: new Date().getFullYear(),
      title: `CIHI Wait Times: ${filename}`,
      url: `${CIHI_BASE}/${filename}`, format: 'XLSX',
      description: 'CIHI hospital wait times and emergency department data',
      hash: await computeHash(`cihi-${filename}`, 'sha256'), ingestedAt: now,
    });
  }

  // ESDC datasets via CKAN
  const esdcQueries = ['employment+equity', 'workplace+injury', 'labour+standards', 'skills+training', 'workforce+development'];
  for (const q of esdcQueries) {
    if (datasets.length >= MAX_FEDERAL_RECORDS) break;
    const data = await fetchJson(`${CKAN_BASE}/package_search?q=${q}+owner_org:esdc&rows=10`);
    if (!data?.result?.results) continue;
    for (const pkg of data.result.results) {
      if (datasets.length >= MAX_FEDERAL_RECORDS) break;
      datasets.push({
        agency: 'ESDC', dataset: pkg.title || pkg.name, year: pkg.metadata_created?.substring(0, 4) ? parseInt(pkg.metadata_created.substring(0, 4)) : new Date().getFullYear(),
        title: pkg.title || '', url: `${'https://open.canada.ca'}/data/en/dataset/${pkg.id}`,
        format: 'CKAN', description: (pkg.notes || '').substring(0, 200),
        hash: await computeHash(`fed-${pkg.id}`, 'sha256'), ingestedAt: now,
      });
    }
  }

  // PHAC surveillance datasets
  const phacData = await fetchJson(`${CKAN_BASE}/package_search?q=owner_org:phac+disease+surveillance&rows=15`);
  if (phacData?.result?.results) {
    for (const pkg of phacData.result.results) {
      if (datasets.length >= MAX_FEDERAL_RECORDS) break;
      datasets.push({
        agency: 'PHAC', dataset: pkg.title || pkg.name, year: pkg.metadata_created?.substring(0, 4) ? parseInt(pkg.metadata_created.substring(0, 4)) : new Date().getFullYear(),
        title: pkg.title || '', url: `${'https://open.canada.ca'}/data/en/dataset/${pkg.id}`,
        format: 'CKAN', description: (pkg.notes || '').substring(0, 200),
        hash: await computeHash(`phac-${pkg.id}`, 'sha256'), ingestedAt: now,
      });
    }
  }

  return { datasets, sourcesAttempted: 2 + esdcQueries.length, sourcesSucceeded: datasets.length > 0 ? 3 : 2, errors, durationMs: Date.now() - start };
}
