/**
 * Isc Ingestion Module — Quill
 *
 * Housing Programs data ingestion from open.canada.ca CKAN portal.
 * Fetches CSV, parses records, normalizes with SHA-256 citations.
 */

import { fetchIscCsv } from './fetcher.js';
import { parseHousingProgram } from './parser.js';
import { ISC_PACKAGES } from './constants.js';
import type { HousingProgram, IscIngestionResult } from './types.js';

export async function ingestHousingProgram(
  options: { limit?: number } = {},
): Promise<IscIngestionResult & { records: HousingProgram[] }> {
  const startTime = Date.now();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsIngested = 0;
  let records: HousingProgram[] = [];

  try {
    const csv = await fetchIscCsv(ISC_PACKAGES.INDIGENOUS_HOUSING);
    records = await parseHousingProgram(csv);
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
    dataset: 'indigenous-housing',
    recordsFound,
    recordsIngested,
    errors,
    durationMs: Date.now() - startTime,
    records,
  };
}

export async function searchHousingByCommunity(
  community: string,
  options: { limit?: number } = {},
): Promise<HousingProgram[]> {
  const result = await ingestHousingProgram(options);
  const normalized = community.toLowerCase();
  return result.records.filter(r => r.community.toString().toLowerCase().includes(normalized));
}

export async function searchHousingByProgram(
  program: string,
  options: { limit?: number } = {},
): Promise<HousingProgram[]> {
  const result = await ingestHousingProgram(options);
  const normalized = program.toLowerCase();
  return result.records.filter(r => r.program.toString().toLowerCase().includes(normalized));
}

