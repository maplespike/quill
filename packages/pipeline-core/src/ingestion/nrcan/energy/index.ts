// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Nrcan Ingestion Module — Quill
 *
 * Energy Statistics data ingestion from open.canada.ca CKAN portal.
 * Fetches CSV, parses records, normalizes with SHA-256 citations.
 */

import { fetchNrcanCsv } from './fetcher.js';
import { parseEnergyStat } from './parser.js';
import { NRCAN_PACKAGES } from './constants.js';
import type { EnergyStat, NrcanIngestionResult } from './types.js';

export async function ingestEnergyStat(
  options: { limit?: number } = {},
): Promise<NrcanIngestionResult & { records: EnergyStat[] }> {
  const startTime = Date.now();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsIngested = 0;
  let records: EnergyStat[] = [];

  try {
    const csv = await fetchNrcanCsv(NRCAN_PACKAGES.ENERGY_STATISTICS);
    records = await parseEnergyStat(csv);
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
    dataset: 'energy-statistics',
    recordsFound,
    recordsIngested,
    errors,
    durationMs: Date.now() - startTime,
    records,
  };
}

export async function searchEnergyByProvince(
  province: string,
  options: { limit?: number } = {},
): Promise<EnergyStat[]> {
  const result = await ingestEnergyStat(options);
  const normalized = province.toLowerCase();
  return result.records.filter(r => r.province.toString().toLowerCase().includes(normalized));
}

export async function searchEnergyBySource(
  source: string,
  options: { limit?: number } = {},
): Promise<EnergyStat[]> {
  const result = await ingestEnergyStat(options);
  const normalized = source.toLowerCase();
  return result.records.filter(r => r.source.toString().toLowerCase().includes(normalized));
}

