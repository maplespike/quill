// SPDX-License-Identifier: AGPL-3.0-only

export interface IloRecord {
  id: string;
  indicatorCode: string;
  indicatorName: string;
  country: string;
  countryCode: string;
  year: number;
  value: number;
  unit: string;
  source: string;
}

export interface IloIngestionResult {
  datasetsAttempted: number;
  datasetsSucceeded: number;
  records: IloRecord[];
  errors: Array<{ datasetId: string; error: string }>;
  durationMs: number;
}

export interface IloIndicator {
  id: string;
  name: string;
  topic: string;
  description: string;
  unit: string;
}
