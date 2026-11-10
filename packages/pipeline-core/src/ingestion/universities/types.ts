// SPDX-License-Identifier: AGPL-3.0-only
export interface UniversityRecord {
  institution: string;
  province: string;
  year: number;
  enrolment?: number;
  tuitionRevenue?: number;
  governmentGrants?: number;
  researchIncome?: number;
  totalRevenue?: number;
  totalExpenses?: number;
  source: 'cudo' | 'financial-statement' | 'tri-council';
  url: string;
  hash: string;
  ingestedAt: string;
}

export interface UniversitiesIngestionResult {
  records: UniversityRecord[];
  sourcesAttempted: number;
  sourcesSucceeded: number;
  errors: string[];
  durationMs: number;
}
