// SPDX-License-Identifier: AGPL-3.0-or-later

import { buildAttribution, withAttribution } from '../../shared/attribution.js';
import { fetchIndicatorData, fetchMultipleIndicators } from './fetcher.js';
import { parseGhoRecords } from './parser.js';
import { DEFAULT_INDICATORS, DEFAULT_COUNTRIES, DEFAULT_YEARS } from './constants.js';
import type { WhoGhoRecord, WhoGhoIngestionResult, WhoGhoRawRecord } from './types.js';
import type { AttributedRecord } from '../../shared/attribution.js';

function makeAttribution() {
  return buildAttribution('WHO Global Health Observatory', {
    sourceUrl: 'https://ghoapi.azureedge.net/api/',
    attributionText: "No publisher license declaration is attached to this source configuration. Consult WHO terms and notices for the specific dataset and material.",
  });
}

export async function ingestGhoIndicator(
  indicatorCode: string,
  countryCode: string = 'CAN',
  year?: number,
) {
  const attribution = makeAttribution();
  const targetYear = year ?? DEFAULT_YEARS[DEFAULT_YEARS.length - 1];

  const fetchResult = await fetchIndicatorData(indicatorCode, countryCode);
  if (fetchResult.error) {
    return withAttribution(
      {
        indicatorCode,
        countryCode,
        year: targetYear,
        records: [],
        sourcesAttempted: 1,
        sourcesSucceeded: 0,
        errors: [fetchResult.error],
        durationMs: 0,
      } satisfies WhoGhoIngestionResult,
      attribution,
    );
  }

  const records = await parseGhoRecords(fetchResult.records);
  // Filter by year if specified
  const filteredRecords = year
    ? records.filter((r) => r.year === year)
    : records;

  return withAttribution(
    {
      indicatorCode,
      countryCode,
      year: targetYear,
      records: filteredRecords,
      sourcesAttempted: 1,
      sourcesSucceeded: 1,
      errors: [],
      durationMs: 0,
    } satisfies WhoGhoIngestionResult,
    attribution,
  );
}

export async function ingestAllGho(options?: {
  indicatorCodes?: string[];
  countryCodes?: string[];
  years?: number[];
}) {
  const attribution = makeAttribution();
  const indicators = options?.indicatorCodes ?? DEFAULT_INDICATORS;
  const countries = options?.countryCodes ?? DEFAULT_COUNTRIES;
  const years = options?.years ?? DEFAULT_YEARS;

  const fetchResult = await fetchMultipleIndicators(indicators, countries);
  const allRecords = await parseGhoRecords(fetchResult.records);

  // Filter by years if specified
  const filteredRecords = years.length > 0
    ? allRecords.filter((r) => years.includes(r.year))
    : allRecords;

  const sourcesAttempted = indicators.length * countries.length;
  const sourcesSucceeded = fetchResult.error ? 0 : sourcesAttempted;
  const errors = fetchResult.error ? [fetchResult.error] : [];

  return withAttribution(
    {
      indicatorCode: 'multi',
      countryCode: 'multi',
      year: years[0] ?? 0,
      records: filteredRecords,
      sourcesAttempted,
      sourcesSucceeded,
      errors,
      durationMs: 0,
    } satisfies WhoGhoIngestionResult,
    attribution,
  );
}

export async function searchGhoRecords(
  indicatorCode?: string,
  countryCode?: string,
  year?: number,
): Promise<WhoGhoRecord[]> {
  const result = indicatorCode
    ? await ingestGhoIndicator(indicatorCode, countryCode ?? 'CAN', year)
    : await ingestAllGho({ countryCodes: countryCode ? [countryCode] : undefined, years: year ? [year] : undefined });
  const attResult = result as AttributedRecord;
  return (attResult.data as WhoGhoIngestionResult).records;
}

export async function healthCheck() {
  const attribution = makeAttribution();
  const result = await fetchIndicatorData('WHOSIS_000001', 'CAN');
  return withAttribution(
    {
      healthy: !result.error,
      indicatorTested: 'WHOSIS_000001',
      countryTested: 'CAN',
    },
    attribution,
  );
}

export type { WhoGhoRecord, WhoGhoIngestionResult, WhoGhoRawRecord } from './types.js';