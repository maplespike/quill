/**
 * IRCC Ingestion Module — Quill
 *
 * Immigration, Refugees and Citizenship Canada family sponsorship applications.
 */

import { fetchIrccCsv } from './fetcher.js';
import { parseFamilySponsorship } from './parser.js';
import { IRCC_PACKAGES } from './constants.js';
import type { FamilySponsorship, IrccIngestionResult } from './types.js';

export async function ingestFamilySponsorship(
  options: { limit?: number } = {},
): Promise<IrccIngestionResult & { records: FamilySponsorship[] }> {
  const startTime = Date.now();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsIngested = 0;
  let records: FamilySponsorship[] = [];

  try {
    const csv = await fetchIrccCsv(IRCC_PACKAGES.FAMILY_SPONSORSHIP);
    records = await parseFamilySponsorship(csv);
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
    dataset: 'family-sponsorship',
    recordsFound,
    recordsIngested,
    errors,
    durationMs: Date.now() - startTime,
    records,
  };
}

export async function searchSponsorshipByProvince(
  province: string,
  options: { limit?: number } = {},
): Promise<FamilySponsorship[]> {
  const result = await ingestFamilySponsorship(options);
  const normalizedProvince = province.toUpperCase();
  return result.records.filter(r => r.province === normalizedProvince);
}

export async function searchSponsorshipByCategory(
  category: string,
  options: { limit?: number } = {},
): Promise<FamilySponsorship[]> {
  const result = await ingestFamilySponsorship(options);
  const normalizedCategory = category.toLowerCase();
  return result.records.filter(r => r.sponsorCategory === normalizedCategory);
}

export async function getSponsorshipProcessingTime(
  province: string,
  category: string,
  options: { limit?: number } = {},
): Promise<{ average: number; records: FamilySponsorship[] }> {
  const allRecords = await ingestFamilySponsorship(options);
  const records = allRecords.records.filter(r => 
    r.province === province.toUpperCase() && 
    r.sponsorCategory === category.toLowerCase() &&
    r.processingTime !== null
  );

  if (records.length === 0) {
    return { average: 0, records: [] };
  }

  const sum = records.reduce((acc, r) => acc + (r.processingTime || 0), 0);
  const average = sum / records.length;

  return { average, records };
}