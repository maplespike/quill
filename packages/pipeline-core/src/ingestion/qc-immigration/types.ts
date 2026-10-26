// SPDX-License-Identifier: AGPL-3.0-only

export interface QcImmigrationRecord {
  id: string;
  recordType: string;
  stream: string | null;
  nominationsIssued: number | null;
  year: number | null;
  quarter: number | null;
  countryOfOrigin: string | null;
  region: string | null;
  sourceUrl: string;
  sourceSystem: string;
  ingestedAt: string;
}

export interface RawQcImmigrationRecord {
  stream?: string;
  nominations_issued?: number;
  year?: number;
  quarter?: number;
  country_of_origin?: string;
  region?: string;
  source_url?: string;
  [key: string]: unknown;
}

export interface QcImmigrationIngestionOptions {
  maxRecords?: number;
  force?: boolean;
  initializeTable?: boolean;
  onProgress?: (msg: string) => void;
}

export interface QcImmigrationIngestionResult {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  perType: Record<string, { recordsFound: number; recordsIngested: number }>;
  durationMs: number;
}

export type QCImmigrationStream = 'regular_skilled' | 'entrepreneur' | 'investor' | 'family' | 'refugee' | 'temporary';
