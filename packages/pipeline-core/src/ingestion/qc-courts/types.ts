// SPDX-License-Identifier: AGPL-3.0-only

export interface QcCourtsRecord {
  id: string;
  recordType: string;
  courtType: string | null;
  fileNumber: string | null;
  filingDate: string | null;
  caseType: string | null;
  district: string | null;
  status: string | null;
  sourceUrl: string;
  sourceSystem: string;
  ingestedAt: string;
}

export interface RawQcCourtsRecord {
  court_type?: string;
  file_number?: string;
  filing_date?: string;
  case_type?: string;
  district?: string;
  status?: string;
  source_url?: string;
  [key: string]: unknown;
}

export interface QcCourtsIngestionOptions {
  maxRecords?: number;
  force?: boolean;
  initializeTable?: boolean;
  onProgress?: (msg: string) => void;
}

export interface QcCourtsIngestionResult {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  perType: Record<string, { recordsFound: number; recordsIngested: number }>;
  durationMs: number;
}
