/**
 * Isc Ingestion Module — Quill
 *
 * Land Claims Agreements data ingestion from open.canada.ca CKAN portal.
 * Fetches CSV, parses records, normalizes with SHA-256 citations.
 */

import { fetchIscCsv } from './fetcher.js';
import { parseLandClaim } from './parser.js';
import { ISC_PACKAGES } from './constants.js';
import type { LandClaim, IscIngestionResult } from './types.js';

export async function ingestLandClaim(
  options: { limit?: number } = {},
): Promise<IscIngestionResult & { records: LandClaim[] }> {
  const startTime = Date.now();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsIngested = 0;
  let records: LandClaim[] = [];

  try {
    const csv = await fetchIscCsv(ISC_PACKAGES.LAND_CLAIMS);
    records = await parseLandClaim(csv);
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
    dataset: 'land-claims',
    recordsFound,
    recordsIngested,
    errors,
    durationMs: Date.now() - startTime,
    records,
  };
}

export async function searchLandClaimsByGroup(
  aboriginalGroup: string,
  options: { limit?: number } = {},
): Promise<LandClaim[]> {
  const result = await ingestLandClaim(options);
  const normalized = aboriginalGroup.toLowerCase();
  return result.records.filter(r => r.aboriginalGroup.toString().toLowerCase().includes(normalized));
}

export async function searchLandClaimsByProvince(
  province: string,
  options: { limit?: number } = {},
): Promise<LandClaim[]> {
  const result = await ingestLandClaim(options);
  const normalized = province.toLowerCase();
  return result.records.filter(r => r.province.toString().toLowerCase().includes(normalized));
}

