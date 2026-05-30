// SPDX-License-Identifier: AGPL-3.0-or-later

import { computeHash } from '../../verification/hashing.js';
import type { IndicatorValue, WdiIndicatorDatum, WdiCountryProfile, WdiComparison } from './types.js';

export function parseIndicatorDatum(
  datum: WdiIndicatorDatum,
  countryCode: string,
): IndicatorValue | null {
  if (datum.value === null) return null;

  const year = parseInt(datum.date, 10);
  if (isNaN(year)) return null;

  const value = parseFloat(datum.value);
  if (isNaN(value)) return null;

  return {
    country: countryCode as any,
    indicatorCode: datum.indicator?.id ?? '',
    year,
    value,
    id: `${countryCode}:${datum.indicator?.id}:${year}`,
  };
}

export function parseIndicatorData(
  data: WdiIndicatorDatum[],
  countryCode: string,
): IndicatorValue[] {
  const results: IndicatorValue[] = [];

  for (const datum of data) {
    const parsed = parseIndicatorDatum(datum, countryCode);
    if (parsed) {
      results.push(parsed);
    }
  }

  return results;
}

export function buildCountryProfile(
  countryCode: string,
  indicatorData: Map<string, WdiIndicatorDatum[]>,
): WdiCountryProfile {
  const indicators: IndicatorValue[] = [];

  for (const [indicatorCode, data] of indicatorData) {
    const parsed = parseIndicatorData(data, countryCode);
    indicators.push(...parsed);
  }

  return {
    country: countryCode,
    indicators,
    lastUpdated: new Date().toISOString(),
  };
}

export function buildComparison(
  indicatorCode: string,
  dataByCountry: Map<string, WdiIndicatorDatum[]>,
): WdiComparison {
  const entries: Array<{ country: string; values: IndicatorValue[] }> = [];

  for (const [country, data] of dataByCountry) {
    const parsed = parseIndicatorData(data, country);
    if (parsed.length > 0) {
      entries.push({ country, values: parsed });
    }
  }

  return {
    indicatorCode,
    entries,
    lastUpdated: new Date().toISOString(),
  };
}
