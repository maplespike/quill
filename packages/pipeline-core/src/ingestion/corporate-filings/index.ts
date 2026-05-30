import { fetchAllFilings } from './fetcher.js';
import { parseFilingReport, deduplicateFilings } from './parser.js';
import {
  initializeCorporateFilingsTable,
  upsertFiling,
  searchFilings,
  getLatestFilingDate,
  deleteOldFilings,
  type D1Database,
} from './db.js';
import type { CorporateFilingsSearchParams, CorporateFilingsIngestionResult, CorporateFiling } from './types.js';

export async function ingestAllFilings(): Promise<CorporateFilingsIngestionResult> {
  const r = await fetchAllFilings();
  return r;
}

export type {
  CorporateFiling,
  CorporateFilingsIngestionResult,
  CorporateFilingsSearchParams,
  D1Database,
};

export {
  parseFilingReport,
  deduplicateFilings,
  initializeCorporateFilingsTable,
  upsertFiling,
  searchFilings,
  getLatestFilingDate,
  deleteOldFilings,
};

export * from './types.js';
export * from './constants.js';
export * from './fetcher.js';
