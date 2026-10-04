/**
 * Isc Ingestion Module — Quill
 *
 * Indigenous Education Funding data ingestion from open.canada.ca CKAN portal.
 * Fetches CSV, parses records, normalizes with SHA-256 citations.
 */

import { fetchIscCsv } from './fetcher.js';
import { parseEducationFunding } from './parser.js';
import { ISC_PACKAGES } from './constants.js';
import type { EducationFunding, IscIngestionResult } from './types.js';

export async function ingestEducationFunding(
  options: { limit?: number } = {},
): Promise<IscIngestionResult & { records: EducationFunding[] }> {
  const startTime = Date.now();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsIngested = 0;
  let records: EducationFunding[] = [];

  try {
    const csv = await fetchIscCsv(ISC_PACKAGES.INDIGENOUS_EDUCATION_FUNDING);
    records = await parseEducationFunding(csv);
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
    dataset: 'indigenous-education-funding',
    recordsFound,
    recordsIngested,
    errors,
    durationMs: Date.now() - startTime,
    records,
  };
}

export async function searchEducationBySchool(
  school: string,
  options: { limit?: number } = {},
): Promise<EducationFunding[]> {
  const result = await ingestEducationFunding(options);
  const normalized = school.toLowerCase();
  return result.records.filter(r => r.school.toString().toLowerCase().includes(normalized));
}

export async function searchEducationByProvince(
  province: string,
  options: { limit?: number } = {},
): Promise<EducationFunding[]> {
  const result = await ingestEducationFunding(options);
  const normalized = province.toLowerCase();
  return result.records.filter(r => r.province.toString().toLowerCase().includes(normalized));
}

