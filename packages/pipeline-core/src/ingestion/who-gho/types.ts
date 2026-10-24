// SPDX-License-Identifier: AGPL-3.0-only

export interface WhoGhoRecord {
  id: string;
  indicatorCode: string;
  indicatorName: string;
  countryCode: string;
  countryName: string;
  year: number;
  value: number;
  unit?: string;
  source: string;
}

export interface WhoGhoIngestionResult {
  indicatorCode: string;
  countryCode: string;
  year: number;
  records: WhoGhoRecord[];
  sourcesAttempted: number;
  sourcesSucceeded: number;
  errors: string[];
  durationMs: number;
}

export interface WhoGhoRawRecord {
  IndicatorCode: string;
  IndicatorName: string;
  SpatialDim: string;
  SpatialDimType: string;
  TimeDim: number;
  TimeDimType: string;
  NumericValue: number;
  Low: number;
  High: number;
  Comments: string;
  Unit: string;
  ValueType: string;
  ValueTypeDescription: string;
}