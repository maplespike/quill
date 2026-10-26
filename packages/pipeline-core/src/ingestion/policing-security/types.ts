// SPDX-License-Identifier: AGPL-3.0-only

export interface PolicingSecurityRecord {
  id: string;
  sourceSystem: string;
  recordType: string;
  title: string | null;
  description: string | null;
  url: string | null;
  publishedAt: string | null;
  ingestedAt: string;
  // Structured crime data fields
  geo?: string;
  violations?: string;
  statistics?: string;
  value?: number | null;
  year?: number;
}

export interface RawPolicingSecurityRecord {
  title?: string;
  description?: string;
  url?: string;
  publishedAt?: string;
  sourceSystem?: string;
  geo?: string;
  violations?: string;
  statistics?: string;
  value?: number | null;
  year?: number;
  [key: string]: unknown;
}

export interface PolicingSecurityIngestionOptions {
  maxRecords?: number;
  force?: boolean;
  initializeTable?: boolean;
  onProgress?: (msg: string) => void;
}

export interface PolicingSecurityIngestionResult {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  durationMs: number;
}
