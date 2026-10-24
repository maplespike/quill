// SPDX-License-Identifier: AGPL-3.0-only

export const BcEconomic_DDL = `
CREATE TABLE IF NOT EXISTS bc_economic_indicators (
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
  source_system TEXT NOT NULL DEFAULT 'bc-economic',
  ingested_at TEXT NOT NULL,
  UNIQUE(record_type, source_url)
);
CREATE INDEX IF NOT EXISTS idx_bc_economic_category ON bc_economic_indicators(category);
CREATE INDEX IF NOT EXISTS idx_bc_economic_subcategory ON bc_economic_indicators(subcategory);
CREATE INDEX IF NOT EXISTS idx_bc_economic_period ON bc_economic_indicators(period);
CREATE INDEX IF NOT EXISTS idx_bc_economic_fiscal_year ON bc_economic_indicators(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_bc_economic_region ON bc_economic_indicators(region);
CREATE INDEX IF NOT EXISTS idx_bc_economic_status ON bc_economic_indicators(status);
CREATE INDEX IF NOT EXISTS idx_bc_economic_ingested ON bc_economic_indicators(ingested_at DESC);
`;

export const DEFAULT_MAX_RECORDS = 400;
export const DEFAULT_TIMEOUT_MS = 30_000;

export class BcEconomicError extends Error {
  constructor(message: string, public readonly code: string = 'BC_ECONOMIC_ERROR', public readonly url?: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'BcEconomicError';
  }
}
