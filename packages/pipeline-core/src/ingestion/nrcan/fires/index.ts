/**
 * Nrcan Ingestion Module — Quill
 *
 * Forest Fire Data data ingestion from open.canada.ca CKAN portal.
 * Fetches CSV, parses records, normalizes with SHA-256 citations.
 */

import { fetchNrcanCsv } from './fetcher.js';
import { parseForestFire } from './parser.js';
import { NRCAN_PACKAGES } from './constants.js';
import type { ForestFire, NrcanIngestionResult } from './types.js';

export async function ingestForestFire(
  options: { limit?: number } = {},
): Promise<NrcanIngestionResult & { records: ForestFire[] }> {
  const startTime = Date.now();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsIngested = 0;
  let records: ForestFire[] = [];

  try {
    const csv = await fetchNrcanCsv(NRCAN_PACKAGES.FOREST_FIRE_DATA);
    records = await parseForestFire(csv);
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
    dataset: 'forest-fire-data',
    recordsFound,
    recordsIngested,
    errors,
    durationMs: Date.now() - startTime,
    records,
  };
}

export async function searchFiresByProvince(
  province: string,
  options: { limit?: number } = {},
): Promise<ForestFire[]> {
  const result = await ingestForestFire(options);
  const normalized = province.toLowerCase();
  return result.records.filter(r => r.province.toString().toLowerCase().includes(normalized));
}

export async function searchFiresByYear(
  year: string,
  options: { limit?: number } = {},
): Promise<ForestFire[]> {
  const result = await ingestForestFire(options);
  const normalized = year.toLowerCase();
  return result.records.filter(r => r.year.toString().toLowerCase().includes(normalized));
}

