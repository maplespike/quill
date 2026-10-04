/**
 * Agriculture Ingestion Orchestrator — Quill
 *
 * Orchestrates ingestion of Canadian agriculture and agri-food data
 * from Agriculture & Agri-Food Canada, CFIA, Canadian Grain Commission,
 * Canadian Dairy Commission, and Farm Credit Canada.
 */

import {
  fetchAllAgriculture,
  fetchAafcData,
  fetchDairyPoultryData,
  fetchCfiaData,
  fetchGrainData,
  fetchFarmCreditCanadaData,
} from './fetcher.js';
import {
  AGRICULTURE_SOURCE_NAMES,
  DEFAULT_MAX_RECORDS,
} from './constants.js';
import type { AgricultureRecord, AgricultureIngestionResult } from './types.js';

/* ------------------------------------------------------------------ */
/*  Individual Ingestion Functions                                     */
/* ------------------------------------------------------------------ */

/**
 * Ingest AAFC crops and livestock data.
 */
export async function ingestAafc(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<AgricultureIngestionResult> {
  const start = Date.now();
  const errors: string[] = [];

  try {
    const records = await fetchAafcData(maxRecords);
    return {
      source: AGRICULTURE_SOURCE_NAMES.AAFC_CROPS,
      recordsFound: records.length,
      recordsIngested: records.length,
      errors,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      source: AGRICULTURE_SOURCE_NAMES.AAFC_CROPS,
      recordsFound: 0,
      recordsIngested: 0,
      errors,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Ingest dairy and poultry data.
 */
export async function ingestDairyPoultry(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<AgricultureIngestionResult> {
  const start = Date.now();
  const errors: string[] = [];

  try {
    const records = await fetchDairyPoultryData(maxRecords);
    return {
      source: AGRICULTURE_SOURCE_NAMES.DAIRY_POULTRY,
      recordsFound: records.length,
      recordsIngested: records.length,
      errors,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      source: AGRICULTURE_SOURCE_NAMES.DAIRY_POULTRY,
      recordsFound: 0,
      recordsIngested: 0,
      errors,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Ingest CFIA food recall data.
 */
export async function ingestCfia(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<AgricultureIngestionResult> {
  const start = Date.now();
  const errors: string[] = [];

  try {
    const records = await fetchCfiaData(maxRecords);
    return {
      source: AGRICULTURE_SOURCE_NAMES.CFIA_RECALLS,
      recordsFound: records.length,
      recordsIngested: records.length,
      errors,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      source: AGRICULTURE_SOURCE_NAMES.CFIA_RECALLS,
      recordsFound: 0,
      recordsIngested: 0,
      errors,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Ingest grain data.
 */
export async function ingestGrain(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<AgricultureIngestionResult> {
  const start = Date.now();
  const errors: string[] = [];

  try {
    const records = await fetchGrainData(maxRecords);
    return {
      source: AGRICULTURE_SOURCE_NAMES.GRAIN_EXPORTS,
      recordsFound: records.length,
      recordsIngested: records.length,
      errors,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      source: AGRICULTURE_SOURCE_NAMES.GRAIN_EXPORTS,
      recordsFound: 0,
      recordsIngested: 0,
      errors,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Ingest Farm Credit Canada data.
 */
export async function ingestFarmCreditCanada(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<AgricultureIngestionResult> {
  const start = Date.now();
  const errors: string[] = [];

  try {
    const records = await fetchFarmCreditCanadaData(maxRecords);
    return {
      source: AGRICULTURE_SOURCE_NAMES.FARM_CREDIT_CANADA,
      recordsFound: records.length,
      recordsIngested: records.length,
      errors,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      source: AGRICULTURE_SOURCE_NAMES.FARM_CREDIT_CANADA,
      recordsFound: 0,
      recordsIngested: 0,
      errors,
      durationMs: Date.now() - start,
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Ingest All Agriculture (Parallel)                                  */
/* ------------------------------------------------------------------ */

/**
 * Run all agriculture ingestion jobs in parallel.
 * Returns a flat array of ingestion results (one per source).
 */
export async function ingestAllAgriculture(
  maxRecordsPerSource = DEFAULT_MAX_RECORDS,
): Promise<AgricultureIngestionResult[]> {
  const results: AgricultureIngestionResult[] = [];

  const runners: Array<Promise<AgricultureIngestionResult>> = [
    ingestAafc(maxRecordsPerSource),
    ingestDairyPoultry(maxRecordsPerSource),
    ingestCfia(maxRecordsPerSource),
    ingestGrain(maxRecordsPerSource),
    ingestFarmCreditCanada(maxRecordsPerSource),
  ];

  const settled = await Promise.allSettled(runners);

  for (const s of settled) {
    if (s.status === 'fulfilled') {
      results.push(s.value);
    } else {
      results.push({
        source: 'unknown-agriculture-source',
        recordsFound: 0,
        recordsIngested: 0,
        errors: [s.reason instanceof Error ? s.reason.message : String(s.reason)],
        durationMs: 0,
      });
    }
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  Search                                                             */
/* ------------------------------------------------------------------ */

/**
 * Search across fetched agriculture records for a term.
 * Note: In-memory search; production should use database search.
 */
export async function searchAgriculture(
  query: string,
  existingRecords?: AgricultureRecord[],
): Promise<AgricultureRecord[]> {
  const q = query.toLowerCase();

  if (existingRecords) {
    return existingRecords.filter(r =>
      r.description.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.subCategory.toLowerCase().includes(q) ||
      r.commodity.toLowerCase().includes(q) ||
      r.region.toLowerCase().includes(q) ||
      r.sourceName.toLowerCase().includes(q)
    );
  }

  // Fetch fresh data if no records provided
  const allResults = await fetchAllAgriculture(100);
  const allRecords = Object.values(allResults).flat();
  return allRecords.filter(r =>
    r.description.toLowerCase().includes(q) ||
    r.category.toLowerCase().includes(q) ||
    r.subCategory.toLowerCase().includes(q) ||
    r.commodity.toLowerCase().includes(q) ||
    r.region.toLowerCase().includes(q) ||
    r.sourceName.toLowerCase().includes(q)
  );
}

/* ------------------------------------------------------------------ */
/*  Re-exports for convenience                                         */
/* ------------------------------------------------------------------ */

export {
  fetchAafcData,
  fetchDairyPoultryData,
  fetchCfiaData,
  fetchGrainData,
  fetchFarmCreditCanadaData,
  fetchAllAgriculture,
} from './fetcher.js';

export type { AgricultureRecord, AgricultureIngestionResult } from './types.js';
export { parseAgricultureRecord, parseAgricultureRecords, normalizeDate, parseNumeric } from './parser.js';
