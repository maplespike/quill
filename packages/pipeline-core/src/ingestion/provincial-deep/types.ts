// SPDX-License-Identifier: AGPL-3.0-or-later
export interface ProvincialDeepDataset {
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
  datasets: ProvincialDeepDataset[];
  portalsChecked: number;
  datasetsFound: number;
  errors: string[];
  durationMs: number;
}