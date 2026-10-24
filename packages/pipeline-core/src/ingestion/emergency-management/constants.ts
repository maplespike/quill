// SPDX-License-Identifier: AGPL-3.0-only

export const EMERGENCY_MANAGEMENT_SOURCES = {
  CDD: 'https://www.publicsafety.gc.ca/cnt/rsrcs/cndn-dsstr-dtbs/index-en.aspx',
  ECCC: 'https://weather.gc.ca/alerts/index_e.html',
  NRCAN: 'https://www.earthquakescanada.nrcan.gc.ca/index-en.php',
} as const;

export const EMERGENCY_MANAGEMENT_DDL = `
CREATE TABLE IF NOT EXISTS emergency_records (
  id TEXT PRIMARY KEY,
  source_system TEXT NOT NULL,
  record_type TEXT NOT NULL DEFAULT 'general',
  title TEXT,
  description TEXT,
  url TEXT,
  published_at TEXT,
  ingested_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_emergencyManagement_source ON emergency_records(source_system);
CREATE INDEX IF NOT EXISTS idx_emergencyManagement_published ON emergency_records(published_at DESC);
`;

export const DEFAULT_MAX_RECORDS = 500;
export const DEFAULT_USER_AGENT = 'Quill/0.1 (civic-tech; mailto:dev@maplespike.ca)';
export const DEFAULT_TIMEOUT_MS = 30_000;

export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'application/json,text/html,*/*',
};

export class EmergencyManagementError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'EMERGENCY_MANAGEMENT_ERROR',
    public readonly url?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'EmergencyManagementError';
  }
}
