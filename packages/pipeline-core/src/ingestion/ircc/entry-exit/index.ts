// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Ircc Ingestion Module — Quill
 *
 * IRCC Quarterly Entry/Exit Data data ingestion from open.canada.ca CKAN portal.
 */

import { fetchIrccCsv } from './fetcher.js';
import { parseEntryExit } from './parser.js';
import { IRCC_PACKAGES } from './constants.js';
import type { EntryExit, IrccIngestionResult } from './types.js';

export async function ingestEntryExit(
  options: { limit?: number } = {},
): Promise<IrccIngestionResult & { records: EntryExit[] }> {
  const startTime = Date.now();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsIngested = 0;
  let records: EntryExit[] = [];

  try {
    const csv = await fetchIrccCsv(IRCC_PACKAGES.IRCC_QUARTERLY_ENTRY_EXIT);
    records = await parseEntryExit(csv);
    recordsFound = records.length;
    recordsIngested = records.length;
    if (options.limit) { records = records.slice(0, options.limit); recordsIngested = records.length; }
  } catch (error) {
    errors.push((error as Error).message);
  }

  return {
    dataset: 'ircc-quarterly-entry-exit',
    recordsFound,
    recordsIngested,
    errors,
    durationMs: Date.now() - startTime,
    records,
  };
}

export async function searchByNationality(
  nationality: string,
  options: { limit?: number } = {},
): Promise<EntryExit[]> {
  const result = await ingestEntryExit(options);
  const normalized = nationality.toLowerCase();
  return result.records.filter(r => r.nationality.toString().toLowerCase().includes(normalized));
}

export async function searchByQuarter(
  quarter: string,
  options: { limit?: number } = {},
): Promise<EntryExit[]> {
  const result = await ingestEntryExit(options);
  const normalized = quarter.toLowerCase();
  return result.records.filter(r => r.quarter.toString().toLowerCase().includes(normalized));
}

