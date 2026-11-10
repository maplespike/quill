// SPDX-License-Identifier: AGPL-3.0-only
/**
 * CPI Fetcher — Statistics Canada Consumer Price Index
 *
 * Fetches CPI data from StatCan WDS for multiple products:
 *   - 18-10-0004-01: CPI monthly, all components (Canada-level)
 *   - 36-10-0222-01: CPI by province
 *
 * Each fetch function parses JSON-stat responses into typed CpiRecord objects.
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
import type { CpiRecord, JsonStatResponse, StatCanIngestionResult } from './types.js';

/* ------------------------------------------------------------------ */
/*  CPI Monthly — All Components (18-10-0004-01)                       */
/* ------------------------------------------------------------------ */

/**
 * Fetch CPI monthly data for all components (Canada-level).
 *
 * Returns typed CpiRecord array. Wraps in try/catch — empty on failure.
 */
export async function fetchCpiMonthly(
  options: { timeoutMs?: number } = {},
): Promise<CpiRecord[]> {
  const timeoutMs = options.timeoutMs ?? WDS_DEFAULT_TIMEOUT_MS;
  const productId = STATCAN_PRODUCTS.CPI_MONTHLY;
  const sourceUrl = statcanTableViewUrl(productId);

  try {
    const data = await getData(productId, { timeoutMs });
    return parseCpiJsonStat(data, productId, sourceUrl);
  } catch (error) {
    console.error(`[statcan/cpi] fetchCpiMonthly failed:`, (error as Error).message);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  CPI by Province (36-10-0222-01)                                    */
/* ------------------------------------------------------------------ */

/**
 * Fetch CPI data broken down by province.
 *
 * Returns typed CpiRecord array. Wraps in try/catch — empty on failure.
 */
export async function fetchCpiByProvince(
  options: { timeoutMs?: number } = {},
): Promise<CpiRecord[]> {
  const timeoutMs = options.timeoutMs ?? WDS_DEFAULT_TIMEOUT_MS;
  const productId = STATCAN_PRODUCTS.CPI_BY_PROVINCE;
  const sourceUrl = statcanTableViewUrl(productId);

  try {
    const data = await getData(productId, { timeoutMs });
    return parseCpiJsonStat(data, productId, sourceUrl);
  } catch (error) {
    console.error(`[statcan/cpi] fetchCpiByProvince failed:`, (error as Error).message);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate Helper                                                   */
/* ------------------------------------------------------------------ */

/**
 * Fetch all CPI data from all configured CPI product IDs.
 */
export async function fetchAllCpi(
  options: { timeoutMs?: number } = {},
): Promise<{ records: CpiRecord[]; results: StatCanIngestionResult[] }> {
  const timeoutMs = options.timeoutMs ?? WDS_DEFAULT_TIMEOUT_MS;
  const allRecords: CpiRecord[] = [];
  const results: StatCanIngestionResult[] = [];

  // CPI Monthly
  const monthlyResult = await fetchWithResult(
    'cpi',
    STATCAN_PRODUCTS.CPI_MONTHLY,
    () => fetchCpiMonthly({ timeoutMs }),
  );
  allRecords.push(...monthlyResult.records);
  results.push(monthlyResult.result);

  // CPI by Province
  const provResult = await fetchWithResult(
    'cpi',
    STATCAN_PRODUCTS.CPI_BY_PROVINCE,
    () => fetchCpiByProvince({ timeoutMs }),
  );
  allRecords.push(...provResult.records);
  results.push(provResult.result);

  return { records: allRecords, results };
}

/* ------------------------------------------------------------------ */
/*  JSON-stat Parser                                                   */
/* ------------------------------------------------------------------ */

/**
 * Parse a JSON-stat response from CPI endpoints into CpiRecord objects.
 */
export function parseCpiJsonStat(
  data: JsonStatResponse,
  productId: string,
  sourceUrl: string,
): CpiRecord[] {
  if (!data.value || !data.dimension || !data.id) {
    console.warn(`[statcan/cpi] Unexpected JSON-stat structure for ${productId}`);
    return [];
  }

  const records: CpiRecord[] = [];
  const values = data.value;
  const ids = data.id;
  const sizes = data.size;
  const dims = data.dimension;
  const now = new Date().toISOString();

  // Find dimension indices
  const timeIdx = ids.indexOf('time');
  const timeValues = timeIdx >= 0 && dims['time']?.category?.label
    ? dims['time'].category.label
    : {};

  // Determine which dimensions map to geography, products, seasonal adjustment
  const geoIdx = ids.findIndex((id) =>
    id.toLowerCase().includes('geo') || id === 'GEO',
  );
  const prodIdx = ids.findIndex((id) =>
    id.toLowerCase().includes('product') || id.toLowerCase().includes('cpi'),
  );
  const seasonIdx = ids.findIndex((id) =>
    id.toLowerCase().includes('season') || id === 'S'
  );
  const unitIdx = ids.findIndex((id) =>
    id.toLowerCase().includes('uom') || id === 'UOM'
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

    // Extract product/category
    const cpiProduct = prodIdx >= 0 ? dimValues[prodIdx] : 'All-items';
    const seasonalAdjustment = seasonIdx >= 0 ? dimValues[seasonIdx] : null;
    const unit = unitIdx >= 0 ? dimValues[unitIdx] : null;

    // Determine province
    const province = extractProvinceCode(geography);

    // Detect city-level geography
    const city = detectCity(geography);

    // Build unique content for hashing
    const content = JSON.stringify({
      productId, timeDim, geography, cpiProduct, rawValue, i
    });
    const id = computeHash(content, 'sha256');

    records.push({
      id: id as unknown as string,
      productId,
      indicatorType: 'cpi',
      value: rawValue,
      period: timeDim,
      date,
      geography,
      geoCode,
      unit,
      seasonalAdjustment,
      ingestedAt: now,
      dimensions: dimLabels,
      sourceUrl,
      cpiProduct,
      cpiCategory: cpiProduct,
      province,
      city,
    });
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Internal Helpers                                                   */
/* ------------------------------------------------------------------ */

/**
 * Resolve the label for a dimension at a given index.
 */
function resolveDimLabel(
  dimensions: Record<string, { category: { label: Record<string, string>; index?: Record<string, number> } }>,
  dimId: string,
  index: number,
): string {
  const dim = dimensions[dimId];
  if (!dim?.category?.label) return String(index);

  // JSON-stat labels are keyed by category key, find the key at this index
  const labelKeys = Object.keys(dim.category.label);
  const key = labelKeys[index] ?? String(index);
  return dim.category.label[key] ?? String(index);
}

/**
 * Extract geo code from dimension data.
 */
function extractGeoCode(
  dimensions: Record<string, { category: { label: Record<string, string>; index?: Record<string, number> } }>,
  ids: string[],
  geoIdx: number,
): string | null {
  if (geoIdx < 0) return null;
  const geoDimId = ids[geoIdx];
  const geoDim = dimensions[geoDimId];
  if (!geoDim?.category?.index) return null;

  // The geo code is the key in the index map
  const indexMap = geoDim.category.index;
  if (typeof indexMap === 'object') {
    return Object.keys(indexMap)[0] ?? null;
  }
  return null;
}

/**
 * Detect if a geography label refers to a city / CMA.
 */
function detectCity(geography: string): string | null {
  if (!geography) return null;

  // StatCan CMAs like "Toronto, Ontario [35535]"
  const cmaMatch = geography.match(/^([A-Za-z\s-]+),/);
  if (cmaMatch) {
    const city = cmaMatch[1].trim();
    // Filter out non-city geographies
    const nonCities = new Set(['Canada', 'Newfoundland and Labrador',
      'Prince Edward Island', 'Nova Scotia', 'New Brunswick',
      'Quebec', 'Ontario', 'Manitoba', 'Saskatchewan',
      'Alberta', 'British Columbia', 'Yukon',
      'Northwest Territories', 'Nunavut']);
    if (!nonCities.has(city)) return city;
  }

  return null;
}

/**
 * Fetch records for a product and wrap in a StatCanIngestionResult.
 */
async function fetchWithResult(
  indicatorType: 'cpi',
  productId: string,
  fetchFn: () => Promise<CpiRecord[]>,
): Promise<{ records: CpiRecord[]; result: StatCanIngestionResult }> {
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
