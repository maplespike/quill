// SPDX-License-Identifier: AGPL-3.0-only

export interface SnzODataEntity {
  '@odata.context'?: string;
  value?: SnzODataRecord[];
}

export interface SnzODataRecord {
  [key: string]: string | number | boolean | null;
}

export interface SnzDatasetMetadata {
  id: string;
  title: string;
  description?: string;
  frequency?: string;
  category?: string;
  lastUpdated?: string;
  url?: string;
}

export interface SnzFactRecord {
  id: string;
  dataset: string;
  datasetName: string;
  dimensions: Record<string, string | number | null>;
  value: number | null;
  period: string;
  lastUpdated: string;
}

export interface SnzIngestionResult {
  dataset: string;
  records: SnzFactRecord[];
  observationsExtracted: number;
  errors: string[];
  durationMs: number;
}
