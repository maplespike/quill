// SPDX-License-Identifier: AGPL-3.0-only

export const QCEDUCATION_DDL = `
CREATE TABLE IF NOT EXISTS qc_education_records (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL,
  category TEXT,
  school_board TEXT,
  school_name TEXT,
  academic_year TEXT,
  grade TEXT,
  subject TEXT,
  result TEXT,
  student_count INTEGER,
  funding_amount REAL,
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'qc-education',
  ingested_at TEXT NOT NULL,
  UNIQUE(record_type, source_url)
);
CREATE INDEX IF NOT EXISTS idx_qc_education_category ON qc_education_records(category);
CREATE INDEX IF NOT EXISTS idx_qc_education_school_board ON qc_education_records(school_board);
CREATE INDEX IF NOT EXISTS idx_qc_education_school_name ON qc_education_records(school_name);
CREATE INDEX IF NOT EXISTS idx_qc_education_academic_year ON qc_education_records(academic_year);
CREATE INDEX IF NOT EXISTS idx_qc_education_grade ON qc_education_records(grade);
CREATE INDEX IF NOT EXISTS idx_qc_education_subject ON qc_education_records(subject);
CREATE INDEX IF NOT EXISTS idx_qc_education_result ON qc_education_records(result);
CREATE INDEX IF NOT EXISTS idx_qc_education_student_count ON qc_education_records(student_count);
CREATE INDEX IF NOT EXISTS idx_qc_education_funding_amount ON qc_education_records(funding_amount);
CREATE INDEX IF NOT EXISTS idx_qc_education_ingested ON qc_education_records(ingested_at DESC);
`;

export const DEFAULT_MAX_RECORDS = 400;
export const DEFAULT_TIMEOUT_MS = 30_000;

const DEFAULT_USER_AGENT = 'Quill/0.1 (civic-tech; mailto:dev@maplespike.ca)';

export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'application/json,text/html,*/*',
};

export class QcEducationError extends Error {
  constructor(message: string, public readonly code: string = 'QCEDUCATION_ERROR', public readonly url?: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'QcEducationError';
  }
}
