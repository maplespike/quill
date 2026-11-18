// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Ircc Ingestion Module — Quill
 *
 * IRCC Study Permit Holders data ingestion from open.canada.ca CKAN portal.
 */

import { fetchIrccCsv } from './fetcher.js';
import { parseStudyPermit } from './parser.js';
import { IRCC_PACKAGES } from './constants.js';
import type { StudyPermit, IrccIngestionResult } from './types.js';

export async function ingestStudyPermit(
  options: { limit?: number } = {},
): Promise<IrccIngestionResult & { records: StudyPermit[] }> {
  const startTime = Date.now();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsIngested = 0;
  let records: StudyPermit[] = [];

  try {
    const csv = await fetchIrccCsv(IRCC_PACKAGES.STUDY_PERMIT_HOLDERS);
    records = await parseStudyPermit(csv);
    recordsFound = records.length;
    recordsIngested = records.length;
    if (options.limit) { records = records.slice(0, options.limit); recordsIngested = records.length; }
  } catch (error) {
    errors.push((error as Error).message);
  }

  return {
    dataset: 'study-permit-holders',
    recordsFound,
    recordsIngested,
    errors,
    durationMs: Date.now() - startTime,
    records,
  };
}

export async function searchStudyPermitsByProvince(
  province: string,
  options: { limit?: number } = {},
): Promise<StudyPermit[]> {
  const result = await ingestStudyPermit(options);
  const normalized = province.toLowerCase();
  return result.records.filter(r => r.province.toString().toLowerCase().includes(normalized));
}

export async function searchStudyPermitsByInstitution(
  institution: string,
  options: { limit?: number } = {},
): Promise<StudyPermit[]> {
  const result = await ingestStudyPermit(options);
  const normalized = institution.toLowerCase();
  return result.records.filter(r => r.institution.toString().toLowerCase().includes(normalized));
}

