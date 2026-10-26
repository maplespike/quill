// SPDX-License-Identifier: AGPL-3.0-only

import { fetchMunicipalDataset, detectPortalType } from './fetcher.js';
import { parseMunicipalData } from './parser.js';
import { MUNICIPAL_PORTALS } from './constants.js';
import type { MunicipalRecord, MunicipalSearchParams, MunicipalIngestionResult } from './types.js';

export async function ingestMunicipalDataset(
  municipalityId: string,
  dataset: string,
): Promise<MunicipalIngestionResult> {
  const start = Date.now();
  const portal = MUNICIPAL_PORTALS[municipalityId];

  try {
    const raw = await fetchMunicipalDataset(municipalityId, dataset);
    const records = await parseMunicipalData(
      raw,
      municipalityId,
      dataset,
      portal?.portalType ?? 'none',
    );

    return {
      records: Array.isArray(records) ? records : [],
      municipality: portal?.name ?? municipalityId,
      source: portal?.baseUrl ?? '',
      totalFetched: Array.isArray(records) ? records.length : 0,
      errors: [],
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      records: [],
      municipality: portal?.name ?? municipalityId,
      source: portal?.baseUrl ?? '',
      totalFetched: 0,
      errors: [err instanceof Error ? err.message : String(err)],
      durationMs: Date.now() - start,
    };
  }
}

export async function ingestAllMunicipal(): Promise<MunicipalIngestionResult[]> {
  const results: MunicipalIngestionResult[] = [];
  for (const id of Object.keys(MUNICIPAL_PORTALS)) {
    const portal = MUNICIPAL_PORTALS[id];
    for (const dataset of portal.datasets) {
      const result = await ingestMunicipalDataset(id, dataset);
      results.push(result);
    }
  }
  return results;
}

export function searchMunicipal(
  params: MunicipalSearchParams,
): MunicipalRecord[] {
  const records: MunicipalRecord[] = [];

  for (const [id, portal] of Object.entries(MUNICIPAL_PORTALS)) {
    if (params.municipality && id !== params.municipality) continue;
    if (params.province && portal.province !== params.province) continue;

    for (const dataset of portal.datasets) {
      if (params.dataset && dataset !== params.dataset) continue;

      records.push({
        id: `${id}:${dataset}`,
        municipality: portal.name,
        municipalityId: id,
        province: portal.province,
        dataset,
        title: `${portal.name} - ${dataset}`,
        url: portal.baseUrl,
        format: portal.portalType === 'ckan' ? 'ckan' : portal.portalType === 'socrata' ? 'socrata' : 'json',
        lastModified: null,
        created: null,
        portalType: portal.portalType,
      });
    }
  }

  return records;
}

export * from './types.js';
export * from './constants.js';
export {
  detectPortalType,
  fetchMunicipalDataset,
  resolveCkanPackageId,
  resolveSocrataDatasetId,
  evictMunicipalIdCache,
  clearMunicipalIdCache,
} from './fetcher.js';
export { searchToronto, searchVancouver, searchMontreal, searchCalgary, searchOttawa, searchEdmonton, searchWinnipeg, searchMississauga, searchBurnaby, searchSurrey, getCityFetcher, CITY_FETCHERS } from './fetchers/index.js';
