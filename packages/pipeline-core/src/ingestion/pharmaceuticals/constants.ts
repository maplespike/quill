// SPDX-License-Identifier: AGPL-3.0-only

export const PHARMACEUTICALS_SOURCES = {
  PMPRB: 'https://www.pmprb-cepmb.gc.ca/analytics',
  DPD: 'https://health-products.canada.ca/dpd-bdpp/index-eng.jsp',
  DRUGSHORTAGES: 'https://www.drugshortagescanada.ca',
  CADTH: 'https://www.cadth.ca/reports',
} as const;

export const PHARMACEUTICALS_DDL = `
CREATE TABLE IF NOT EXISTS pharmaceuticals_records (
  id TEXT PRIMARY KEY,
  source_system TEXT NOT NULL,
  record_type TEXT NOT NULL DEFAULT 'general',
  title TEXT,
  description TEXT,
  url TEXT,
  published_at TEXT,
  ingested_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pharmaceuticals_source ON pharmaceuticals_records(source_system);
CREATE INDEX IF NOT EXISTS idx_pharmaceuticals_published ON pharmaceuticals_records(published_at DESC);
`;

export const DEFAULT_MAX_RECORDS = 500;
export const DEFAULT_USER_AGENT = 'Quill/0.1 (civic-tech; mailto:dev@maplespike.ca)';
export const DEFAULT_TIMEOUT_MS = 30_000;

export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'application/json,text/html,*/*',
};

export class PharmaceuticalsError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'PHARMACEUTICALS_ERROR',
    public readonly url?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'PharmaceuticalsError';
  }
}
