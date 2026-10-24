// SPDX-License-Identifier: AGPL-3.0-only

import { fetchCountryIndicator, fetchMultiCountryIndicator, fetchCountryAllIndicators } from './fetcher.js';
import { parseWgiRecords, buildCountrySnapshot, buildComparison, analyzeTrend } from './parser.js';
import { DEFAULT_COUNTRIES, DEFAULT_INDICATORS, WGI_INDICATORS } from './constants.js';
import type { WgiIndicatorValue, WgiCountrySnapshot, WgiComparison, WgiTrendAnalysis } from './types.js';

export async function ingestWgiIndicator(indicatorCode: string, countries?: string[], dateRange?: string) {
  const targets = countries ?? DEFAULT_COUNTRIES;
  const dataByCountry = await fetchMultiCountryIndicator(targets, indicatorCode, dateRange);

  const values: WgiIndicatorValue[] = [];
  for (const [, data] of dataByCountry) {
    const countryCode = data[0]?.countryiso3code ?? '';
    if (countryCode) {
      const parsed = parseWgiRecords(data, countryCode);
      values.push(...parsed);
    }
  }

  return { indicatorCode, values };
}

export async function getWgiCountrySnapshot(country: string, dateRange?: string) {
  const normalizedCountry = country.toUpperCase();
  if (normalizedCountry.length !== 3) {
    throw new Error(`Invalid country code: ${country}`);
  }

  const indicatorData = await fetchCountryAllIndicators(normalizedCountry, DEFAULT_INDICATORS, dateRange);
  const snapshot: WgiCountrySnapshot = buildCountrySnapshot(normalizedCountry, indicatorData);

  return snapshot;
}

export async function compareWgiCountries(indicatorCode: string, countries: string[], dateRange?: string) {
  const normalizedCountries = countries.map((c) => c.toUpperCase());

  const dataByCountry = await fetchMultiCountryIndicator(normalizedCountries, indicatorCode, dateRange);
  const comparison: WgiComparison = buildComparison(indicatorCode, dataByCountry);

  return comparison;
}

export async function analyzeWgiIndicatorTrend(indicatorCode: string, country: string, dateRange?: string) {
  const normalizedCountry = country.toUpperCase();
  if (normalizedCountry.length !== 3) {
    throw new Error(`Invalid country code: ${country}`);
  }

  const data = await fetchCountryIndicator(normalizedCountry, indicatorCode, dateRange);
  const parsed = parseWgiRecords(data, normalizedCountry);
  const trend: WgiTrendAnalysis = analyzeTrend(parsed);

  return trend;
}

export type { WgiIndicatorValue, WgiCountrySnapshot, WgiComparison, WgiTrendAnalysis } from './types.js';

export { WGI_INDICATORS } from './constants.js';
