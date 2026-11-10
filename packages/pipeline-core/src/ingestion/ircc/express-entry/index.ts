// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Ircc Ingestion Module — Quill
 *
 * IRCC Express Entry Rounds data ingestion from open.canada.ca CKAN portal.
 */

import { fetchIrccCsv } from './fetcher.js';
import { parseExpressEntryRound } from './parser.js';
import { IRCC_PACKAGES } from './constants.js';
import type { ExpressEntryRound, IrccIngestionResult } from './types.js';

export async function ingestExpressEntryRound(
  options: { limit?: number } = {},
): Promise<IrccIngestionResult & { records: ExpressEntryRound[] }> {
  const startTime = Date.now();
  const errors: string[] = [];
  let recordsFound = 0;
  let recordsIngested = 0;
  let records: ExpressEntryRound[] = [];

  try {
    const csv = await fetchIrccCsv(IRCC_PACKAGES.EXPRESS_ENTRY_ROUNDS);
    records = await parseExpressEntryRound(csv);
    recordsFound = records.length;
    recordsIngested = records.length;
    if (options.limit) { records = records.slice(0, options.limit); recordsIngested = records.length; }
  } catch (error) {
    errors.push((error as Error).message);
  }

  return {
    dataset: 'express-entry-rounds',
    recordsFound,
    recordsIngested,
    errors,
    durationMs: Date.now() - startTime,
    records,
  };
}

export async function searchByProgram(
  program: string,
  options: { limit?: number } = {},
): Promise<ExpressEntryRound[]> {
  const result = await ingestExpressEntryRound(options);
  const normalized = program.toLowerCase();
  return result.records.filter(r => r.program.toString().toLowerCase().includes(normalized));
}

export async function searchByCrsCutoff(
  crsCutoff: string,
  options: { limit?: number } = {},
): Promise<ExpressEntryRound[]> {
  const result = await ingestExpressEntryRound(options);
  const normalized = crsCutoff.toLowerCase();
  return result.records.filter(r => r.crsCutoff != null && r.crsCutoff.toString().toLowerCase().includes(normalized));
}

