// SPDX-License-Identifier: AGPL-3.0-or-later

import { buildAttribution, withAttribution } from '../../shared/attribution.js';
import { normalizeCountryCode } from '../../shared/country-codes.js';
import { fetchCountryIndicator, fetchMultiCountryIndicator, fetchCountryAllIndicators } from './fetcher.js';
import { parseIndicatorData, buildCountryProfile, buildComparison } from './parser.js';
import { DEFAULT_COUNTRIES, DEFAULT_INDICATORS, CORE_INDICATORS } from './constants.js';
import type { IndicatorValue, WdiCountryProfile, WdiComparison } from './types.js';

function makeAttribution() {
  return buildAttribution('World Bank WDI', {
    sourceUrl: 'https://datahelpdesk.worldbank.org',
    license: 'CC BY 4.0',
    attributionText: 'Data sourced from World Bank Open Data',
  });
}

export async function ingestWDIIndicator(indicatorCode: string, countries?: string[]) {
  const attribution = makeAttribution();
  const targets = countries ?? DEFAULT_COUNTRIES;
  const dataByCountry = await fetchMultiCountryIndicator(targets, indicatorCode);

  const values: IndicatorValue[] = [];
  for (const [, data] of dataByCountry) {
    const countryCode = data[0]?.countryiso3code ?? '';
    if (countryCode) {
      values.push(...await parseIndicatorData(data, countryCode));
    }
  }

  return withAttribution({ indicatorCode, values }, attribution);
}

export async function getCountryProfile(country: string) {
  const normalizedCountry = normalizeCountryCode(country);
  if (!normalizedCountry) {
    throw new Error(`Invalid country code: ${country}`);
  }

  const indicatorData = await fetchCountryAllIndicators(normalizedCountry, DEFAULT_INDICATORS);
  const profile: WdiCountryProfile = await buildCountryProfile(normalizedCountry, indicatorData);

  const attribution = makeAttribution();
  return withAttribution(profile, attribution);
}

export async function compareCountries(indicatorCode: string, countries: string[]) {
  const normalizedCountries = countries
    .map(normalizeCountryCode)
    .filter((c): c is string => c !== undefined);

  const dataByCountry = await fetchMultiCountryIndicator(normalizedCountries, indicatorCode);
  const comparison: WdiComparison = await buildComparison(indicatorCode, dataByCountry);

  const attribution = makeAttribution();
  return withAttribution(comparison, attribution);
}

export { CORE_INDICATORS } from './constants.js';
export type { Indicator, IndicatorValue, WdiCountryProfile, WdiComparison } from './types.js';
