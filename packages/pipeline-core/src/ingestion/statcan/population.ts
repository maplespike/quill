// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Population Fetcher — Statistics Canada Population Estimates
 *
 * Fetches population data from StatCan WDS for:
 *   - 17-10-0005-01: Population estimates (quarterly, Canada and provinces)
 *   - 17-10-0142-01: Population by age and gender
 *
 * Returns empty array on failure.
 */

import { computeHash } from '../../verification/hashing.js';
import { getData } from './wds.js';
import {
  STATCAN_PRODUCTS,
  statcanTableViewUrl,
  extractProvinceCode,
  parseStatCanDate,
  WDS_DEFAULT_TIMEOUT_MS,
} from './constants.js';
import type { PopulationRecord, JsonStatResponse, StatCanIngestionResult } from './types.js';

/* ------------------------------------------------------------------ */
/*  Individual Product Fetchers                                        */
/* ------------------------------------------------------------------ */

/**
 * Fetch Population Estimates (17-10-0005-01).
 * Quarterly population estimates for Canada, provinces, and territories.
 */
export async function fetchPopulationEstimates(
  options: { timeoutMs?: number } = {},
): Promise<PopulationRecord[]> {
  const timeoutMs = options.timeoutMs ?? WDS_DEFAULT_TIMEOUT_MS;
  const productId = STATCAN_PRODUCTS.POPULATION_ESTIMATES;
  const sourceUrl = statcanTableViewUrl(productId);

  try {
    const data = await getData(productId, { timeoutMs });
    return parsePopulationJsonStat(data, productId, sourceUrl);
  } catch (error) {
    console.error(`[statcan/population] fetchPopulationEstimates failed:`, (error as Error).message);
    return [];
  }
}

/**
 * Fetch Population by Age and Gender (17-10-0142-01).
 * Detailed demographic breakdown.
 */
export async function fetchPopulationByAgeGender(
  options: { timeoutMs?: number } = {},
): Promise<PopulationRecord[]> {
  const timeoutMs = options.timeoutMs ?? WDS_DEFAULT_TIMEOUT_MS;
  const productId = STATCAN_PRODUCTS.POPULATION_BY_AGE_GENDER;
  const sourceUrl = statcanTableViewUrl(productId);

  try {
    const data = await getData(productId, { timeoutMs });
    return parsePopulationJsonStat(data, productId, sourceUrl);
  } catch (error) {
    console.error(`[statcan/population] fetchPopulationByAgeGender failed:`, (error as Error).message);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate Helper                                                   */
/* ------------------------------------------------------------------ */

/**
 * Fetch all population data.
 */
export async function fetchAllPopulation(
  options: { timeoutMs?: number } = {},
): Promise<{ records: PopulationRecord[]; results: StatCanIngestionResult[] }> {
  const timeoutMs = options.timeoutMs ?? WDS_DEFAULT_TIMEOUT_MS;
  const allRecords: PopulationRecord[] = [];
  const results: StatCanIngestionResult[] = [];

  const estimatesResult = await fetchWithResult(
    'population',
    STATCAN_PRODUCTS.POPULATION_ESTIMATES,
    () => fetchPopulationEstimates({ timeoutMs }),
  );
  allRecords.push(...estimatesResult.records);
  results.push(estimatesResult.result);

  const ageGenderResult = await fetchWithResult(
    'population',
    STATCAN_PRODUCTS.POPULATION_BY_AGE_GENDER,
    () => fetchPopulationByAgeGender({ timeoutMs }),
  );
  allRecords.push(...ageGenderResult.records);
  results.push(ageGenderResult.result);

  return { records: allRecords, results };
}

/* ------------------------------------------------------------------ */
/*  JSON-stat Parser                                                   */
/* ------------------------------------------------------------------ */

/**
 * Parse a JSON-stat response from Population endpoints into PopulationRecord objects.
 */
export function parsePopulationJsonStat(
  data: JsonStatResponse,
  productId: string,
  sourceUrl: string,
): PopulationRecord[] {
  if (!data.value || !data.dimension || !data.id) {
    console.warn(`[statcan/population] Unexpected JSON-stat structure for ${productId}`);
    return [];
  }

  const records: PopulationRecord[] = [];
  const values = data.value;
  const ids = data.id;
  const sizes = data.size;
  const dims = data.dimension;
  const now = new Date().toISOString();

  // Find key dimension indices
  const timeIdx = ids.indexOf('time');
  const geoIdx = ids.findIndex((id) =>
    id.toLowerCase().includes('geo') || id === 'GEO',
  );
  const ageIdx = ids.findIndex((id) =>
    id.toLowerCase().includes('age'),
  );
  const sexIdx = ids.findIndex((id) =>
    id.toLowerCase().includes('sex') || id === 'Sex',
  );
  const unitIdx = ids.findIndex((id) =>
    id.toLowerCase().includes('uom') || id === 'UOM',
  );

  for (let i = 0; i < values.length; i++) {
    const rawValue = values[i];
    if (rawValue === null || rawValue === undefined) continue;

    // Resolve multi-dimensional index
    let remaining = i;
    const dimValues: string[] = [];
    const dimLabels: Record<string, string> = {};

    for (let d = 0; d < ids.length; d++) {
      const dimId = ids[d];
      const dimSize = sizes[d];
      const dimIndex = dimSize > 0 ? remaining % dimSize : 0;
      remaining = Math.floor(remaining / dimSize);

      const dimLabel = resolveDimLabel(dims, dimId, dimIndex);
      dimValues.push(dimLabel);
      dimLabels[dimId] = dimLabel;
    }

    // Extract time period
    const timeDim = timeIdx >= 0 && dimValues[timeIdx] ? dimValues[timeIdx] : '';
    const date = parseStatCanDate(timeDim);

    // Extract geography
    const geography = geoIdx >= 0 ? dimValues[geoIdx] : 'Canada';
    const geoCode = extractGeoCode(dims, ids, geoIdx);

    // Extract demographic fields
    const ageGroup = ageIdx >= 0 ? dimValues[ageIdx] : null;
    const sex = sexIdx >= 0 ? dimValues[sexIdx] : null;
    const unit = unitIdx >= 0 ? dimValues[unitIdx] : null;

    // Province
    const province = extractProvinceCode(geography);

    // Population type (estimates vs age/gender)
    const populationType = productId === STATCAN_PRODUCTS.POPULATION_BY_AGE_GENDER
      ? 'age-gender'
      : 'estimates';

    // Build unique content for hashing
    const content = JSON.stringify({
      productId, timeDim, geography, ageGroup, sex, rawValue, i
    });
    const id = computeHash(content, 'sha256');

    records.push({
      id: id as unknown as string,
      productId,
      indicatorType: 'population',
      value: rawValue,
      period: timeDim,
      date,
      geography,
      geoCode,
      unit,
      seasonalAdjustment: null,
      ingestedAt: now,
      dimensions: dimLabels,
      sourceUrl,
      ageGroup,
      sex,
      province,
      populationType,
    });
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Internal Helpers                                                   */
/* ------------------------------------------------------------------ */

function resolveDimLabel(
  dimensions: Record<string, { category: { label: Record<string, string> } }>,
  dimId: string,
  index: number,
): string {
  const dim = dimensions[dimId];
  if (!dim?.category?.label) return String(index);
  const labelKeys = Object.keys(dim.category.label);
  const key = labelKeys[index] ?? String(index);
  return dim.category.label[key] ?? String(index);
}

function extractGeoCode(
  dimensions: Record<string, { category: { label: Record<string, string>; index?: Record<string, number> } }>,
  ids: string[],
  geoIdx: number,
): string | null {
  if (geoIdx < 0) return null;
  const geoDimId = ids[geoIdx];
  const geoDim = dimensions[geoDimId];
  if (!geoDim?.category?.index) return null;
  const indexMap = geoDim.category.index;
  if (typeof indexMap === 'object') {
    return Object.keys(indexMap)[0] ?? null;
  }
  return null;
}

async function fetchWithResult(
  indicatorType: 'population',
  productId: string,
  fetchFn: () => Promise<PopulationRecord[]>,
): Promise<{ records: PopulationRecord[]; result: StatCanIngestionResult }> {
  const start = Date.now();
  const result: StatCanIngestionResult = {
    indicatorType,
    productId,
    recordsFound: 0,
    recordsIngested: 0,
    errors: [],
    durationMs: 0,
  };

  try {
    const records = await fetchFn();
    result.recordsFound = records.length;
    result.recordsIngested = records.length;
    result.durationMs = Date.now() - start;
    return { records, result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    result.durationMs = Date.now() - start;
    return { records: [], result };
  }
}
