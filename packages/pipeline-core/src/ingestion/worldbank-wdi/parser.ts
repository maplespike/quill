// SPDX-License-Identifier: AGPL-3.0-or-later

import { computeHash } from '../../verification/hashing.js';
import type { IndicatorValue, WdiIndicatorDatum, WdiCountryProfile, WdiComparison } from './types.js';

export async function parseIndicatorDatum(
  datum: WdiIndicatorDatum,
  countryCode: string,
): Promise<IndicatorValue | null> {
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
    id: await computeHash(`${countryCode}:${datum.indicator?.id}:${year}`),
  };
}

export async function parseIndicatorData(
  data: WdiIndicatorDatum[],
  countryCode: string,
): Promise<IndicatorValue[]> {
  const results: IndicatorValue[] = [];

  for (const datum of data) {
    const parsed = await parseIndicatorDatum(datum, countryCode);
    if (parsed) {
      results.push(parsed);
    }
  }

  return results;
}

export async function buildCountryProfile(
  countryCode: string,
  indicatorData: Map<string, WdiIndicatorDatum[]>,
): Promise<WdiCountryProfile> {
  const indicators: IndicatorValue[] = [];

  for (const [, data] of indicatorData) {
    const parsed = await parseIndicatorData(data, countryCode);
    indicators.push(...parsed);
  }

  return {
    country: countryCode,
    indicators,
    lastUpdated: new Date().toISOString(),
  };
}

export async function buildComparison(
  indicatorCode: string,
  dataByCountry: Map<string, WdiIndicatorDatum[]>,
): Promise<WdiComparison> {
  const entries: Array<{ country: string; values: IndicatorValue[] }> = [];

  for (const [country, data] of dataByCountry) {
    const parsed = await parseIndicatorData(data, country);
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
