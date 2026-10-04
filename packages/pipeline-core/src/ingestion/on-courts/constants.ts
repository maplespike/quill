// SPDX-License-Identifier: AGPL-3.0-or-later

export const ONCOURTS_DDL = `
CREATE TABLE IF NOT EXISTS on_court_records (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL,
  court_type TEXT,
  case_number TEXT,
  filing_date TEXT,
  case_type TEXT,
  location TEXT,
  status TEXT,
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'on-courts',
  ingested_at TEXT NOT NULL,
  UNIQUE(record_type, source_url)
);
CREATE INDEX IF NOT EXISTS idx_on_court_court_type ON on_court_records(court_type);
CREATE INDEX IF NOT EXISTS idx_on_court_case_number ON on_court_records(case_number);
CREATE INDEX IF NOT EXISTS idx_on_court_filing_date ON on_court_records(filing_date);
CREATE INDEX IF NOT EXISTS idx_on_court_case_type ON on_court_records(case_type);
CREATE INDEX IF NOT EXISTS idx_on_court_location ON on_court_records(location);
CREATE INDEX IF NOT EXISTS idx_on_court_status ON on_court_records(status);
CREATE INDEX IF NOT EXISTS idx_on_court_ingested ON on_court_records(ingested_at DESC);
`;

export const DEFAULT_MAX_RECORDS = 400;
export const DEFAULT_TIMEOUT_MS = 30_000;

const DEFAULT_USER_AGENT = 'Quill/0.1 (civic-tech; mailto:j_kroeker.ca)';

export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'application/json,text/html,*/*',
};

export class OnCourtsError extends Error {
  constructor(message: string, public readonly code: string = 'ONCOURTS_ERROR', public readonly url?: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'OnCourtsError';
  }
}
