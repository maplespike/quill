// SPDX-License-Identifier: AGPL-3.0-only

export interface BcCourtsRecord {
  id: string;
  recordType: string;
  courtType: string | null;
  fileNumber: string | null;
  filingDate: string | null;
  caseType: string | null;
  location: string | null;
  status: string | null;
  sourceUrl: string;
  sourceSystem: string;
  ingestedAt: string;
}

export interface RawBcCourtsRecord {
  court_type?: string;
  file_number?: string;
  filing_date?: string;
  case_type?: string;
  location?: string;
  status?: string;
  source_url?: string;
  [key: string]: unknown;
}

export interface BcCourtsIngestionOptions {
  maxRecords?: number;
  force?: boolean;
  initializeTable?: boolean;
  onProgress?: (msg: string) => void;
}

export interface BcCourtsIngestionResult {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  perType: Record<string, { recordsFound: number; recordsIngested: number }>;
  durationMs: number;
}
