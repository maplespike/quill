/**
 * Nrcan Ingestion Module — Quill
 *
 * Mineral Production data ingestion from open.canada.ca CKAN portal.
 * Fetches CSV, parses records, normalizes with SHA-256 citations.
 */

import { fetchNrcanCsv } from './fetcher.js';
import { parseMineralProduction } from './parser.js';
import { NRCAN_PACKAGES } from './constants.js';
import type { MineralProduction, NrcanIngestionResult } from './types.js';

export async function ingestMineralProduction(
  options: { limit?: number } = {},
): Promise<NrcanIngestionResult & { records: MineralProduction[] }> {
  const startTime = Date.now();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsIngested = 0;
  let records: MineralProduction[] = [];

  try {
    const csv = await fetchNrcanCsv(NRCAN_PACKAGES.MINERAL_PRODUCTION);
    records = await parseMineralProduction(csv);
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
    dataset: 'mineral-production',
    recordsFound,
    recordsIngested,
    errors,
    durationMs: Date.now() - startTime,
    records,
  };
}

export async function searchMineralsByCommodity(
  commodity: string,
  options: { limit?: number } = {},
): Promise<MineralProduction[]> {
  const result = await ingestMineralProduction(options);
  const normalized = commodity.toLowerCase();
  return result.records.filter(r => r.commodity.toString().toLowerCase().includes(normalized));
}

export async function searchMineralsByProvince(
  province: string,
  options: { limit?: number } = {},
): Promise<MineralProduction[]> {
  const result = await ingestMineralProduction(options);
  const normalized = province.toLowerCase();
  return result.records.filter(r => r.province.toString().toLowerCase().includes(normalized));
}

