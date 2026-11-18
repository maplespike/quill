// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Nrcan Ingestion Module — Quill
 *
 * Renewable Energy Capacity data ingestion from open.canada.ca CKAN portal.
 * Fetches CSV, parses records, normalizes with SHA-256 citations.
 */

import { fetchNrcanCsv } from './fetcher.js';
import { parseRenewableCapacity } from './parser.js';
import { NRCAN_PACKAGES } from './constants.js';
import type { RenewableCapacity, NrcanIngestionResult } from './types.js';

export async function ingestRenewableCapacity(
  options: { limit?: number } = {},
): Promise<NrcanIngestionResult & { records: RenewableCapacity[] }> {
  const startTime = Date.now();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsIngested = 0;
  let records: RenewableCapacity[] = [];

  try {
    const csv = await fetchNrcanCsv(NRCAN_PACKAGES.RENEWABLE_ENERGY);
    records = await parseRenewableCapacity(csv);
    recordsFound = records.length;
    recordsIngested = records.length;

    if (options.limit) {
      records = records.slice(0, options.limit);
      recordsIngested = records.length;
    }
  } catch (error) {
    errors.push((error as Error).message);
  }

  return {
    dataset: 'renewable-energy',
    recordsFound,
    recordsIngested,
    errors,
    durationMs: Date.now() - startTime,
    records,
  };
}

export async function searchRenewableByType(
  type: string,
  options: { limit?: number } = {},
): Promise<RenewableCapacity[]> {
  const result = await ingestRenewableCapacity(options);
  const normalized = type.toLowerCase();
  return result.records.filter(r => r.type.toString().toLowerCase().includes(normalized));
}

export async function searchRenewableByProvince(
  province: string,
  options: { limit?: number } = {},
): Promise<RenewableCapacity[]> {
  const result = await ingestRenewableCapacity(options);
  const normalized = province.toLowerCase();
  return result.records.filter(r => r.province.toString().toLowerCase().includes(normalized));
}

