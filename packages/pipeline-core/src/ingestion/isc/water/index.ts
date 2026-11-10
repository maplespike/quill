// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Isc Ingestion Module — Quill
 *
 * First Nations Water Infrastructure data ingestion from open.canada.ca CKAN portal.
 * Fetches CSV, parses records, normalizes with SHA-256 citations.
 */

import { fetchIscCsv } from './fetcher.js';
import { parseWaterInfrastructure } from './parser.js';
import { ISC_PACKAGES } from './constants.js';
import type { WaterInfrastructure, IscIngestionResult } from './types.js';

export async function ingestWaterInfrastructure(
  options: { limit?: number } = {},
): Promise<IscIngestionResult & { records: WaterInfrastructure[] }> {
  const startTime = Date.now();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsIngested = 0;
  let records: WaterInfrastructure[] = [];

  try {
    const csv = await fetchIscCsv(ISC_PACKAGES.FIRST_NATIONS_WATER_INFRASTRUCTURE);
    records = await parseWaterInfrastructure(csv);
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
    dataset: 'first-nations-water-infrastructure',
    recordsFound,
    recordsIngested,
    errors,
    durationMs: Date.now() - startTime,
    records,
  };
}

export async function searchWaterByCommunity(
  community: string,
  options: { limit?: number } = {},
): Promise<WaterInfrastructure[]> {
  const result = await ingestWaterInfrastructure(options);
  const normalized = community.toLowerCase();
  return result.records.filter(r => r.community.toString().toLowerCase().includes(normalized));
}

export async function searchWaterByStatus(
  status: string,
  options: { limit?: number } = {},
): Promise<WaterInfrastructure[]> {
  const result = await ingestWaterInfrastructure(options);
  const normalized = status.toLowerCase();
  return result.records.filter(r => r.status.toString().toLowerCase().includes(normalized));
}

