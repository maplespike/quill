/**
 * Ircc Ingestion Module — Quill
 *
 * IRCC Application Processing Times data ingestion from open.canada.ca CKAN portal.
 */

import { fetchIrccCsv } from './fetcher.js';
import { parseProcessingTime } from './parser.js';
import { IRCC_PACKAGES } from './constants.js';
import type { ProcessingTime, IrccIngestionResult } from './types.js';

export async function ingestProcessingTime(
  options: { limit?: number } = {},
): Promise<IrccIngestionResult & { records: ProcessingTime[] }> {
  const startTime = Date.now();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsIngested = 0;
  let records: ProcessingTime[] = [];

  try {
    const csv = await fetchIrccCsv(IRCC_PACKAGES.IRCC_PROCESSING_TIMES);
    records = await parseProcessingTime(csv);
    recordsFound = records.length;
    recordsIngested = records.length;
    if (options.limit) { records = records.slice(0, options.limit); recordsIngested = records.length; }
  } catch (error) {
    errors.push((error as Error).message);
  }

  return {
    dataset: 'ircc-processing-times',
    recordsFound,
    recordsIngested,
    errors,
    durationMs: Date.now() - startTime,
    records,
  };
}

export async function searchByVisaOffice(
  visaOffice: string,
  options: { limit?: number } = {},
): Promise<ProcessingTime[]> {
  const result = await ingestProcessingTime(options);
  const normalized = visaOffice.toLowerCase();
  return result.records.filter(r => r.visaOffice.toString().toLowerCase().includes(normalized));
}

export async function searchByApplicationType(
  applicationType: string,
  options: { limit?: number } = {},
): Promise<ProcessingTime[]> {
  const result = await ingestProcessingTime(options);
  const normalized = applicationType.toLowerCase();
  return result.records.filter(r => r.applicationType.toString().toLowerCase().includes(normalized));
}

