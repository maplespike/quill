// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * UNESCO Institute for Statistics (UIS) — Main Ingest Module
 *
 * Provides access to UNESCO data on education, culture, and science via
 * the UNESCO SDMX REST API. Covers literacy, enrollment, spending,
 * R&D expenditure, cultural indicators, and more.
 *
 * API Reference:
 *   Base: https://api.uis.unesco.org/sdmx
 *   Format: SDMX-JSON (v2.0)
 *   Auth: API key required (UNESCO_API_KEY environment variable)
 *
 * See: https://apiportal.uis.unesco.org/
 */

import { buildAttribution, withAttribution } from "../../shared/attribution.js";
import {
  fetchDataflowByIndicator,
  fetchMultipleIndicators,
  healthCheck,
} from "./fetcher.js";
import {
  ALL_UNESCO_INDICATORS,
  INDICATOR_CATEGORIES,
  EDUCATION_INDICATORS,
  CULTURE_INDICATORS,
  SCIENCE_INDICATORS,
} from "./constants.js";
import { parseSdmxResponse } from "./parser.js";
import type {
  UnescoSdmxResponse,
  UnescoRecord,
  UnescoIngestionResult,
} from "./types.js";

function makeUnescoAttribution() {
  return buildAttribution("UNESCO Institute for Statistics (UIS)", {
    sourceUrl: "https://apiportal.uis.unesco.org/",
    license: "UNESCO data usage terms",
    attributionText: "Source: UNESCO Institute for Statistics (UIS)",
  });
}

/**
 * Ingest a single UNESCO indicator.
 *
 * Fetches the SDMX dataflow for the given indicator code, parses the
 * SDMX-JSON response into normalized records, and returns ingestion results.
 */
export async function ingestUnescoIndicator(
  indicatorCode: string,
  options?: {
    startPeriod?: string;
    endPeriod?: string;
    refArea?: string;
  },
): Promise<UnescoIngestionResult> {
  const startTime = Date.now();
  const indicatorName =
    ALL_UNESCO_INDICATORS[indicatorCode as keyof typeof ALL_UNESCO_INDICATORS] ?? indicatorCode;

  // Determine category
  let category = "education";
  if (indicatorCode in CULTURE_INDICATORS) {
    category = "culture";
  } else if (indicatorCode in SCIENCE_INDICATORS) {
    category = "science";
  }

  try {
    const response = await fetchDataflowByIndicator(indicatorCode, {
      startPeriod: options?.startPeriod,
      endPeriod: options?.endPeriod,
      refArea: options?.refArea,
    });

    const records = parseSdmxResponse(response, indicatorCode, indicatorName, category);

    return {
      dataflowId: `DF_${indicatorCode}`,
      dataflowName: indicatorName,
      recordsFound: records.length,
      recordsIngested: records.length,
      errors: [],
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      dataflowId: `DF_${indicatorCode}`,
      dataflowName: indicatorName,
      recordsFound: 0,
      recordsIngested: 0,
      errors: [(error as Error).message],
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Fetch and ingest data for multiple UNESCO indicators.
 *
 * Processes indicators sequentially respecting rate limits.
 */
export async function ingestAllUnesco(
  options?: {
    startPeriod?: string;
    endPeriod?: string;
    refArea?: string;
    indicators?: readonly string[];
  },
): Promise<UnescoIngestionResult[]> {
  const indicatorCodes = options?.indicators ??
    (Object.keys(ALL_UNESCO_INDICATORS) as readonly string[]);
  const results: UnescoIngestionResult[] = [];

  for (const code of indicatorCodes) {
    const result = await ingestUnescoIndicator(code, {
      startPeriod: options?.startPeriod,
      endPeriod: options?.endPeriod,
      refArea: options?.refArea,
    });
    results.push(result);
  }

  return results;
}

/**
 * Search UNESCO records by keyword.
 * Delegates to the standard API fetch with attribution wrapper.
 */
export async function searchUnescoRecords(query: string): Promise<unknown> {
  const attribution = makeUnescoAttribution();
  // Search is a passthrough — users filter by indicator code
  const matchingIndicators = Object.entries(ALL_UNESCO_INDICATORS)
    .filter(([code, name]) =>
      code.toLowerCase().includes(query.toLowerCase()) ||
      name.toLowerCase().includes(query.toLowerCase())
    )
    .map(([code, name]) => ({ code, name }));

  return withAttribution(
    {
      query,
      matches: matchingIndicators,
      totalMatches: matchingIndicators.length,
      availableIndicators: Object.entries(ALL_UNESCO_INDICATORS).map(
        ([code, name]) => ({ code, name }),
      ),
    },
    attribution,
  );
}

/**
 * Get data for a specific category of indicators (education, culture, or science).
 */
export async function ingestCategory(
  categoryCode: string,
  options?: {
    startPeriod?: string;
    endPeriod?: string;
    refArea?: string;
  },
): Promise<UnescoIngestionResult[]> {
  const category = INDICATOR_CATEGORIES[categoryCode as keyof typeof INDICATOR_CATEGORIES];
  if (!category) {
    throw new Error(
      `Unknown category: ${categoryCode}. Valid categories: ${Object.keys(INDICATOR_CATEGORIES).join(", ")}`,
    );
  }

  return ingestAllUnesco({
    ...options,
    indicators: [...category.indicators],
  });
}

/**
 * Get all available indicator codes grouped by category.
 */
export function getAvailableIndicators(): Record<string, Array<{ code: string; name: string }>> {
  return {
    education: Object.entries(EDUCATION_INDICATORS).map(([code, name]) => ({ code, name })),
    culture: Object.entries(CULTURE_INDICATORS).map(([code, name]) => ({ code, name })),
    science: Object.entries(SCIENCE_INDICATORS).map(([code, name]) => ({ code, name })),
  };
}

// Re-exports
export { healthCheck } from "./fetcher.js";
export {
  ALL_UNESCO_INDICATORS,
  INDICATOR_CATEGORIES,
  EDUCATION_INDICATORS,
  CULTURE_INDICATORS,
  SCIENCE_INDICATORS,
} from "./constants.js";
export type { UnescoRecord, UnescoIngestionResult } from "./types.js";
