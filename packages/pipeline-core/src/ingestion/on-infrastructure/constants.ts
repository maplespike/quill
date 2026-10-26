// SPDX-License-Identifier: AGPL-3.0-only

export const OnInfrastructure_DDL = `
CREATE TABLE IF NOT EXISTS on_infrastructure_projects (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL,
  category TEXT,
  subcategory TEXT,
  value REAL,
  unit TEXT,
  period TEXT,
  fiscal_year TEXT,
  region TEXT,
  status TEXT,
  description TEXT,
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'on-infrastructure',
  ingested_at TEXT NOT NULL,
  UNIQUE(record_type, source_url)
);
CREATE INDEX IF NOT EXISTS idx_on_infrastructure_category ON on_infrastructure_projects(category);
CREATE INDEX IF NOT EXISTS idx_on_infrastructure_subcategory ON on_infrastructure_projects(subcategory);
CREATE INDEX IF NOT EXISTS idx_on_infrastructure_period ON on_infrastructure_projects(period);
CREATE INDEX IF NOT EXISTS idx_on_infrastructure_fiscal_year ON on_infrastructure_projects(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_on_infrastructure_region ON on_infrastructure_projects(region);
CREATE INDEX IF NOT EXISTS idx_on_infrastructure_status ON on_infrastructure_projects(status);
CREATE INDEX IF NOT EXISTS idx_on_infrastructure_ingested ON on_infrastructure_projects(ingested_at DESC);
`;

export const DEFAULT_MAX_RECORDS = 400;
export const DEFAULT_TIMEOUT_MS = 30_000;

export class OnInfrastructureError extends Error {
  constructor(message: string, public readonly code: string = 'ON_INFRASTRUCTURE_ERROR', public readonly url?: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'OnInfrastructureError';
  }
}
