// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Fisheries Ingestion Orchestrator — Quill
 *
 * Orchestrates ingestion of Canadian fisheries and oceans data
 * from Fisheries & Oceans Canada, Canadian Coast Guard, aquaculture
 * data, and marine protected areas.
 */

import {
  fetchAllFisheries,
  fetchFishStocks,
  fetchSalmonData,
  fetchGroundfishData,
  fetchShellfishData,
  fetchAquacultureData,
  fetchCoastGuardData,
  fetchMarineProtectedAreas,
} from './fetcher.js';
import {
  FISHERIES_SOURCE_NAMES,
  DEFAULT_MAX_RECORDS,
} from './constants.js';
import type { FisheriesRecord, FisheriesIngestionResult } from './types.js';

/* ------------------------------------------------------------------ */
/*  Individual Ingestion Functions                                     */
/* ------------------------------------------------------------------ */

async function wrapIngestion(
  source: string,
  fetcher: () => Promise<FisheriesRecord[]>,
): Promise<FisheriesIngestionResult> {
  const start = Date.now();
  const errors: string[] = [];
  try {
    const records = await fetcher();
    return { source, recordsFound: records.length, recordsIngested: records.length, errors, durationMs: Date.now() - start };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { source, recordsFound: 0, recordsIngested: 0, errors, durationMs: Date.now() - start };
  }
}

export async function ingestFishStocks(maxRecords = DEFAULT_MAX_RECORDS): Promise<FisheriesIngestionResult> {
  return wrapIngestion(FISHERIES_SOURCE_NAMES.DFO_FISH_STOCKS, () => fetchFishStocks(maxRecords));
}

export async function ingestSalmon(maxRecords = DEFAULT_MAX_RECORDS): Promise<FisheriesIngestionResult> {
  return wrapIngestion(FISHERIES_SOURCE_NAMES.DFO_SALMON, () => fetchSalmonData(maxRecords));
}

export async function ingestGroundfish(maxRecords = DEFAULT_MAX_RECORDS): Promise<FisheriesIngestionResult> {
  return wrapIngestion(FISHERIES_SOURCE_NAMES.DFO_GROUNDFISH, () => fetchGroundfishData(maxRecords));
}

export async function ingestShellfish(maxRecords = DEFAULT_MAX_RECORDS): Promise<FisheriesIngestionResult> {
  return wrapIngestion(FISHERIES_SOURCE_NAMES.DFO_SHELLFISH, () => fetchShellfishData(maxRecords));
}

export async function ingestAquaculture(maxRecords = DEFAULT_MAX_RECORDS): Promise<FisheriesIngestionResult> {
  return wrapIngestion(FISHERIES_SOURCE_NAMES.AQUACULTURE, () => fetchAquacultureData(maxRecords));
}

export async function ingestCoastGuard(maxRecords = DEFAULT_MAX_RECORDS): Promise<FisheriesIngestionResult> {
  return wrapIngestion(FISHERIES_SOURCE_NAMES.COAST_GUARD, () => fetchCoastGuardData(maxRecords));
}

export async function ingestMarineProtectedAreas(maxRecords = DEFAULT_MAX_RECORDS): Promise<FisheriesIngestionResult> {
  return wrapIngestion(FISHERIES_SOURCE_NAMES.MARINE_PROTECTED_AREAS, () => fetchMarineProtectedAreas(maxRecords));
}

/* ------------------------------------------------------------------ */
/*  Ingest All Fisheries (Parallel)                                    */
/* ------------------------------------------------------------------ */

export async function ingestAllFisheries(
  maxRecordsPerSource = DEFAULT_MAX_RECORDS,
): Promise<FisheriesIngestionResult[]> {
  const results: FisheriesIngestionResult[] = [];

  const runners: Array<Promise<FisheriesIngestionResult>> = [
    ingestFishStocks(maxRecordsPerSource),
    ingestSalmon(maxRecordsPerSource),
    ingestGroundfish(maxRecordsPerSource),
    ingestShellfish(maxRecordsPerSource),
    ingestAquaculture(maxRecordsPerSource),
    ingestCoastGuard(maxRecordsPerSource),
    ingestMarineProtectedAreas(maxRecordsPerSource),
  ];

  const settled = await Promise.allSettled(runners);

  for (const s of settled) {
    if (s.status === 'fulfilled') {
      results.push(s.value);
    } else {
      results.push({
        source: 'unknown-fisheries-source',
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

export async function searchFisheries(
  query: string,
  existingRecords?: FisheriesRecord[],
): Promise<FisheriesRecord[]> {
  const q = query.toLowerCase();

  const filter = (r: FisheriesRecord) =>
    r.description.toLowerCase().includes(q) ||
    r.category.toLowerCase().includes(q) ||
    r.subCategory.toLowerCase().includes(q) ||
    r.species.toLowerCase().includes(q) ||
    r.region.toLowerCase().includes(q) ||
    r.sourceName.toLowerCase().includes(q);

  if (existingRecords) return existingRecords.filter(filter);

  const allResults = await fetchAllFisheries(100);
  return Object.values(allResults).flat().filter(filter);
}

/* ------------------------------------------------------------------ */
/*  Re-exports                                                         */
/* ------------------------------------------------------------------ */

export {
  fetchFishStocks,
  fetchSalmonData,
  fetchGroundfishData,
  fetchShellfishData,
  fetchAquacultureData,
  fetchCoastGuardData,
  fetchMarineProtectedAreas,
  fetchAllFisheries,
} from './fetcher.js';

export type { FisheriesRecord, FisheriesIngestionResult } from './types.js';
