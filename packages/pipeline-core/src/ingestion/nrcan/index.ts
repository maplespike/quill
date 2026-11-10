// SPDX-License-Identifier: AGPL-3.0-only
/**
 * NRCan Ingestion Module — Quill
 *
 * Natural Resources Canada data ingestion for mining activities and topographic maps.
 * Fetches from open.canada.ca CKAN portal, parses CSV, normalizes records with SHA-256 citations.
 *
 * Usage:
 *   import { ingestMiningActivities, ingestTopographicMaps } from './nrcan/index.js';
 *   const mining = await ingestMiningActivities();
 *   const maps = await ingestTopographicMaps();
 */

import { fetchNrcanCsv } from './fetcher.js';
import { parseMiningActivities, parseTopographicMaps } from './parser.js';
import { NRCAN_PACKAGES } from './constants.js';
import type { MiningActivity, TopographicMap, NrcanIngestionResult } from './types.js';

/* ------------------------------------------------------------------ */
/*  Mining Activities                                                */
/* ------------------------------------------------------------------ */

/**
 * Ingest mining activities from NRCan CKAN portal.
 *
 * @param options - Optional configuration
 * @returns Ingestion result with records and metadata
 */
export async function ingestMiningActivities(
  options: { limit?: number } = {},
): Promise<NrcanIngestionResult & { records: MiningActivity[] }> {
  const startTime = Date.now();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsIngested = 0;
  let records: MiningActivity[] = [];

  try {
    const csv = await fetchNrcanCsv(NRCAN_PACKAGES.MINING_ACTIVITIES);
    records = await parseMiningActivities(csv);
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
    dataset: 'mining-activities',
    recordsFound,
    recordsIngested,
    errors,
    durationMs: Date.now() - startTime,
    records,
  };
}

/**
 * Search mining activities by province
 */
export async function searchMiningByProvince(
  province: string,
  options: { limit?: number } = {},
): Promise<MiningActivity[]> {
  const result = await ingestMiningActivities(options);
  const normalizedProvince = province.toUpperCase();
  return result.records.filter(r => r.province === normalizedProvince);
}

/**
 * Search mining activities by commodity
 */
export async function searchMiningByCommodity(
  commodity: string,
  options: { limit?: number } = {},
): Promise<MiningActivity[]> {
  const result = await ingestMiningActivities(options);
  const normalizedCommodity = commodity.toLowerCase();
  return result.records.filter(r => r.commodity === normalizedCommodity);
}

/* ------------------------------------------------------------------ */
/*  Topographic Maps                                                  */
/* ------------------------------------------------------------------ */

/**
 * Ingest topographic maps from NRCan CKAN portal.
 *
 * @param options - Optional configuration
 * @returns Ingestion result with records and metadata
 */
export async function ingestTopographicMaps(
  options: { limit?: number } = {},
): Promise<NrcanIngestionResult & { records: TopographicMap[] }> {
  const startTime = Date.now();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsIngested = 0;
  let records: TopographicMap[] = [];

  try {
    const csv = await fetchNrcanCsv(NRCAN_PACKAGES.TOPOGRAPHIC_MAPS);
    records = await parseTopographicMaps(csv);
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
    dataset: 'topographic-maps',
    recordsFound,
    recordsIngested,
    errors,
    durationMs: Date.now() - startTime,
    records,
  };
}

/**
 * Search topographic maps by NTS number
 */
export async function searchMapsByNtsNumber(
  ntsNumber: string,
  options: { limit?: number } = {},
): Promise<TopographicMap[]> {
  const result = await ingestTopographicMaps(options);
  const normalized = ntsNumber.toUpperCase();
  return result.records.filter(r => r.ntsNumber === normalized);
}

/**
 * Search topographic maps by scale
 */
export async function searchMapsByScale(
  scale: string,
  options: { limit?: number } = {},
): Promise<TopographicMap[]> {
  const result = await ingestTopographicMaps(options);
  return result.records.filter(r => r.scale === scale);
}

/* ------------------------------------------------------------------ */
/*  Bulk Ingestion                                                    */
/* ------------------------------------------------------------------ */

/**
 * Ingest all NRCan datasets
 */
export async function ingestAllNrcan(
  options: { limit?: number } = {},
): Promise<{
  miningActivities: NrcanIngestionResult & { records: MiningActivity[] };
  topographicMaps: NrcanIngestionResult & { records: TopographicMap[] };
}> {
  const [miningActivities, topographicMaps] = await Promise.all([
    ingestMiningActivities(options),
    ingestTopographicMaps(options),
  ]);

  return {
    miningActivities,
    topographicMaps,
  };
}