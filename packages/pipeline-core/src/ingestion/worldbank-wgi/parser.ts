// SPDX-License-Identifier: AGPL-3.0-only

import type { WgiIndicatorValue, WgiCountrySnapshot, WgiComparison, WgiTrendAnalysis } from './types.js';
import { WGI_INDICATORS } from './constants.js';

const indicatorNameMap = new Map(WGI_INDICATORS.map(i => [i.code, i.name]));

export function parseWgiRecords(raw: any[], countryCode: string): WgiIndicatorValue[] {
  const values: WgiIndicatorValue[] = [];

  for (const item of raw) {
    if (!item) continue;
    const year = parseInt(item.date, 10);
    const value = item.value !== null && item.value !== undefined ? Number(item.value) : null;
    const indicatorCode = item.indicator?.id ?? '';
    const indicatorName = item.indicator?.value ?? indicatorNameMap.get(indicatorCode) ?? indicatorCode;

    if (!isNaN(year)) {
      values.push({
        country: item.country?.value ?? '',
        countryiso3code: item.countryiso3code ?? countryCode,
        indicatorCode,
        indicatorName,
        year,
        value,
        standardError: null,
        numSources: null,
        rank: null,
      });
    }
  }

  return values.sort((a, b) => b.year - a.year);
}

export function buildCountrySnapshot(
  countryCode: string,
  indicatorData: Map<string, any[]>,
): WgiCountrySnapshot {
  const indicators: Record<string, WgiIndicatorValue> = {};
  let latestYear = 0;

  for (const [code, data] of indicatorData) {
    const parsed = parseWgiRecords(data, countryCode);
    if (parsed.length > 0) {
      indicators[code] = parsed[0];
      if (parsed[0].year > latestYear) {
        latestYear = parsed[0].year;
      }
    }
  }

  const vals = Object.values(indicators)
    .filter(v => v.value !== null)
    .map(v => v.value as number);

  const overallScore = vals.length > 0
    ? vals.reduce((a, b) => a + b, 0) / vals.length
    : null;

  return {
    country: countryCode,
    year: latestYear,
    indicators,
    overallScore,
    percentileRank: overallScore !== null ? ((overallScore + 2.5) / 5) * 100 : null,
  };
}

export function buildComparison(
  indicatorCode: string,
  dataByCountry: Map<string, any[]>,
): WgiComparison {
  const countries: Record<string, WgiIndicatorValue[]> = {};
  let indicatorName = indicatorNameMap.get(indicatorCode) ?? indicatorCode;

  for (const [cc, data] of dataByCountry) {
    const parsed = parseWgiRecords(data, cc);
    countries[cc] = parsed;
    if (parsed.length > 0) {
      indicatorName = parsed[0].indicatorName;
    }
  }

  return { indicatorCode, indicatorName, countries };
}

export function analyzeTrend(parsed: WgiIndicatorValue[]): WgiTrendAnalysis {
  const valid = parsed.filter(p => p.value !== null).sort((a, b) => a.year - b.year);

  if (valid.length < 2) {
    return {
      indicatorCode: parsed[0]?.indicatorCode ?? '',
      country: parsed[0]?.country ?? '',
      values: parsed,
      trend: 'stable',
      changePercent: null,
      latestValue: valid[valid.length - 1]?.value ?? null,
      earliestValue: valid[0]?.value ?? null,
    };
  }

  const earliest = valid[0];
  const latest = valid[valid.length - 1];
  const changePercent = earliest.value !== null && latest.value !== null && earliest.value !== 0
    ? ((latest.value - earliest.value) / Math.abs(earliest.value)) * 100
    : null;

  let trend: WgiTrendAnalysis['trend'] = 'stable';
  if (changePercent !== null) {
    if (changePercent > 5) trend = 'improving';
    else if (changePercent < -5) trend = 'declining';
    else trend = 'stable';
  }

  return {
    indicatorCode: latest.indicatorCode,
    country: latest.country,
    values: parsed,
    trend,
    changePercent,
    latestValue: latest.value,
    earliestValue: earliest.value,
  };
}
