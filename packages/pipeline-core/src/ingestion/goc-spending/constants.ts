// SPDX-License-Identifier: AGPL-3.0-only
/**
 * GoC-Spending Constants — Quill
 *
 * URLs, file names, and configuration for the GoC-Spending dataset.
 *
 * Sources:
 *   Combined CSVs: https://goc-spending.github.io/download/
 *   Analysis CSVs: https://github.com/GoC-Spending/goc-spending-analysis
 *   Raw JSON:      https://github.com/GoC-Spending/goc-spending-data
 *
 * Terms: use the original publisher's dataset-specific declaration.
 */

/** Base URL for GoC-Spending project download page */
export const GOC_SPENDING_BASE = 'https://goc-spending.github.io';

/** Download URLs for combined CSVs (ZIP compressed) */
export const GOC_COMBINED_CSVS = {
  /** Raw source data with duplicates */
  SOURCE: 'https://goc-spending.github.io/download/source.zip',
  /** Source data with generated metadata columns */
  SOURCE_WITH_METADATA: 'https://goc-spending.github.io/download/source_with_metadata.zip',
  /** Clean (deduplicated, error-flagged) */
  CLEAN: 'https://goc-spending.github.io/download/clean.zip',
  /** By-year breakdown from clean table */
  BY_YEAR: 'https://goc-spending.github.io/download/by_year.zip',
} as const;

/** Raw JSON data archive on GitHub */
export const GOC_SPENDING_DATA_REPO =
  'https://raw.githubusercontent.com/GoC-Spending/goc-spending-data/master';

/** Analysis CSVs on GitHub */
export const GOC_ANALYSIS_BASE =
  'https://raw.githubusercontent.com/GoC-Spending/goc-spending-analysis/master';

/** Default max records to parse per source */
export const DEFAULT_MAX_RECORDS = 10_000;

/** Timeout for fetching CSV files (seconds) */
export const FETCH_TIMEOUT_MS = 30_000;

/** D1 table creation SQL for goc_contracts */
export const GOC_CONTRACTS_DDL = `
CREATE TABLE IF NOT EXISTS goc_contracts (
  id TEXT PRIMARY KEY,
  vendor TEXT,
  vendor_normalized TEXT,
  department TEXT,
  description TEXT,
  value REAL,
  start_year INTEGER,
  end_year INTEGER,
  source TEXT,
  reference_number TEXT,
  contract_date TEXT,
  procurement_method TEXT,
  trade_agreement_exemption TEXT,
  is_duplicate INTEGER DEFAULT 0,
  is_error INTEGER DEFAULT 0,
  data_hash TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_goc_dept ON goc_contracts(department);
CREATE INDEX IF NOT EXISTS idx_goc_vendor ON goc_contracts(vendor_normalized);
CREATE INDEX IF NOT EXISTS idx_goc_year ON goc_contracts(start_year);
CREATE INDEX IF NOT EXISTS idx_goc_value ON goc_contracts(value DESC);
`;

/** D1 table for department aggregates */
export const GOC_DEPT_SPENDING_DDL = `
CREATE TABLE IF NOT EXISTS goc_dept_spending (
  id TEXT PRIMARY KEY,
  department TEXT NOT NULL,
  fiscal_year TEXT NOT NULL,
  contract_count INTEGER NOT NULL DEFAULT 0,
  total_value REAL NOT NULL DEFAULT 0,
  avg_value REAL NOT NULL DEFAULT 0,
  data_hash TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_goc_dept_fiscal ON goc_dept_spending(department, fiscal_year);
`;
