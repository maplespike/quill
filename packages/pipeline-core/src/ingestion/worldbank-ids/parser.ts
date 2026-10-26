// SPDX-License-Identifier: AGPL-3.0-only

import type { IndicatorValue, IdsCountryProfile, IdsComparison, IdsTrendAnalysis } from './types.js';
import { CORE_INDICATORS } from './constants.js';

const indicatorNameMap = new Map(CORE_INDICATORS.map(i => [i.code, i.name]));

export function parseIndicatorData(raw: any[], countryCode: string): IndicatorValue[] {
  const values: IndicatorValue[] = [];

  for (const item of raw) {
    if (!item) continue;
    const year = parseInt(item.date, 10);
    const value = item.value !== null && item.value !== undefined ? Number(item.value) : null;
    const indicatorCode = item.indicator?.id ?? '';
    const indicatorName = item.indicator?.value ?? indicatorNameMap.get(indicatorCode) ?? indicatorCode;
    const unit = item.indicator?.unit ?? '';

    if (!isNaN(year)) {
      values.push({
        country: item.country?.value ?? '',
        countryiso3code: item.countryiso3code ?? countryCode,
        indicatorCode,
        indicatorName,
        year,
        value,
        unit,
      });
    }
  }

  return values.sort((a, b) => b.year - a.year);
}

export function buildCountryProfile(
  countryCode: string,
  indicatorData: Map<string, any[]>,
): IdsCountryProfile {
  const indicators: Record<string, IndicatorValue[]> = {};
  let latestYear = 0;

  for (const [code, data] of indicatorData) {
    const parsed = parseIndicatorData(data, countryCode);
    indicators[code] = parsed;
    if (parsed.length > 0 && parsed[0].year > latestYear) {
      latestYear = parsed[0].year;
    }
  }

  const latest = (code: string): number | null => {
    const vals = indicators[code];
    if (!vals) return null;
    const v = vals.find(x => x.value !== null);
    return v?.value ?? null;
  };

  return {
    country: countryCode,
    indicators,
    latestYear,
    summary: {
      totalDebtUsd: latest('DT.DOD.DECT.CD'),
      debtToGniPercent: latest('DT.DOD.DECT.GN.ZS'),
      netOdaPercent: latest('DT.ODA.ODAT.GD.ZS'),
      fdiPercent: latest('BX.KLT.DINV.WD.GD.ZS'),
    },
  };
}

export function buildComparison(
  indicatorCode: string,
  dataByCountry: Map<string, any[]>,
): IdsComparison {
  const countries: Record<string, IndicatorValue[]> = {};
  let indicatorName = indicatorNameMap.get(indicatorCode) ?? indicatorCode;

  for (const [cc, data] of dataByCountry) {
    const parsed = parseIndicatorData(data, cc);
    countries[cc] = parsed;
    if (parsed.length > 0 && !indicatorNameMap.has(indicatorCode)) {
      indicatorName = parsed[0].indicatorName;
    }
  }

  return { indicatorCode, indicatorName, countries };
}

export function analyzeTrend(parsed: IndicatorValue[]): IdsTrendAnalysis {
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

  let trend: IdsTrendAnalysis['trend'] = 'stable';
  if (changePercent !== null) {
    if (changePercent > 10) trend = 'increasing';
    else if (changePercent < -10) trend = 'decreasing';
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
