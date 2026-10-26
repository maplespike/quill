// SPDX-License-Identifier: AGPL-3.0-only

export interface OnCourtsRecord {
  id: string;
  recordType: string;
  courtType: string | null;
  caseNumber: string | null;
  filingDate: string | null;
  caseType: string | null;
  location: string | null;
  status: string | null;
  sourceUrl: string;
  sourceSystem: string;
  ingestedAt: string;
}

export interface RawOnCourtsRecord {
  court_type?: string;
  case_number?: string;
  filing_date?: string;
  case_type?: string;
  location?: string;
  status?: string;
  source_url?: string;
  [key: string]: unknown;
}

export interface OnCourtsIngestionOptions {
  maxRecords?: number;
  force?: boolean;
  initializeTable?: boolean;
  onProgress?: (msg: string) => void;
}

export interface OnCourtsIngestionResult {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  perType: Record<string, { recordsFound: number; recordsIngested: number }>;
  durationMs: number;
}
