// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Labour Force Fetcher — Statistics Canada Labour Market Data
 *
 * Fetches labour data from StatCan WDS for multiple products:
 *   - 14-10-0287-01: Labour force characteristics, monthly (by province)
 *   - 14-10-0327-01: Employment by industry, monthly
 *   - 14-10-0064-01: Labour market indicators
 *   - 13-10-0096-01: Employment Insurance statistics
 *   - 14-10-0012-01: Multiple jobholders
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
import type { LabourRecord, JsonStatResponse, StatCanIngestionResult } from './types.js';

/* ------------------------------------------------------------------ */
/*  Individual Product Fetchers                                        */
/* ------------------------------------------------------------------ */

/**
 * Fetch Labour Force Characteristics (14-10-0287-01).
 * Monthly data by province: employment, unemployment, participation rate, etc.
 */
export async function fetchLabourForceCharacteristics(
  options: { timeoutMs?: number } = {},
): Promise<LabourRecord[]> {
  const timeoutMs = options.timeoutMs ?? WDS_DEFAULT_TIMEOUT_MS;
  const productId = STATCAN_PRODUCTS.LABOUR_FORCE_CHARACTERISTICS;
  const sourceUrl = statcanTableViewUrl(productId);

  try {
    const data = await getData(productId, { timeoutMs });
    return parseLabourJsonStat(data, productId, sourceUrl);
  } catch (error) {
    console.error(`[statcan/labour] fetchLabourForceCharacteristics failed:`, (error as Error).message);
    return [];
  }
}

/**
 * Fetch Employment by Industry (14-10-0327-01).
 * Monthly employment numbers by NAICS industry.
 */
export async function fetchEmploymentByIndustry(
  options: { timeoutMs?: number } = {},
): Promise<LabourRecord[]> {
  const timeoutMs = options.timeoutMs ?? WDS_DEFAULT_TIMEOUT_MS;
  const productId = STATCAN_PRODUCTS.EMPLOYMENT_BY_INDUSTRY;
  const sourceUrl = statcanTableViewUrl(productId);

  try {
    const data = await getData(productId, { timeoutMs });
    return parseLabourJsonStat(data, productId, sourceUrl);
  } catch (error) {
    console.error(`[statcan/labour] fetchEmploymentByIndustry failed:`, (error as Error).message);
    return [];
  }
}

/**
 * Fetch Labour Market Indicators (14-10-0064-01).
 * Aggregate labour market metrics.
 */
export async function fetchLabourMarketIndicators(
  options: { timeoutMs?: number } = {},
): Promise<LabourRecord[]> {
  const timeoutMs = options.timeoutMs ?? WDS_DEFAULT_TIMEOUT_MS;
  const productId = STATCAN_PRODUCTS.LABOUR_MARKET_INDICATORS;
  const sourceUrl = statcanTableViewUrl(productId);

  try {
    const data = await getData(productId, { timeoutMs });
    return parseLabourJsonStat(data, productId, sourceUrl);
  } catch (error) {
    console.error(`[statcan/labour] fetchLabourMarketIndicators failed:`, (error as Error).message);
    return [];
  }
}

/**
 * Fetch Employment Insurance statistics (14-10-0012-01).
 * EI beneficiaries and claims by province.
 */
export async function fetchEmploymentInsurance(
  options: { timeoutMs?: number } = {},
): Promise<LabourRecord[]> {
  const timeoutMs = options.timeoutMs ?? WDS_DEFAULT_TIMEOUT_MS;
  const productId = STATCAN_PRODUCTS.EMPLOYMENT_INSURANCE;
  const sourceUrl = statcanTableViewUrl(productId);

  try {
    const data = await getData(productId, { timeoutMs });
    return parseLabourJsonStat(data, productId, sourceUrl);
  } catch (error) {
    console.error(`[statcan/labour] fetchEmploymentInsurance failed:`, (error as Error).message);
    return [];
  }
}

/**
 * Fetch Multiple Jobholders data (14-10-0012-01).
 */
export async function fetchMultipleJobholders(
  options: { timeoutMs?: number } = {},
): Promise<LabourRecord[]> {
  const timeoutMs = options.timeoutMs ?? WDS_DEFAULT_TIMEOUT_MS;
  const productId = STATCAN_PRODUCTS.MULTIPLE_JOBHOLDERS;
  const sourceUrl = statcanTableViewUrl(productId);

  try {
    const data = await getData(productId, { timeoutMs });
    return parseLabourJsonStat(data, productId, sourceUrl);
  } catch (error) {
    console.error(`[statcan/labour] fetchMultipleJobholders failed:`, (error as Error).message);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate Helper                                                   */
/* ------------------------------------------------------------------ */

/**
 * Fetch all labour data from all configured labour product IDs.
 */
export async function fetchAllLabour(
  options: { timeoutMs?: number } = {},
): Promise<{ records: LabourRecord[]; results: StatCanIngestionResult[] }> {
  const timeoutMs = options.timeoutMs ?? WDS_DEFAULT_TIMEOUT_MS;
  const allRecords: LabourRecord[] = [];
  const results: StatCanIngestionResult[] = [];

  const fetchers: Array<{
    id: string;
    fn: (opts: { timeoutMs: number }) => Promise<LabourRecord[]>;
  }> = [
    { id: STATCAN_PRODUCTS.LABOUR_FORCE_CHARACTERISTICS, fn: fetchLabourForceCharacteristics },
    { id: STATCAN_PRODUCTS.EMPLOYMENT_BY_INDUSTRY, fn: fetchEmploymentByIndustry },
    { id: STATCAN_PRODUCTS.LABOUR_MARKET_INDICATORS, fn: fetchLabourMarketIndicators },
    { id: STATCAN_PRODUCTS.EMPLOYMENT_INSURANCE, fn: fetchEmploymentInsurance },
    { id: STATCAN_PRODUCTS.MULTIPLE_JOBHOLDERS, fn: fetchMultipleJobholders },
  ];

  for (const fetcher of fetchers) {
    const result = await fetchWithResult(
      'labour',
      fetcher.id,
      () => fetcher.fn({ timeoutMs }),
    );
    allRecords.push(...result.records);
    results.push(result.result);
  }

  return { records: allRecords, results };
}

/* ------------------------------------------------------------------ */
/*  JSON-stat Parser                                                   */
/* ------------------------------------------------------------------ */

/**
 * Parse a JSON-stat response from Labour endpoints into LabourRecord objects.
 */
export function parseLabourJsonStat(
  data: JsonStatResponse,
  productId: string,
  sourceUrl: string,
): LabourRecord[] {
  if (!data.value || !data.dimension || !data.id) {
    console.warn(`[statcan/labour] Unexpected JSON-stat structure for ${productId}`);
    return [];
  }

  const records: LabourRecord[] = [];
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
  const charIdx = ids.findIndex((id) =>
    id.toLowerCase().includes('labour force') ||
    id.toLowerCase().includes('characteristic'),
  );
  const popIdx = ids.findIndex((id) =>
    id.toLowerCase().includes('population') || id.toLowerCase().includes('age group'),
  );
  const sexIdx = ids.findIndex((id) =>
    id.toLowerCase().includes('sex') || id === 'Sex',
  );
  const industryIdx = ids.findIndex((id) =>
    id.toLowerCase().includes('industry') || id.toLowerCase().includes('naics'),
  );
  const seasonIdx = ids.findIndex((id) =>
    id.toLowerCase().includes('season') || id === 'S',
  );
  const dataTypeIdx = ids.findIndex((id) =>
    id.toLowerCase().includes('data type'),
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

    // Extract labour characteristic
    const labourCharacteristic = charIdx >= 0
      ? dimValues[charIdx]
      : 'Unknown';

    // Extract demographic fields
    const populationGroup = popIdx >= 0 ? dimValues[popIdx] : null;
    const sex = sexIdx >= 0 ? dimValues[sexIdx] : null;
    const industry = industryIdx >= 0 ? dimValues[industryIdx] : null;
    const seasonalAdjustment = seasonIdx >= 0 ? dimValues[seasonIdx] : null;
    const dataType = dataTypeIdx >= 0 ? dimValues[dataTypeIdx] : null;
    const unit = unitIdx >= 0 ? dimValues[unitIdx] : null;

    // Province
    const province = extractProvinceCode(geography);

    // Build unique content for hashing
    const content = JSON.stringify({
      productId, timeDim, geography, labourCharacteristic, rawValue, i
    });
    const id = computeHash(content, 'sha256');

    records.push({
      id: id as unknown as string,
      productId,
      indicatorType: 'labour',
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
      labourCharacteristic,
      populationGroup,
      sex,
      industry,
      naics: null,
      province,
      dataType,
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
  indicatorType: 'labour',
  productId: string,
  fetchFn: () => Promise<LabourRecord[]>,
): Promise<{ records: LabourRecord[]; result: StatCanIngestionResult }> {
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
