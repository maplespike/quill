// SPDX-License-Identifier: AGPL-3.0-only

export interface WgiIndicatorValue {
  country: string;
  countryiso3code: string;
  indicatorCode: string;
  indicatorName: string;
  year: number;
  value: number | null;
  standardError: number | null;
  numSources: number | null;
  rank: number | null;
}

export interface WgiCountrySnapshot {
  country: string;
  year: number;
  indicators: Record<string, WgiIndicatorValue>;
  overallScore: number | null;
  percentileRank: number | null;
}

export interface WgiComparison {
  indicatorCode: string;
  indicatorName: string;
  countries: Record<string, WgiIndicatorValue[]>;
}

export interface WgiTrendAnalysis {
  indicatorCode: string;
  country: string;
  values: WgiIndicatorValue[];
  trend: 'improving' | 'declining' | 'stable' | 'mixed';
  changePercent: number | null;
  latestValue: number | null;
  earliestValue: number | null;
}
