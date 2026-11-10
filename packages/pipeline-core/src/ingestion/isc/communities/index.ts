// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Isc Ingestion Module — Quill
 *
 * First Nations Communities Directory data ingestion from open.canada.ca CKAN portal.
 */

import { fetchIscCsv } from './fetcher.js';
import { parseFirstNationCommunity } from './parser.js';
import { ISC_PACKAGES } from './constants.js';
import type { FirstNationCommunity, IscIngestionResult } from './types.js';

export async function ingestFirstNationCommunity(
  options: { limit?: number } = {},
): Promise<IscIngestionResult & { records: FirstNationCommunity[] }> {
  const startTime = Date.now();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsIngested = 0;
  let records: FirstNationCommunity[] = [];

  try {
    const csv = await fetchIscCsv(ISC_PACKAGES.FIRST_NATIONS_COMMUNITIES);
    records = await parseFirstNationCommunity(csv);
    recordsFound = records.length;
    recordsIngested = records.length;
    if (options.limit) { records = records.slice(0, options.limit); recordsIngested = records.length; }
  } catch (error) {
    errors.push((error as Error).message);
  }

  return {
    dataset: 'first-nations-communities',
    recordsFound,
    recordsIngested,
    errors,
    durationMs: Date.now() - startTime,
    records,
  };
}

export async function searchCommunitiesByProvince(
  province: string,
  options: { limit?: number } = {},
): Promise<FirstNationCommunity[]> {
  const result = await ingestFirstNationCommunity(options);
  const normalized = province.toLowerCase();
  return result.records.filter(r => r.province.toString().toLowerCase().includes(normalized));
}

export async function searchCommunitiesByName(
  name: string,
  options: { limit?: number } = {},
): Promise<FirstNationCommunity[]> {
  const result = await ingestFirstNationCommunity(options);
  const normalized = name.toLowerCase();
  return result.records.filter(r => r.name.toString().toLowerCase().includes(normalized));
}

