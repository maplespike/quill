// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import { SNZ_BASE_URL, SNZ_TIMEOUT_MS, SNZ_THROTTLE, SNZ_USER_AGENT } from './constants.js';
import type { SnzODataEntity, SnzODataRecord, SnzDatasetMetadata } from './types.js';

export async function fetchDataset(
  datasetId: string,
  options?: { top?: number; skip?: number; filter?: string },
): Promise<SnzODataEntity | null> {
  const params = new URLSearchParams();
  if (options?.top) params.set('$top', String(options.top));
  if (options?.skip) params.set('$skip', String(options.skip));
  if (options?.filter) params.set('$filter', options.filter);
  params.set('$format', 'json');
  const qs = params.toString();
  const url = `${SNZ_BASE_URL}/${datasetId}${qs ? '?' + qs : ''}`;
  try {
    const resp = await httpGet(url, {
      timeoutMs: SNZ_TIMEOUT_MS,
      headers: { 'User-Agent': SNZ_USER_AGENT },
      throttle: SNZ_THROTTLE,
    });
    if (resp.statusCode >= 400) return null;
    return (await resp.json()) as SnzODataEntity;
  } catch { return null; }
}

export async function fetchAllDatasetPages(
  datasetId: string,
  pageSize = 1000,
  maxPages = 50,
): Promise<SnzODataRecord[]> {
  const allRecords: SnzODataRecord[] = [];
  for (let page = 0; page < maxPages; page++) {
    const data = await fetchDataset(datasetId, { top: pageSize, skip: page * pageSize });
    const records = data?.value ?? [];
    allRecords.push(...records);
    if (records.length < pageSize) break;
  }
  return allRecords;
}

export async function fetchCatalogue(): Promise<SnzDatasetMetadata[]> {
  const url = `${SNZ_BASE_URL}/Datasets?$format=json`;
  try {
    const resp = await httpGet(url, {
      timeoutMs: SNZ_TIMEOUT_MS,
      headers: { 'User-Agent': SNZ_USER_AGENT },
      throttle: SNZ_THROTTLE,
    });
    if (resp.statusCode >= 400) return [];
    const body = (await resp.json()) as { value?: SnzDatasetMetadata[] };
    return body.value ?? [];
  } catch { return []; }
}
