// SPDX-License-Identifier: AGPL-3.0-only

export interface PharmaceuticalsRecord {
  id: string;
  sourceSystem: string;
  recordType: string;
  title: string | null;
  description: string | null;
  url: string | null;
  publishedAt: string | null;
  ingestedAt: string;
  drugName?: string;
  manufacturer?: string;
  shortageDate?: string | null;
  shortageReason?: string;
  status?: string;
}

export interface RawPharmaceuticalsRecord {
  title?: string;
  description?: string;
  url?: string;
  publishedAt?: string;
  sourceSystem?: string;
  [key: string]: unknown;
}

export interface PharmaceuticalsIngestionOptions {
  maxRecords?: number;
  force?: boolean;
  initializeTable?: boolean;
  onProgress?: (msg: string) => void;
}

export interface PharmaceuticalsIngestionResult {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  durationMs: number;
}
