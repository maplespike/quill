// SPDX-License-Identifier: AGPL-3.0-only

import { fetchFaoDataset, fetchFaoDomainList } from './fetcher.js';
import { parseFaoResponse } from './parser.js';
import { FAO_DOMAINS, KEY_DOMAINS, COMMON_COUNTRIES, FAO_API_BASE } from './constants.js';
import { buildAttribution, withAttribution } from '../../shared/attribution.js';
import type { FaoRecord, FaoIngestionResult } from './types.js';

/**
 * Ingest a specific FAO FAOSTAT domain dataset.
 */
export async function ingestFaoDataset(
  domainCode: string,
  areaCode?: string,
  year?: number,
): Promise<FaoIngestionResult> {
  try {
    const records = await fetchFaoDataset(domainCode, areaCode, year);

    return {
      success: true,
      records,
      errors: [],
      metadata: {
        domain: FAO_DOMAINS[domainCode] ?? domainCode,
        indicator: domainCode,
        area: areaCode ? COMMON_COUNTRIES[areaCode] ?? areaCode : 'Canada',
        yearRange: year ? [year, year] : undefined,
        fetchedAt: new Date().toISOString(),
        totalRecords: records.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      records: [],
      errors: [error instanceof Error ? error.message : String(error)],
      metadata: {
        domain: FAO_DOMAINS[domainCode] ?? domainCode,
        indicator: domainCode,
        fetchedAt: new Date().toISOString(),
        totalRecords: 0,
      },
    };
  }
}

/**
 * Ingest all key FAO domains (crops, trade, livestock, food security, etc.).
 */
export async function ingestAllFao(areaCode?: string): Promise<FaoIngestionResult[]> {
  const results: FaoIngestionResult[] = [];

  for (const domainCode of KEY_DOMAINS) {
    const result = await ingestFaoDataset(domainCode, areaCode);
    results.push(result);
  }

  return results;
}

/**
 * Search FAO records (placeholder — full search requires DB backend).
 */
export async function searchFaoRecords(_query: string, _limit: number = 100): Promise<FaoRecord[]> {
  return [];
}

// Re-exports
export { fetchFaoDataset, fetchFaoDomainList } from './fetcher.js';
export { parseFaoResponse } from './parser.js';
export { FAO_DOMAINS, KEY_DOMAINS, COMMON_COUNTRIES, FAO_API_BASE } from './constants.js';
export type { FaoRecord, FaoIngestionResult } from './types.js';
