// SPDX-License-Identifier: AGPL-3.0-only
export interface FederalDataset {
  agency: string;
  dataset: string;
  year: number;
  title: string;
  url: string;
  format: string;
  description: string;
  hash: string;
  ingestedAt: string;
}

export interface FederalDeepIngestionResult {
  datasets: FederalDataset[];
  sourcesAttempted: number;
  sourcesSucceeded: number;
  errors: string[];
  durationMs: number;
}
