/**
 * LMIA Constants — Quill
 *
 * CKAN package IDs, base URLs, URL builders, and DDL for LMIA data
 * published by ESDC on open.canada.ca.
 *
 * The data is published quarterly since 2014, with both positive and
 * negative LMIA datasets available as CSV/XLSX files.
 */

import { LmiaOutcome } from './types.js';


/**
 * Known CKAN package IDs on open.canada.ca for LMIA datasets.
 *
 * Discovered via:
 *   https://open.canada.ca/data/en/dataset/?q=labour+market+impact+assessment
 */
export const LMIA_CKAN_PACKAGE_IDS: Record<LmiaOutcome, string> = {
  [LmiaOutcome.Positive]: '90fed587-1364-4f33-a9ee-208181dc0b97',
  [LmiaOutcome.Negative]: 'f82f66f2-a22b-4511-bccf-e1d74db39ae5',
};


/**
 * Known resource IDs for the latest quarterly data.
 *
 * These change quarterly as new resources are published.
 * The fetcher should discover the latest resource from CKAN metadata,
 * but these serve as fallbacks and known working IDs.
 *
 * Format: { outcome: { quarter: resourceId } }
 */
export const LMIA_KNOWN_RESOURCES: Partial<
  Record<LmiaOutcome, Partial<Record<string, string>>>
> = {
  [LmiaOutcome.Positive]: {
    /** Latest EN resource as of 2025Q4 */
    '2025Q4': 'fbfda891-5327-4e01-927e-0e0dd580d304',
  },
};


export const LMIA_SOURCES = {
  /** open.canada.ca CKAN portal */
  CKAN: {
    /** CKAN API base */
    BASE: 'https://open.canada.ca/data',
    /** CKAN package_show API endpoint */
    PACKAGE_SHOW: 'https://open.canada.ca/data/api/3/action/package_show',
    /** CKAN package_search API endpoint */
    SEARCH: 'https://open.canada.ca/data/api/3/action/package_search',
    /** CKAN resource download base (not a real URL — use buildDownloadUrl) */
    DOWNLOAD_BASE: 'https://open.canada.ca/data/dataset',
    /** Query for LMIA datasets */
    LMIA_QUERY: 'labour+market+impact+assessment',
  },
} as const;


/**
 * Build a CKAN package_show URL for a given LMIA outcome.
 */
export function lmiaCkanPackageUrl(outcome: LmiaOutcome): string {
  const packageId = LMIA_CKAN_PACKAGE_IDS[outcome];
  return `${LMIA_SOURCES.CKAN.PACKAGE_SHOW}?id=${packageId}`;
}

/**
 * Build a CKAN resource download URL.
 *
 * Pattern: https://open.canada.ca/data/dataset/{PACKAGE_ID}/resource/{RESOURCE_ID}/download/{filename}
 */
export function lmiaDownloadUrl(
  outcome: LmiaOutcome,
  resourceId: string,
  filename: string = 'data.csv',
): string {
  const packageId = LMIA_CKAN_PACKAGE_IDS[outcome];
  return `${LMIA_SOURCES.CKAN.DOWNLOAD_BASE}/${packageId}/resource/${resourceId}/download/${filename}`;
}

/**
 * Build a CKAN package_search URL for LMIA datasets.
 */
export function lmiaSearchUrl(query: string = LMIA_SOURCES.CKAN.LMIA_QUERY, rows: number = 20): string {
  return `${LMIA_SOURCES.CKAN.SEARCH}?q=${query}&rows=${rows}`;
}


export const LMIA_DDL = `
CREATE TABLE IF NOT EXISTS lmia_records (
  id TEXT PRIMARY KEY,
  employer TEXT NOT NULL,
  city TEXT,
  province TEXT,
  outcome TEXT NOT NULL CHECK(outcome IN ('positive', 'negative')),
  stream TEXT NOT NULL,
  stream_raw TEXT NOT NULL,
  noc TEXT,
  noc_title TEXT,
  positions INTEGER,
  wage_min REAL,
  wage_max REAL,
  wage_rate TEXT,
  quarter TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lmia_employer ON lmia_records(employer);
CREATE INDEX IF NOT EXISTS idx_lmia_outcome ON lmia_records(outcome);
CREATE INDEX IF NOT EXISTS idx_lmia_stream ON lmia_records(stream);
CREATE INDEX IF NOT EXISTS idx_lmia_province ON lmia_records(province);
CREATE INDEX IF NOT EXISTS idx_lmia_noc ON lmia_records(noc);
CREATE INDEX IF NOT EXISTS idx_lmia_quarter ON lmia_records(quarter);
CREATE INDEX IF NOT EXISTS idx_lmia_quarter_outcome ON lmia_records(quarter, outcome);
CREATE INDEX IF NOT EXISTS idx_lmia_employer_quarter ON lmia_records(employer, quarter);
CREATE INDEX IF NOT EXISTS idx_lmia_employer_outcome ON lmia_records(employer, outcome);
`;
