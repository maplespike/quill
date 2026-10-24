// SPDX-License-Identifier: AGPL-3.0-only

import type { IndicatorValue, WdiCountryProfile, WdiComparison, WdiTrendAnalysis } from './types.js';

export function parseIndicatorDatum(
  datum: any,
  countryCode: string,
): IndicatorValue | null {
  if (datum.value === null) return null;

  const year = parseInt(datum.date, 10);
  if (isNaN(year)) return null;

  const value = parseFloat(datum.value);
  if (isNaN(value)) return null;

  const id = `${countryCode}:${datum.indicator?.id}:${year}`;

  return {
    country: countryCode,
    indicatorCode: datum.indicator?.id ?? '',
    year,
    value,
    id,
  };
}

export function parseIndicatorData(
  data: any[],
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
  indicatorData: Map<string, any[]>,
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
  dataByCountry: Map<string, any[]>,
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

export function analyzeTrend(
  data: IndicatorValue[],
): WdiTrendAnalysis {
  if (data.length < 2) {
    return {
      indicatorCode: data[0]?.indicatorCode ?? '',
      country: data[0]?.country ?? '',
      trend: 'no_data',
      changeRate: 0,
      startYear: 0,
      endYear: 0,
      dataPoints: data,
    };
  }

  const sorted = [...data].sort((a, b) => a.year - b.year);
  const startYear = sorted[0].year;
  const endYear = sorted[sorted.length - 1].year;
  const startValue = sorted[0].value;
  const endValue = sorted[sorted.length - 1].value;

  const changeRate = ((endValue - startValue) / startValue) * 100;

  let trend: WdiTrendAnalysis['trend'] = 'stable';
  if (Math.abs(changeRate) < 0.1) {
    trend = 'stable';
  } else if (changeRate > 0) {
    trend = 'increasing';
  } else {
    trend = 'decreasing';
  }

  return {
    indicatorCode: sorted[0].indicatorCode,
    country: sorted[0].country,
    trend,
    changeRate,
    startYear,
    endYear,
    dataPoints: sorted,
  };
}