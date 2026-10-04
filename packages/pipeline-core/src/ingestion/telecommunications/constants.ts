// SPDX-License-Identifier: AGPL-3.0-or-later

export const TELECOMMUNICATIONS_SOURCES = {
  CRTC: 'https://crtc.gc.ca/eng/publications/reports.htm',
  ISED: 'https://ised-isde.canada.ca/site/spectrum-management/en',
  CIRA: 'https://www.cira.ca/resources/corporate/industry-data',
} as const;

export const TELECOMMUNICATIONS_DDL = `
CREATE TABLE IF NOT EXISTS telecommunications_records (
  id TEXT PRIMARY KEY,
  source_system TEXT NOT NULL,
  record_type TEXT NOT NULL DEFAULT 'general',
  title TEXT,
  description TEXT,
  url TEXT,
  published_at TEXT,
  ingested_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_telecommunications_source ON telecommunications_records(source_system);
CREATE INDEX IF NOT EXISTS idx_telecommunications_published ON telecommunications_records(published_at DESC);
`;

export const DEFAULT_MAX_RECORDS = 500;
export const DEFAULT_USER_AGENT = 'Quill/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)';
export const DEFAULT_TIMEOUT_MS = 30_000;

export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'application/json,text/html,*/*',
};

export class TelecommunicationsError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'TELECOMMUNICATIONS_ERROR',
    public readonly url?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'TelecommunicationsError';
  }
}
