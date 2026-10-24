// SPDX-License-Identifier: AGPL-3.0-only

export const POLICING_SECURITY_SOURCES = {
  RCMP: 'https://www150.statcan.gc.ca/t1/wds/rest/getFullTableDownload/CSV/35100178',
  CSIS: 'https://www.canada.ca/en/security-intelligence-service/corporate/publications.html',
  CSE: 'https://www.cyber.gc.ca/en/alerts-advisories',
  CSC: 'https://www.csc-scc.gc.ca/research/005007-eng.shtml',
} as const;

export const POLICING_SECURITY_DDL = `
CREATE TABLE IF NOT EXISTS policing_records (
  id TEXT PRIMARY KEY,
  source_system TEXT NOT NULL,
  record_type TEXT NOT NULL DEFAULT 'general',
  title TEXT,
  description TEXT,
  url TEXT,
  published_at TEXT,
  ingested_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_policingSecurity_source ON policing_records(source_system);
CREATE INDEX IF NOT EXISTS idx_policingSecurity_published ON policing_records(published_at DESC);
`;

export const DEFAULT_MAX_RECORDS = 500;
export const DEFAULT_USER_AGENT = 'Quill/0.1 (civic-tech; mailto:dev@maplespike.ca)';
export const DEFAULT_TIMEOUT_MS = 30_000;

export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'application/json,text/html,*/*',
};

export class PolicingSecurityError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'POLICING_SECURITY_ERROR',
    public readonly url?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'PolicingSecurityError';
  }
}
