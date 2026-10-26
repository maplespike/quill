// SPDX-License-Identifier: AGPL-3.0-only

export const QcInfrastructure_DDL = `
CREATE TABLE IF NOT EXISTS qc_infrastructure_projects (
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
  source_system TEXT NOT NULL DEFAULT 'qc-infrastructure',
  ingested_at TEXT NOT NULL,
  UNIQUE(record_type, source_url)
);
CREATE INDEX IF NOT EXISTS idx_qc_infrastructure_category ON qc_infrastructure_projects(category);
CREATE INDEX IF NOT EXISTS idx_qc_infrastructure_subcategory ON qc_infrastructure_projects(subcategory);
CREATE INDEX IF NOT EXISTS idx_qc_infrastructure_period ON qc_infrastructure_projects(period);
CREATE INDEX IF NOT EXISTS idx_qc_infrastructure_fiscal_year ON qc_infrastructure_projects(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_qc_infrastructure_region ON qc_infrastructure_projects(region);
CREATE INDEX IF NOT EXISTS idx_qc_infrastructure_status ON qc_infrastructure_projects(status);
CREATE INDEX IF NOT EXISTS idx_qc_infrastructure_ingested ON qc_infrastructure_projects(ingested_at DESC);
`;

export const DEFAULT_MAX_RECORDS = 400;
export const DEFAULT_TIMEOUT_MS = 30_000;

export class QcInfrastructureError extends Error {
  constructor(message: string, public readonly code: string = 'QC_INFRASTRUCTURE_ERROR', public readonly url?: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'QcInfrastructureError';
  }
}
