// SPDX-License-Identifier: AGPL-3.0-only

import { fetchCountryIndicator, fetchMultiCountryIndicator, fetchCountryAllIndicators } from './fetcher.js';
import { parseIndicatorData, buildCountryProfile, buildComparison, analyzeTrend } from './parser.js';
import { DEFAULT_COUNTRIES, DEFAULT_INDICATORS, TOPIC_INDICATORS } from './constants.js';
import type { IndicatorValue, IdsCountryProfile, IdsComparison, IdsTrendAnalysis } from './types.js';

export async function ingestIdsIndicator(indicatorCode: string, countries?: string[], dateRange?: string) {
  const targets = countries ?? DEFAULT_COUNTRIES;
  const dataByCountry = await fetchMultiCountryIndicator(targets, indicatorCode, dateRange);

  const values: IndicatorValue[] = [];
  for (const [, data] of dataByCountry) {
    const countryCode = data[0]?.countryiso3code ?? '';
    if (countryCode) {
      const parsed = parseIndicatorData(data, countryCode);
      values.push(...parsed);
    }
  }

  return { indicatorCode, values };
}

export async function getIdsCountryDebtProfile(country: string, dateRange?: string) {
  const normalizedCountry = country.toUpperCase();
  if (normalizedCountry.length !== 3) {
    throw new Error(`Invalid country code: ${country}`);
  }

  const indicatorData = await fetchCountryAllIndicators(normalizedCountry, DEFAULT_INDICATORS, dateRange);
  const profile: IdsCountryProfile = buildCountryProfile(normalizedCountry, indicatorData);

  return profile;
}

export async function compareIdsCountries(indicatorCode: string, countries: string[], dateRange?: string) {
  const normalizedCountries = countries.map((c) => c.toUpperCase());

  const dataByCountry = await fetchMultiCountryIndicator(normalizedCountries, indicatorCode, dateRange);
  const comparison: IdsComparison = buildComparison(indicatorCode, dataByCountry);

  return comparison;
}

export async function analyzeIdsIndicatorTrend(indicatorCode: string, country: string, dateRange?: string) {
  const normalizedCountry = country.toUpperCase();
  if (normalizedCountry.length !== 3) {
    throw new Error(`Invalid country code: ${country}`);
  }

  const data = await fetchCountryIndicator(normalizedCountry, indicatorCode, dateRange);
  const parsed = parseIndicatorData(data, normalizedCountry);
  const trend: IdsTrendAnalysis = analyzeTrend(parsed);

  return trend;
}

export async function fetchIdsTopicData(topicCode: string, countries?: string[], dateRange?: string) {
  const topic = TOPIC_INDICATORS[topicCode as keyof typeof TOPIC_INDICATORS];
  if (!topic) {
    throw new Error(`Unknown topic: ${topicCode}. Valid topics: ${Object.keys(TOPIC_INDICATORS).join(', ')}`);
  }

  const targets = countries ?? DEFAULT_COUNTRIES;
  const results: Record<string, IndicatorValue[]> = {};

  for (const indicatorCode of topic.indicators) {
    const data = await fetchMultiCountryIndicator(targets, indicatorCode, dateRange);
    for (const [cc, values] of data) {
      const parsed = parseIndicatorData(values, cc);
      if (!results[cc]) results[cc] = [];
      results[cc].push(...parsed);
    }
  }

  return { topic: topicCode, topicName: topic.name, indicators: topic.indicators, results };
}

export type { IndicatorValue, IdsCountryProfile, IdsComparison, IdsTrendAnalysis, IndicatorMetadata } from './types.js';

export { CORE_INDICATORS, TOPIC_INDICATORS } from './constants.js';

export { fetchIndicatorMetadata as getIndicatorMetadata, fetchIndicatorMetadata } from './fetcher.js';
