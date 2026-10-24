// SPDX-License-Identifier: AGPL-3.0-only

export interface IndicatorValue {
  country: string;
  countryiso3code: string;
  indicatorCode: string;
  indicatorName: string;
  year: number;
  value: number | null;
  unit: string;
}

export interface IdsCountryProfile {
  country: string;
  indicators: Record<string, IndicatorValue[]>;
  latestYear: number;
  summary: {
    totalDebtUsd: number | null;
    debtToGniPercent: number | null;
    netOdaPercent: number | null;
    fdiPercent: number | null;
  };
}

export interface IdsComparison {
  indicatorCode: string;
  indicatorName: string;
  countries: Record<string, IndicatorValue[]>;
}

export interface IdsTrendAnalysis {
  indicatorCode: string;
  country: string;
  values: IndicatorValue[];
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  changePercent: number | null;
  latestValue: number | null;
  earliestValue: number | null;
}

export interface IndicatorMetadata {
  code: string;
  name: string;
  unit: string;
}
