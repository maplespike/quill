/**
 * Isc Ingestion Module — Quill
 *
 * Indigenous Health Funding data ingestion from open.canada.ca CKAN portal.
 * Fetches CSV, parses records, normalizes with SHA-256 citations.
 */

import { fetchIscCsv } from './fetcher.js';
import { parseIndigenousHealthFunding } from './parser.js';
import { ISC_PACKAGES } from './constants.js';
import type { IndigenousHealthFunding, IscIngestionResult } from './types.js';

export async function ingestIndigenousHealthFunding(
  options: { limit?: number } = {},
): Promise<IscIngestionResult & { records: IndigenousHealthFunding[] }> {
  const startTime = Date.now();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsIngested = 0;
  let records: IndigenousHealthFunding[] = [];

  try {
    const csv = await fetchIscCsv(ISC_PACKAGES.INDIGENOUS_HEALTH_FUNDING);
    records = await parseIndigenousHealthFunding(csv);
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
    dataset: 'indigenous-health-funding',
    recordsFound,
    recordsIngested,
    errors,
    durationMs: Date.now() - startTime,
    records,
  };
}

export async function searchHealthFundingByCommunity(
  community: string,
  options: { limit?: number } = {},
): Promise<IndigenousHealthFunding[]> {
  const result = await ingestIndigenousHealthFunding(options);
  const normalized = community.toLowerCase();
  return result.records.filter(r => r.community.toString().toLowerCase().includes(normalized));
}

export async function searchHealthFundingByProgram(
  program: string,
  options: { limit?: number } = {},
): Promise<IndigenousHealthFunding[]> {
  const result = await ingestIndigenousHealthFunding(options);
  const normalized = program.toLowerCase();
  return result.records.filter(r => r.program.toString().toLowerCase().includes(normalized));
}

