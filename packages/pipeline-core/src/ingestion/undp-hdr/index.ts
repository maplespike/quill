// SPDX-License-Identifier: AGPL-3.0-only

import { fetchHdrIndicator } from './api.js';
import { parseHdrResponse } from './parser.js';
import { UNDP_HDR_INDICATORS } from './constants.js';
import { buildAttribution, withAttribution } from '../../shared/attribution.js';
import type {
  UndpRecord,
  UndpIngestionResult,
  UndpAllIndicatorsResult,
  UndpIndicator,
  UndpApiResponse,
  UndpApiRow,
} from './types.js';

export async function ingestHdrIndicator(
  indicatorCode: string,
  country?: string,
  yearRange?: string,
): Promise<UndpIngestionResult> {
  const start = Date.now();
  const errors: string[] = [];

  const indicator = UNDP_HDR_INDICATORS.find((i) => i.code === indicatorCode);
  if (!indicator) {
    const validCodes = UNDP_HDR_INDICATORS.map((i) => i.code).join(', ');
    return {
      indicatorCode,
      indicatorName: 'Unknown',
      recordsFound: 0,
      recordsIngested: 0,
      errors: [`Unknown indicator code: ${indicatorCode}. Valid codes: ${validCodes}`],
      durationMs: Date.now() - start,
    };
  }

  try {
    const response = await fetchHdrIndicator(indicatorCode, country, yearRange);
    const records = parseHdrResponse(response.data, indicatorCode);

    return {
      indicatorCode,
      indicatorName: indicator.name,
      recordsFound: response.data.length,
      recordsIngested: records.length,
      errors,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      indicatorCode,
      indicatorName: indicator.name,
      recordsFound: 0,
      recordsIngested: 0,
      errors,
      durationMs: Date.now() - start,
    };
  }
}

export async function ingestAllHdr(
  country?: string,
  yearRange?: string,
): Promise<UndpAllIndicatorsResult> {
  const start = Date.now();
  const results: UndpIngestionResult[] = [];
  let totalRecords = 0;
  let totalErrors = 0;

  for (const indicator of UNDP_HDR_INDICATORS) {
    const result = await ingestHdrIndicator(indicator.code, country, yearRange);
    results.push(result);
    totalRecords += result.recordsIngested;
    totalErrors += result.errors.length;
  }

  return {
    results,
    totalRecords,
    totalErrors,
    durationMs: Date.now() - start,
  };
}

export async function searchHdrRecords(
  indicatorCode: string,
  filters?: {
    country?: string;
    minYear?: number;
    maxYear?: number;
    minValue?: number;
    maxValue?: number;
  },
): Promise<UndpRecord[]> {
  const countryFilter = filters?.country?.toUpperCase();
  const yearRange = filters?.minYear && filters?.maxYear
    ? `${filters.minYear}:${filters.maxYear}`
    : undefined;

  const response = await fetchHdrIndicator(indicatorCode, countryFilter, yearRange);
  const records = parseHdrResponse(response.data, indicatorCode);

  let filtered = records;

  if (filters?.minYear !== undefined) {
    filtered = filtered.filter((r) => r.year >= filters.minYear!);
  }

  if (filters?.maxYear !== undefined) {
    filtered = filtered.filter((r) => r.year <= filters.maxYear!);
  }

  if (filters?.minValue !== undefined) {
    filtered = filtered.filter((r) => r.value !== null && r.value >= filters.minValue!);
  }

  if (filters?.maxValue !== undefined) {
    filtered = filtered.filter((r) => r.value !== null && r.value <= filters.maxValue!);
  }

  return filtered;
}

export { UNDP_HDR_INDICATORS };

export type {
  UndpRecord,
  UndpIngestionResult,
  UndpAllIndicatorsResult,
  UndpIndicator,
  UndpApiResponse,
  UndpApiRow,
};