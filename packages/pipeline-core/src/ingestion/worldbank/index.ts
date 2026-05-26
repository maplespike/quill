/**
 * World Bank Ingestion — MapleSpike Pipeline
 *
 * Orchestrates World Bank data ingestion across all major
 * development indicator categories via the Indicators API V2.
 *
 * Covers 50+ top indicators across economy, trade, health,
 * education, population, environment, infrastructure, poverty,
 * finance, and more.
 */

import { computeHash } from '../../verification/hashing.js';
import { fetchIndicatorAllCountries } from './api.js';
import {
  WB_INDICATORS,
  WB_TOP_INDICATORS,
  WB_INDICATOR_CATEGORIES,
  WB_INDICATORS_BY_CATEGORY,
  wbDataExplorerUrl,
  wbIndicatorName,
  WB_DEFAULT_TIMEOUT_MS,
} from './constants.js';
import type {
  WorldBankRecord,
  WorldBankIndicatorCategory,
  WorldBankIngestionResult,
  WorldBankAllIndicatorsResult,
  WbApiRecord,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Single Indicator Fetcher                                           */
/* ------------------------------------------------------------------ */

/**
 * Fetch data for a single World Bank indicator (all countries).
 *
 * Returns typed WorldBankRecord array. Returns empty on failure.
 */
export async function ingestByIndicator(
  indicatorCode: string,
  options: { timeoutMs?: number } = {},
): Promise<WorldBankIngestionResult> {
  const start = Date.now();
  const errors: string[] = [];
  const indicatorName = wbIndicatorName(indicatorCode);
  const sourceUrl = wbDataExplorerUrl(indicatorCode);
  const timeoutMs = options.timeoutMs ?? WB_DEFAULT_TIMEOUT_MS;

  try {
    const [metadata, records] = await fetchIndicatorAllCountries(indicatorCode, { timeoutMs });

    if (!records || records.length === 0) {
      return {
        indicatorCode,
        indicatorName,
        recordsFound: 0,
        recordsIngested: 0,
        errors: [],
        durationMs: Date.now() - start,
      };
    }

    const ingested = records.map((r) => parseWbRecord(r, indicatorCode, indicatorName, sourceUrl));
    const valid = ingested.filter((r): r is WorldBankRecord => r !== null);

    return {
      indicatorCode,
      indicatorName,
      recordsFound: records.length,
      recordsIngested: valid.length,
      errors,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      indicatorCode,
      indicatorName,
      recordsFound: 0,
      recordsIngested: 0,
      errors,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Fetch all indicators in a category.
 */
export async function ingestByCategory(
  category: WorldBankIndicatorCategory,
  options: { timeoutMs?: number } = {},
): Promise<WorldBankAllIndicatorsResult> {
  const start = Date.now();
  const indicators = WB_INDICATORS_BY_CATEGORY[category];
  const results: WorldBankIngestionResult[] = [];
  let totalRecords = 0;
  let totalErrors = 0;

  for (const code of indicators) {
    const result = await ingestByIndicator(code, options);
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

/**
 * Fetch all 50+ top World Bank indicators.
 */
export async function ingestAllWorldBank(
  options: { timeoutMs?: number } = {},
): Promise<WorldBankAllIndicatorsResult> {
  const start = Date.now();
  const results: WorldBankIngestionResult[] = [];
  let totalRecords = 0;
  let totalErrors = 0;
  const timeoutMs = options.timeoutMs ?? WB_DEFAULT_TIMEOUT_MS;

  // Fetch in batches to avoid overwhelming the API
  const batchSize = 5;
  for (let i = 0; i < WB_TOP_INDICATORS.length; i += batchSize) {
    const batch = WB_TOP_INDICATORS.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((code) => ingestByIndicator(code, { timeoutMs })),
    );

    for (const result of batchResults) {
      results.push(result);
      totalRecords += result.recordsIngested;
      totalErrors += result.errors.length;
    }
  }

  return {
    results,
    totalRecords,
    totalErrors,
    durationMs: Date.now() - start,
  };
}

/* ------------------------------------------------------------------ */
/*  Record Parser                                                      */
/* ------------------------------------------------------------------ */

/**
 * Parse a raw World Bank API record into a typed WorldBankRecord.
 */
export function parseWbRecord(
  raw: WbApiRecord,
  indicatorCode: string,
  indicatorName: string,
  sourceUrl: string,
): WorldBankRecord | null {
  if (!raw || !raw.country || !raw.date) return null;

  const year = parseInt(raw.date, 10);
  if (isNaN(year)) return null;

  const category = WB_INDICATOR_CATEGORIES[indicatorCode] ?? 'economy';
  const now = new Date().toISOString();

  const content = JSON.stringify({
    indicatorCode,
    countryCode: raw.country.id,
    date: raw.date,
    value: raw.value,
  });
  const id = String(computeHash(content, 'sha256'));

  return {
    id,
    indicatorCode,
    indicatorName,
    indicatorCategory: category,
    value: raw.value,
    countryCode: raw.country.id,
    countryName: raw.country.value,
    year,
    date: `${year}-01-01`,
    ingestedAt: now,
    unit: raw.unit || null,
    decimal: raw.decimal ?? null,
    sourceUrl,
  };
}

export { WB_INDICATORS, WB_INDICATORS_BY_CATEGORY, WB_INDICATOR_CATEGORIES, WB_TOP_INDICATORS } from './constants.js';
