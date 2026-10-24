// SPDX-License-Identifier: AGPL-3.0-only

export interface OnImmigrationRecord {
  id: string;
  recordType: string;
  stream: string | null;
  nominationsIssued: number | null;
  year: number | null;
  quarter: number | null;
  occupation: string | null;
  industry: string | null;
  sourceUrl: string;
  sourceSystem: string;
  ingestedAt: string;
}

export interface RawOnImmigrationRecord {
  stream?: string;
  nominations_issued?: number;
  year?: number;
  quarter?: number;
  occupation?: string;
  industry?: string;
  source_url?: string;
  [key: string]: unknown;
}

export interface OnImmigrationIngestionOptions {
  maxRecords?: number;
  force?: boolean;
  initializeTable?: boolean;
  onProgress?: (msg: string) => void;
}

export interface OnImmigrationIngestionResult {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  perType: Record<string, { recordsFound: number; recordsIngested: number }>;
  durationMs: number;
}
