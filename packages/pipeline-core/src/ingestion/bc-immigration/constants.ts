// SPDX-License-Identifier: AGPL-3.0-or-later

export const BCIMMIGRATION_DDL = `
CREATE TABLE IF NOT EXISTS bc_immigration_records (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL,
  stream TEXT,
  nominations_issued INTEGER,
  year INTEGER,
  quarter INTEGER,
  occupation TEXT,
  industry TEXT,
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'bc-bcpnp',
  ingested_at TEXT NOT NULL,
  UNIQUE(record_type, source_url)
);
CREATE INDEX IF NOT EXISTS idx_bc_immigration_stream ON bc_immigration_records(stream);
CREATE INDEX IF NOT EXISTS idx_bc_immigration_nominations_issued ON bc_immigration_records(nominations_issued);
CREATE INDEX IF NOT EXISTS idx_bc_immigration_year ON bc_immigration_records(year);
CREATE INDEX IF NOT EXISTS idx_bc_immigration_quarter ON bc_immigration_records(quarter);
CREATE INDEX IF NOT EXISTS idx_bc_immigration_occupation ON bc_immigration_records(occupation);
CREATE INDEX IF NOT EXISTS idx_bc_immigration_industry ON bc_immigration_records(industry);
CREATE INDEX IF NOT EXISTS idx_bc_immigration_ingested ON bc_immigration_records(ingested_at DESC);
`;

export const DEFAULT_MAX_RECORDS = 400;
export const DEFAULT_TIMEOUT_MS = 30_000;

const DEFAULT_USER_AGENT = 'Quill/0.1 (civic-tech; mailto:j_kroeker.ca)';

export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'application/json,text/html,*/*',
};

export class BcImmigrationError extends Error {
  constructor(message: string, public readonly code: string = 'BCIMMIGRATION_ERROR', public readonly url?: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'BcImmigrationError';
  }
}
