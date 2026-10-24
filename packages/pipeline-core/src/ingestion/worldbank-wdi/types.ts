// SPDX-License-Identifier: AGPL-3.0-only

export interface IndicatorValue {
  id: string;
  country: any;
  indicatorCode: string;
  year: number;
  value: number;
}

export interface IndicatorMetadata {
  code: string;
  name: string;
  unit: string;
}

export interface WdiCountryProfile {
  country: string;
  indicators: IndicatorValue[];
  lastUpdated: string;
}

export interface WdiComparison {
  indicatorCode: string;
  entries: Array<{ country: string; values: IndicatorValue[] }>;
  lastUpdated: string;
}

export interface WdiTrendAnalysis {
  indicatorCode: string;
  country: string;
  trend: 'increasing' | 'decreasing' | 'stable' | 'no_data';
  changeRate: number;
  startYear: number;
  endYear: number;
  dataPoints: IndicatorValue[];
}

export interface Indicator {
  code: string;
  name: string;
}
