// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Ircc Ingestion Module — Quill
 *
 * IRCC Work Permit Holders data ingestion from open.canada.ca CKAN portal.
 */

import { fetchIrccCsv } from './fetcher.js';
import { parseWorkPermit } from './parser.js';
import { IRCC_PACKAGES } from './constants.js';
import type { WorkPermit, IrccIngestionResult } from './types.js';

export async function ingestWorkPermit(
  options: { limit?: number } = {},
): Promise<IrccIngestionResult & { records: WorkPermit[] }> {
  const startTime = Date.now();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsIngested = 0;
  let records: WorkPermit[] = [];

  try {
    const csv = await fetchIrccCsv(IRCC_PACKAGES.WORK_PERMIT_HOLDERS);
    records = await parseWorkPermit(csv);
    recordsFound = records.length;
    recordsIngested = records.length;
    if (options.limit) { records = records.slice(0, options.limit); recordsIngested = records.length; }
  } catch (error) {
    errors.push((error as Error).message);
  }

  return {
    dataset: 'work-permit-holders',
    recordsFound,
    recordsIngested,
    errors,
    durationMs: Date.now() - startTime,
    records,
  };
}

export async function searchWorkPermitsByProvince(
  province: string,
  options: { limit?: number } = {},
): Promise<WorkPermit[]> {
  const result = await ingestWorkPermit(options);
  const normalized = province.toLowerCase();
  return result.records.filter(r => r.province.toString().toLowerCase().includes(normalized));
}

export async function searchWorkPermitsByNoc(
  nocCode: string,
  options: { limit?: number } = {},
): Promise<WorkPermit[]> {
  const result = await ingestWorkPermit(options);
  const normalized = nocCode.toLowerCase();
  return result.records.filter(r => r.nocCode.toString().toLowerCase().includes(normalized));
}

