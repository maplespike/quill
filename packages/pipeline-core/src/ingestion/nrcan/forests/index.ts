// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Nrcan Ingestion Module — Quill
 *
 * National Forest Inventory data ingestion from open.canada.ca CKAN portal.
 * Fetches CSV, parses records, normalizes with SHA-256 citations.
 */

import { fetchNrcanCsv } from './fetcher.js';
import { parseForestInventory } from './parser.js';
import { NRCAN_PACKAGES } from './constants.js';
import type { ForestInventory, NrcanIngestionResult } from './types.js';

export async function ingestForestInventory(
  options: { limit?: number } = {},
): Promise<NrcanIngestionResult & { records: ForestInventory[] }> {
  const startTime = Date.now();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsIngested = 0;
  let records: ForestInventory[] = [];

  try {
    const csv = await fetchNrcanCsv(NRCAN_PACKAGES.NATIONAL_FOREST_INVENTORY);
    records = await parseForestInventory(csv);
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
    dataset: 'national-forest-inventory',
    recordsFound,
    recordsIngested,
    errors,
    durationMs: Date.now() - startTime,
    records,
  };
}

export async function searchForestsByEcozone(
  ecozone: string,
  options: { limit?: number } = {},
): Promise<ForestInventory[]> {
  const result = await ingestForestInventory(options);
  const normalized = ecozone.toLowerCase();
  return result.records.filter(r => r.ecozone.toString().toLowerCase().includes(normalized));
}

export async function searchForestsBySpecies(
  species: string,
  options: { limit?: number } = {},
): Promise<ForestInventory[]> {
  const result = await ingestForestInventory(options);
  const normalized = species.toLowerCase();
  return result.records.filter(r => r.species.toString().toLowerCase().includes(normalized));
}

