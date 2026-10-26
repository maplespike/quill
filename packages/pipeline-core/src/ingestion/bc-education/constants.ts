// SPDX-License-Identifier: AGPL-3.0-only

export const BCEDUCATION_DDL = `
CREATE TABLE IF NOT EXISTS bc_education_records (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL,
  category TEXT,
  school_district TEXT,
  school_name TEXT,
  academic_year TEXT,
  grade TEXT,
  subject TEXT,
  result TEXT,
  student_count INTEGER,
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'bc-education',
  ingested_at TEXT NOT NULL,
  UNIQUE(record_type, source_url)
);
CREATE INDEX IF NOT EXISTS idx_bc_education_category ON bc_education_records(category);
CREATE INDEX IF NOT EXISTS idx_bc_education_school_district ON bc_education_records(school_district);
CREATE INDEX IF NOT EXISTS idx_bc_education_school_name ON bc_education_records(school_name);
CREATE INDEX IF NOT EXISTS idx_bc_education_academic_year ON bc_education_records(academic_year);
CREATE INDEX IF NOT EXISTS idx_bc_education_grade ON bc_education_records(grade);
CREATE INDEX IF NOT EXISTS idx_bc_education_subject ON bc_education_records(subject);
CREATE INDEX IF NOT EXISTS idx_bc_education_result ON bc_education_records(result);
CREATE INDEX IF NOT EXISTS idx_bc_education_student_count ON bc_education_records(student_count);
CREATE INDEX IF NOT EXISTS idx_bc_education_ingested ON bc_education_records(ingested_at DESC);
`;

export const DEFAULT_MAX_RECORDS = 400;
export const DEFAULT_TIMEOUT_MS = 30_000;

const DEFAULT_USER_AGENT = 'Quill/0.1 (civic-tech; mailto:hello@maplespike.ca)';

export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'application/json,text/html,*/*',
};

export class BcEducationError extends Error {
  constructor(message: string, public readonly code: string = 'BCEDUCATION_ERROR', public readonly url?: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'BcEducationError';
  }
}
