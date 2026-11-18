// SPDX-License-Identifier: AGPL-3.0-only
export interface ProvincialDataset {
  province: string;
  sector: string;
  title: string;
  url: string;
  format: string;
  description: string;
  hash: string;
  ingestedAt: string;
}

export interface ProvincialDeepIngestionResult {
  datasets: ProvincialDataset[];
  portalsChecked: number;
  datasetsFound: number;
  errors: string[];
  durationMs: number;
}
