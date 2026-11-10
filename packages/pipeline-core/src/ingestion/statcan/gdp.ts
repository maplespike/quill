// SPDX-License-Identifier: AGPL-3.0-only
/**
 * GDP Fetcher — Statistics Canada Gross Domestic Product
 *
 * Fetches GDP data from StatCan WDS for:
 *   - 36-10-0434-01: GDP by industry, monthly (chained 2017 dollars)
 *
 * Each fetch function parses JSON-stat responses into typed GdpRecord objects.
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
import type { GdpRecord, JsonStatResponse, StatCanIngestionResult } from './types.js';

/* ------------------------------------------------------------------ */
/*  GDP by Industry, Monthly (36-10-0434-01)                           */
/* ------------------------------------------------------------------ */

/**
 * Fetch monthly GDP by industry data.
 *
 * Returns typed GdpRecord array. Wraps in try/catch — empty on failure.
 */
export async function fetchGdpByIndustry(
  options: { timeoutMs?: number } = {},
): Promise<GdpRecord[]> {
  const timeoutMs = options.timeoutMs ?? WDS_DEFAULT_TIMEOUT_MS;
  const productId = STATCAN_PRODUCTS.GDP_BY_INDUSTRY_MONTHLY;
  const sourceUrl = statcanTableViewUrl(productId);

  try {
    const data = await getData(productId, { timeoutMs });
    return parseGdpJsonStat(data, productId, sourceUrl);
  } catch (error) {
    console.error(`[statcan/gdp] fetchGdpByIndustry failed:`, (error as Error).message);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate Helper                                                   */
/* ------------------------------------------------------------------ */

/**
 * Fetch all GDP data.
 */
export async function fetchAllGdp(
  options: { timeoutMs?: number } = {},
): Promise<{ records: GdpRecord[]; results: StatCanIngestionResult[] }> {
  const timeoutMs = options.timeoutMs ?? WDS_DEFAULT_TIMEOUT_MS;
  const allRecords: GdpRecord[] = [];
  const results: StatCanIngestionResult[] = [];

  const result = await fetchWithResult(
    'gdp',
    STATCAN_PRODUCTS.GDP_BY_INDUSTRY_MONTHLY,
    () => fetchGdpByIndustry({ timeoutMs }),
  );
  allRecords.push(...result.records);
  results.push(result.result);

  return { records: allRecords, results };
}

/* ------------------------------------------------------------------ */
/*  JSON-stat Parser                                                   */
/* ------------------------------------------------------------------ */

/**
 * Parse a JSON-stat response from GDP endpoints into GdpRecord objects.
 */
export function parseGdpJsonStat(
  data: JsonStatResponse,
  productId: string,
  sourceUrl: string,
): GdpRecord[] {
  if (!data.value || !data.dimension || !data.id) {
    console.warn(`[statcan/gdp] Unexpected JSON-stat structure for ${productId}`);
    return [];
  }

  const records: GdpRecord[] = [];
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
  const naicsIdx = ids.findIndex((id) =>
    id.toLowerCase().includes('naics') || id.toLowerCase().includes('industry'),
  );
  const seasonIdx = ids.findIndex((id) =>
    id.toLowerCase().includes('season') || id === 'S',
  );
  const priceIdx = ids.findIndex((id) =>
    id.toLowerCase().includes('price') || id.toLowerCase().includes('prices'),
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

    // Extract industry / NAICS
    const industry = naicsIdx >= 0 ? dimValues[naicsIdx] : 'All industries';
    const naics = extractNaicsCode(industry);

    // Extract other dimensions
    const seasonalAdjustment = seasonIdx >= 0 ? dimValues[seasonIdx] : null;
    const gdpTypeLabel = priceIdx >= 0 ? dimValues[priceIdx] : '';
    const gdpType: 'chained' | 'current' =
      gdpTypeLabel.toLowerCase().includes('chained') ||
      gdpTypeLabel.toLowerCase().includes('2017') ||
      gdpTypeLabel.toLowerCase().includes('real')
        ? 'chained' : 'current';
    const unit = unitIdx >= 0 ? dimValues[unitIdx] : null;

    // Province
    const province = extractProvinceCode(geography);

    // Build unique content for hashing
    const content = JSON.stringify({
      productId, timeDim, geography, industry, rawValue, i
    });
    const id = computeHash(content, 'sha256');

    records.push({
      id: id as unknown as string,
      productId,
      indicatorType: 'gdp',
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
      industry,
      naics,
      province,
      gdpType,
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

/**
 * Extract NAICS code from industry label.
 * e.g. "11 Agriculture, forestry, fishing and hunting [11]" -> "11"
 */
function extractNaicsCode(industryLabel: string): string | null {
  if (!industryLabel) return null;
  const bracketMatch = industryLabel.match(/\[(\d{2,6})\]$/);
  if (bracketMatch) return bracketMatch[1];
  // Try short 2-digit codes
  const leadingMatch = industryLabel.match(/^(\d{2})\s/);
  if (leadingMatch) return leadingMatch[1];
  return null;
}

async function fetchWithResult(
  indicatorType: 'gdp',
  productId: string,
  fetchFn: () => Promise<GdpRecord[]>,
): Promise<{ records: GdpRecord[]; result: StatCanIngestionResult }> {
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
