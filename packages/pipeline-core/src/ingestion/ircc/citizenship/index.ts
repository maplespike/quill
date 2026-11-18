// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Ircc Ingestion Module — Quill
 *
 * IRCC Citizenship Grants data ingestion from open.canada.ca CKAN portal.
 */

import { fetchIrccCsv } from './fetcher.js';
import { parseCitizenshipGrant } from './parser.js';
import { IRCC_PACKAGES } from './constants.js';
import type { CitizenshipGrant, IrccIngestionResult } from './types.js';

export async function ingestCitizenshipGrant(
  options: { limit?: number } = {},
): Promise<IrccIngestionResult & { records: CitizenshipGrant[] }> {
  const startTime = Date.now();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsIngested = 0;
  let records: CitizenshipGrant[] = [];

  try {
    const csv = await fetchIrccCsv(IRCC_PACKAGES.CITIZENSHIP_GRANTS);
    records = await parseCitizenshipGrant(csv);
    recordsFound = records.length;
    recordsIngested = records.length;
    if (options.limit) { records = records.slice(0, options.limit); recordsIngested = records.length; }
  } catch (error) {
    errors.push((error as Error).message);
  }

  return {
    dataset: 'citizenship-grants',
    recordsFound,
    recordsIngested,
    errors,
    durationMs: Date.now() - startTime,
    records,
  };
}

export async function searchCitizenshipByProvince(
  province: string,
  options: { limit?: number } = {},
): Promise<CitizenshipGrant[]> {
  const result = await ingestCitizenshipGrant(options);
  const normalized = province.toLowerCase();
  return result.records.filter(r => r.province.toString().toLowerCase().includes(normalized));
}

export async function searchCitizenshipByYear(
  year: string,
  options: { limit?: number } = {},
): Promise<CitizenshipGrant[]> {
  const result = await ingestCitizenshipGrant(options);
  const normalized = year.toLowerCase();
  return result.records.filter(r => r.year.toString().toLowerCase().includes(normalized));
}

