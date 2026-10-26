// SPDX-License-Identifier: AGPL-3.0-only

export const BCCOURTS_DDL = `
CREATE TABLE IF NOT EXISTS bc_court_records (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL,
  court_type TEXT,
  file_number TEXT,
  filing_date TEXT,
  case_type TEXT,
  location TEXT,
  status TEXT,
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'bc-courts',
  ingested_at TEXT NOT NULL,
  UNIQUE(record_type, source_url)
);
CREATE INDEX IF NOT EXISTS idx_bc_court_court_type ON bc_court_records(court_type);
CREATE INDEX IF NOT EXISTS idx_bc_court_file_number ON bc_court_records(file_number);
CREATE INDEX IF NOT EXISTS idx_bc_court_filing_date ON bc_court_records(filing_date);
CREATE INDEX IF NOT EXISTS idx_bc_court_case_type ON bc_court_records(case_type);
CREATE INDEX IF NOT EXISTS idx_bc_court_location ON bc_court_records(location);
CREATE INDEX IF NOT EXISTS idx_bc_court_status ON bc_court_records(status);
CREATE INDEX IF NOT EXISTS idx_bc_court_ingested ON bc_court_records(ingested_at DESC);
`;

export const DEFAULT_MAX_RECORDS = 400;
export const DEFAULT_TIMEOUT_MS = 30_000;

const DEFAULT_USER_AGENT = 'Quill/0.1 (civic-tech; mailto:hello@maplespike.ca)';

export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'application/json,text/html,*/*',
};

export class BcCourtsError extends Error {
  constructor(message: string, public readonly code: string = 'BCCOURTS_ERROR', public readonly url?: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'BcCourtsError';
  }
}
