// SPDX-License-Identifier: AGPL-3.0-only

export interface BcEducationRecord {
  id: string;
  recordType: string;
  category: string | null;
  schoolDistrict: string | null;
  schoolName: string | null;
  academicYear: string | null;
  grade: string | null;
  subject: string | null;
  result: string | null;
  studentCount: number | null;
  sourceUrl: string;
  sourceSystem: string;
  ingestedAt: string;
}

export interface RawBcEducationRecord {
  category?: string;
  school_district?: string;
  school_name?: string;
  academic_year?: string;
  grade?: string;
  subject?: string;
  result?: string;
  student_count?: number;
  source_url?: string;
  [key: string]: unknown;
}

export interface BcEducationIngestionOptions {
  maxRecords?: number;
  force?: boolean;
  initializeTable?: boolean;
  onProgress?: (msg: string) => void;
}

export interface BcEducationIngestionResult {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  perType: Record<string, { recordsFound: number; recordsIngested: number }>;
  durationMs: number;
}
