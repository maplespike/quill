// SPDX-License-Identifier: AGPL-3.0-only

export interface TelecommunicationsRecord {
  id: string;
  sourceSystem: string;
  recordType: string;
  title: string | null;
  description: string | null;
  url: string | null;
  publishedAt: string | null;
  ingestedAt: string;
  provider?: string;
  serviceType?: string;
  revenue?: number | null;
  subscribers?: number | null;
  year?: number;
}

export interface RawTelecommunicationsRecord {
  title?: string;
  description?: string;
  url?: string;
  publishedAt?: string;
  sourceSystem?: string;
  [key: string]: unknown;
}

export interface TelecommunicationsIngestionOptions {
  maxRecords?: number;
  force?: boolean;
  initializeTable?: boolean;
  onProgress?: (msg: string) => void;
}

export interface TelecommunicationsIngestionResult {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  durationMs: number;
}
