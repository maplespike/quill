// SPDX-License-Identifier: AGPL-3.0-only

export interface OnsTimeseriesData {
  description: {
    title: string;
    cdid: string;
    unit?: string;
    frequency?: string;
    seasonally_adjusted?: boolean;
  };
  months?: Array<{ date: string; value: string; year: string; month: string }>;
  quarters?: Array<{ date: string; value: string; year: string; quarter: string }>;
  years?: Array<{ date: string; value: string; year: string }>;
}

export interface OnsDatasetResult {
  uri: string;
  title: string;
  description?: string;
  edition?: string;
  version?: number;
  release_date?: string;
}

export interface OnsFactRecord {
  id: string;
  series: string;
  seriesTitle: string;
  value: number | null;
  period: string;
  frequency: string;
  unit?: string;
  seasonallyAdjusted?: boolean;
  lastUpdated: string;
}

export interface OnsIngestionResult {
  series: string;
  records: OnsFactRecord[];
  observationsExtracted: number;
  errors: string[];
  durationMs: number;
}
