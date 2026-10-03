// SPDX-License-Identifier: AGPL-3.0-or-later

import { buildAttribution, withAttribution } from '../../shared/attribution.js';
import { fetchRefugeePopulation, fetchAsylumSeekers } from './fetcher.js';
import { parsePopulationRecords } from './parser.js';
import { DEFAULT_COUNTRIES, DEFAULT_YEARS } from './constants.js';
import type { RefugeeRecord, RefugeeIngestionResult } from './types.js';

function makeAttribution() {
  return buildAttribution('UNHCR Refugee Statistics', {
    sourceUrl: 'https://data.unhcr.org',
    attributionText: "No publisher license declaration is attached to this source configuration. Consult UNHCR terms and notices for the specific dataset and material.",
  });
}

export async function fetchRefugeeDataByCountry(countryCode: string, year?: number) {
  const attribution = makeAttribution();
  const targetYear = year ?? DEFAULT_YEARS[0];
  const result = await fetchRefugeePopulation(countryCode, targetYear);
  const records = parsePopulationRecords(result.records);

  return withAttribution({
    countryCode,
    year: targetYear,
    records,
    sourcesAttempted: 1,
    sourcesSucceeded: result.error ? 0 : 1,
    errors: result.error ? [result.error] : [],
    durationMs: 0,
  } satisfies RefugeeIngestionResult, attribution);
}

export async function fetchRefugeeDataMultiCountry(options?: {
  countryCodes?: string[];
  years?: number[];
}) {
  const attribution = makeAttribution();
  const countries = options?.countryCodes ?? DEFAULT_COUNTRIES;
  const years = options?.years ?? DEFAULT_YEARS;
  const allRecords: RefugeeRecord[] = [];
  const errors: string[] = [];
  let sourcesAttempted = 0;
  let sourcesSucceeded = 0;

  for (const country of countries) {
    for (const year of years) {
      sourcesAttempted++;
      const result = await fetchRefugeePopulation(country, year);
      if (result.error) {
        errors.push(`${country}/${year}: ${result.error}`);
      } else {
        const records = parsePopulationRecords(result.records);
        allRecords.push(...records);
        sourcesSucceeded++;
      }
    }
  }

  return withAttribution({
    countryCode: 'multi',
    year: years[0] ?? 0,
    records: allRecords,
    sourcesAttempted,
    sourcesSucceeded,
    errors,
    durationMs: 0,
  } satisfies RefugeeIngestionResult, attribution);
}

export async function healthCheck() {
  const result = await fetchRefugeePopulation('CAN', DEFAULT_YEARS[0]);
  const attribution = makeAttribution();
  return withAttribution({
    healthy: !result.error,
    countries: DEFAULT_COUNTRIES.length,
  }, attribution);
}

export type { RefugeeRecord, RefugeeIngestionResult } from './types.js';
