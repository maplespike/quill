// SPDX-License-Identifier: AGPL-3.0-only

export interface OnEducationRecord {
  id: string;
  recordType: string;
  category: string | null;
  schoolBoard: string | null;
  schoolName: string | null;
  academicYear: string | null;
  grade: string | null;
  subject: string | null;
  result: string | null;
  studentCount: number | null;
  fundingAmount: number | null;
  sourceUrl: string;
  sourceSystem: string;
  ingestedAt: string;
}

export interface RawOnEducationRecord {
  category?: string;
  school_board?: string;
  school_name?: string;
  academic_year?: string;
  grade?: string;
  subject?: string;
  result?: string;
  student_count?: number;
  funding_amount?: number;
  source_url?: string;
  [key: string]: unknown;
}

export interface OnEducationIngestionOptions {
  maxRecords?: number;
  force?: boolean;
  initializeTable?: boolean;
  onProgress?: (msg: string) => void;
}

export interface OnEducationIngestionResult {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  perType: Record<string, { recordsFound: number; recordsIngested: number }>;
  durationMs: number;
}
