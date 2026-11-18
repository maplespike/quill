// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Ircc Ingestion Module — Quill
 *
 * IRCC Permanent Resident Admissions data ingestion from open.canada.ca CKAN portal.
 */

import { fetchIrccCsv } from './fetcher.js';
import { parsePermanentResidentAdmission } from './parser.js';
import { IRCC_PACKAGES } from './constants.js';
import type { PermanentResidentAdmission, IrccIngestionResult } from './types.js';

export async function ingestPermanentResidentAdmission(
  options: { limit?: number } = {},
): Promise<IrccIngestionResult & { records: PermanentResidentAdmission[] }> {
  const startTime = Date.now();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsIngested = 0;
  let records: PermanentResidentAdmission[] = [];

  try {
    const csv = await fetchIrccCsv(IRCC_PACKAGES.PERMANENT_RESIDENT_ADMISSIONS);
    records = await parsePermanentResidentAdmission(csv);
    recordsFound = records.length;
    recordsIngested = records.length;
    if (options.limit) { records = records.slice(0, options.limit); recordsIngested = records.length; }
  } catch (error) {
    errors.push((error as Error).message);
  }

  return {
    dataset: 'permanent-resident-admissions',
    recordsFound,
    recordsIngested,
    errors,
    durationMs: Date.now() - startTime,
    records,
  };
}

export async function searchByProvince(
  province: string,
  options: { limit?: number } = {},
): Promise<PermanentResidentAdmission[]> {
  const result = await ingestPermanentResidentAdmission(options);
  const normalized = province.toLowerCase();
  return result.records.filter(r => r.province.toString().toLowerCase().includes(normalized));
}

export async function searchByCategory(
  category: string,
  options: { limit?: number } = {},
): Promise<PermanentResidentAdmission[]> {
  const result = await ingestPermanentResidentAdmission(options);
  const normalized = category.toLowerCase();
  return result.records.filter(r => r.category.toString().toLowerCase().includes(normalized));
}

