// SPDX-License-Identifier: AGPL-3.0-only

import { buildAttribution, withAttribution } from '../../shared/attribution.js';
import { fetchCountryIndicator, fetchMultiCountryIndicator, fetchCountryAllIndicators } from './fetcher.js';
import { parseIndicatorData, buildCountryProfile, buildComparison, analyzeTrend } from './parser.js';
import { DEFAULT_COUNTRIES, DEFAULT_INDICATORS, TOPIC_INDICATORS } from './constants.js';
import type { IndicatorValue, WdiCountryProfile, WdiComparison, WdiTrendAnalysis } from './types.js';

export async function ingestWDIIndicator(indicatorCode: string, countries?: string[], dateRange?: string) {
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

export async function getCountryProfile(country: string, dateRange?: string) {
  const normalizedCountry = country.toUpperCase();
  if (normalizedCountry.length !== 3) {
    throw new Error(`Invalid country code: ${country}`);
  }

  const indicatorData = await fetchCountryAllIndicators(normalizedCountry, DEFAULT_INDICATORS, dateRange);
  const profile: WdiCountryProfile = buildCountryProfile(normalizedCountry, indicatorData);

  return profile;
}

export async function compareCountries(indicatorCode: string, countries: string[], dateRange?: string) {
  const normalizedCountries = countries.map((c) => c.toUpperCase());

  const dataByCountry = await fetchMultiCountryIndicator(normalizedCountries, indicatorCode, dateRange);
  const comparison: WdiComparison = buildComparison(indicatorCode, dataByCountry);

  return comparison;
}

export async function analyzeIndicatorTrend(indicatorCode: string, country: string, dateRange?: string) {
  const normalizedCountry = country.toUpperCase();
  if (normalizedCountry.length !== 3) {
    throw new Error(`Invalid country code: ${country}`);
  }

  const data = await fetchCountryIndicator(normalizedCountry, indicatorCode, dateRange);
  const parsed = parseIndicatorData(data, normalizedCountry);
  const trend: WdiTrendAnalysis = analyzeTrend(parsed);

  return trend;
}

export async function fetchTopicData(topicCode: string, countries?: string[], dateRange?: string) {
  const topic = TOPIC_INDICATORS[topicCode as keyof typeof TOPIC_INDICATORS];
  if (!topic) {
    throw new Error(`Unknown topic: ${topicCode}. Valid topics: ${Object.keys(TOPIC_INDICATORS).join(', ')}`);
  }

  const targets = countries ?? DEFAULT_COUNTRIES;
  const results: Record<string, IndicatorValue[]> = {};

  for (const country of targets) {
    const data = await fetchMultiCountryIndicator([country], topicCode, dateRange);
    for (const [cc, values] of data) {
      const parsed = parseIndicatorData(values, cc);
      results[cc] = parsed;
    }
  }

  return { topic: topicCode, topicName: topic.name, indicators: topic.indicators, results };
}

export type { IndicatorValue, WdiCountryProfile, WdiComparison, WdiTrendAnalysis, IndicatorMetadata } from './types.js';

export { CORE_INDICATORS, TOPIC_INDICATORS } from './constants.js';

// Alias for MCP tool consumption
export { fetchIndicatorMetadata as getIndicatorMetadata, fetchIndicatorMetadata } from './fetcher.js';