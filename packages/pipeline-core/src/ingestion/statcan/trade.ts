// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Trade Fetcher — Statistics Canada International Trade Data
 *
 * Fetches trade data from StatCan WDS for:
 *   - 12-10-0011-01: International merchandise trade (monthly, by partner country)
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
import type { TradeRecord, JsonStatResponse, StatCanIngestionResult } from './types.js';

/* ------------------------------------------------------------------ */
/*  Individual Product Fetchers                                        */
/* ------------------------------------------------------------------ */

/**
 * Fetch International Merchandise Trade (12-10-0011-01).
 * Monthly data by partner country and product category.
 */
export async function fetchInternationalTrade(
  options: { timeoutMs?: number } = {},
): Promise<TradeRecord[]> {
  const timeoutMs = options.timeoutMs ?? WDS_DEFAULT_TIMEOUT_MS;
  const productId = STATCAN_PRODUCTS.INTERNATIONAL_MERCHANDISE_TRADE;
  const sourceUrl = statcanTableViewUrl(productId);

  try {
    const data = await getData(productId, { timeoutMs });
    return parseTradeJsonStat(data, productId, sourceUrl);
  } catch (error) {
    console.error(`[statcan/trade] fetchInternationalTrade failed:`, (error as Error).message);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate Helper                                                   */
/* ------------------------------------------------------------------ */

/**
 * Fetch all trade data.
 */
export async function fetchAllTrade(
  options: { timeoutMs?: number } = {},
): Promise<{ records: TradeRecord[]; results: StatCanIngestionResult[] }> {
  const timeoutMs = options.timeoutMs ?? WDS_DEFAULT_TIMEOUT_MS;
  const allRecords: TradeRecord[] = [];
  const results: StatCanIngestionResult[] = [];

  const result = await fetchWithResult(
    'trade',
    STATCAN_PRODUCTS.INTERNATIONAL_MERCHANDISE_TRADE,
    () => fetchInternationalTrade({ timeoutMs }),
  );
  allRecords.push(...result.records);
  results.push(result.result);

  return { records: allRecords, results };
}

/* ------------------------------------------------------------------ */
/*  JSON-stat Parser                                                   */
/* ------------------------------------------------------------------ */

/**
 * Parse a JSON-stat response from Trade endpoints into TradeRecord objects.
 */
export function parseTradeJsonStat(
  data: JsonStatResponse,
  productId: string,
  sourceUrl: string,
): TradeRecord[] {
  if (!data.value || !data.dimension || !data.id) {
    console.warn(`[statcan/trade] Unexpected JSON-stat structure for ${productId}`);
    return [];
  }

  const records: TradeRecord[] = [];
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
  const tradeDirIdx = ids.findIndex((id) =>
    id.toLowerCase().includes('trade') || id.toLowerCase().includes('export') ||
    id.toLowerCase().includes('import'),
  );
  const partnerIdx = ids.findIndex((id) =>
    id.toLowerCase().includes('partner') || id.toLowerCase().includes('country'),
  );
  const productIdx = ids.findIndex((id) =>
    id.toLowerCase().includes('product') || id.toLowerCase().includes('commodity'),
  );
  const seasonIdx = ids.findIndex((id) =>
    id.toLowerCase().includes('season') || id === 'S',
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

    // Determine trade direction
    const tradeDirLabel = tradeDirIdx >= 0 ? dimValues[tradeDirIdx].toLowerCase() : '';
    let tradeDirection: 'exports' | 'imports' | 'balance' = 'exports';
    if (tradeDirLabel.includes('import')) tradeDirection = 'imports';
    else if (tradeDirLabel.includes('balance') || tradeDirLabel.includes('net')) tradeDirection = 'balance';

    // Partner
    const partner = partnerIdx >= 0 ? dimValues[partnerIdx] : null;
    const partnerCode = partnerIdx >= 0
      ? extractPartnerCode(dims, ids, partnerIdx)
      : null;

    // Product category
    const productCategory = productIdx >= 0 ? dimValues[productIdx] : null;

    // Seasonal adjustment
    const seasonalAdjustment = seasonIdx >= 0 ? dimValues[seasonIdx] : null;
    const unit = unitIdx >= 0 ? dimValues[unitIdx] : null;

    // Province
    const province = extractProvinceCode(geography);

    // Build unique content for hashing
    const content = JSON.stringify({
      productId, timeDim, geography, tradeDirection, partner, rawValue, i
    });
    const id = computeHash(content, 'sha256');

    records.push({
      id: id as unknown as string,
      productId,
      indicatorType: 'trade',
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
      tradeDirection,
      tradeType: 'merchandise',
      partner,
      partnerCode: partnerCode as string | null,
      productCategory,
      province,
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

function extractPartnerCode(
  dimensions: Record<string, { category: { label: Record<string, string>; index?: Record<string, number> } }>,
  ids: string[],
  partnerIdx: number,
): string | null {
  if (partnerIdx < 0) return null;
  const dimId = ids[partnerIdx];
  const dim = dimensions[dimId];
  if (!dim?.category?.index) return null;
  const indexMap = dim.category.index;
  if (typeof indexMap === 'object') {
    const keys = Object.keys(indexMap);
    if (keys.length > 0) return keys[0];
  }
  return null;
}

async function fetchWithResult(
  indicatorType: 'trade',
  productId: string,
  fetchFn: () => Promise<TradeRecord[]>,
): Promise<{ records: TradeRecord[]; result: StatCanIngestionResult }> {
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
