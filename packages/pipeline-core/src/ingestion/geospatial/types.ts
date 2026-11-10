// SPDX-License-Identifier: AGPL-3.0-only
export interface GeospatialRecord {
  id: string;
  title: string;
  description: string;
  url: string;
  format: string;
  region: string;
  category: string;
  hash: string;
  ingestedAt: string;
}

export interface GeospatialIngestionResult {
  records: GeospatialRecord[];
  sourcesAttempted: number;
  sourcesSucceeded: number;
  errors: string[];
  durationMs: number;
}
