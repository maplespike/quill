/**
 * NPRI (National Pollutant Release Inventory) Constants — MapleSpike Pipeline
 *
 * Source URLs, CKAN search configurations, DDL, and defaults for
 * ingesting Canada's National Pollutant Release Inventory data.
 *
 * Primary source:
 *   https://www.canada.ca/en/environment-climate-change/services/national-pollutant-release-inventory.html
 *
 * CKAN API on open.canada.ca:
 *   Search:  https://open.canada.ca/data/api/3/action/package_search?q=npri
 *   Package: https://open.canada.ca/data/api/3/action/package_show
 */

/* ------------------------------------------------------------------ */
/*  Source URLs                                                        */
/* ------------------------------------------------------------------ */

export const NPRI_SOURCES = {
  /** ECCC NPRI main page */
  NPRI_HOME: 'https://www.canada.ca/en/environment-climate-change/services/national-pollutant-release-inventory.html',

  /** CKAN API on open.canada.ca */
  CKAN: {
    BASE: 'https://open.canada.ca/data',
    API_BASE: 'https://open.canada.ca/data/api/3/action',
    PACKAGE_SEARCH: 'https://open.canada.ca/data/api/3/action/package_search',
    PACKAGE_SHOW: 'https://open.canada.ca/data/api/3/action/package_show',
    RESOURCE_SHOW: 'https://open.canada.ca/data/api/3/action/resource_show',
  },

  /** Default search query for NPRI packages on CKAN */
  NPRI_CKAN_QUERY: '(npri OR "national pollutant release inventory")',

  /** ECCC single-window NPRI data portal */
  NPRI_DATA_PORTAL: 'https://data.ec.gc.ca/data/substances/monitor/national-pollutant-release-inventory/',
} as const;

/* ------------------------------------------------------------------ */
/*  Known CKAN Package IDs for NPRI Data                               */
/* ------------------------------------------------------------------ */

export const NPRI_CKAN_PACKAGE_IDS: Record<string, string> = {
  NPRI_FACILITY_SUBSTANCE: '7a5d0d1e-3c0a-4b9e-b8c2-7e1f2a3b4c5d',
  NPRI_SUBSTANCE_SUMMARIES: '9b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e',
};

/* ------------------------------------------------------------------ */
/*  Canadian Province Codes                                            */
/* ------------------------------------------------------------------ */

export const NPRI_PROVINCES = [
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
] as const;

export type NpriProvince = typeof NPRI_PROVINCES[number];

/* ------------------------------------------------------------------ */
/*  DDL — Database Schema Definition                                   */
/* ------------------------------------------------------------------ */

export const NPRI_RECORDS_DDL = `
-- NPRI (National Pollutant Release Inventory) — facility pollutant releases
CREATE TABLE IF NOT EXISTS npri_records (
  id TEXT PRIMARY KEY,

  -- Facility info
  facility_name TEXT NOT NULL,
  facility_location TEXT,
  province TEXT,
  latitude REAL,
  longitude REAL,

  -- Substance info
  substance_name TEXT NOT NULL,
  substance_cas TEXT,

  -- Release quantities (kg)
  release_air_kg REAL,
  release_water_kg REAL,
  release_land_kg REAL,
  disposal_kg REAL,
  recycling_kg REAL,

  -- Temporal
  fiscal_year TEXT NOT NULL,

  -- Parent company
  reported_by TEXT,

  -- Provenance
  source_url TEXT NOT NULL,
  ckan_package_id TEXT,
  ckan_resource_id TEXT,
  source_system TEXT NOT NULL DEFAULT 'open-canada-ckan',

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(facility_name, substance_name, fiscal_year, source_url)
);

CREATE INDEX IF NOT EXISTS idx_npri_facility ON npri_records(facility_name);
CREATE INDEX IF NOT EXISTS idx_npri_substance ON npri_records(substance_name);
CREATE INDEX IF NOT EXISTS idx_npri_province ON npri_records(province);
CREATE INDEX IF NOT EXISTS idx_npri_fiscal_year ON npri_records(fiscal_year DESC);
CREATE INDEX IF NOT EXISTS idx_npri_reported_by ON npri_records(reported_by);
CREATE INDEX IF NOT EXISTS idx_npri_substance_cas ON npri_records(substance_cas);
CREATE INDEX IF NOT EXISTS idx_npri_facility_province ON npri_records(facility_name, province);
CREATE INDEX IF NOT EXISTS idx_npri_fiscal_province ON npri_records(fiscal_year DESC, province);
CREATE INDEX IF NOT EXISTS idx_npri_ingested ON npri_records(ingested_at DESC);
`;

/* ------------------------------------------------------------------ */
/*  Default Options                                                    */
/* ------------------------------------------------------------------ */

export const DEFAULT_MAX_RECORDS = 1000;
export const DEFAULT_USER_AGENT = 'MapleSpikePipeline/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)';
export const DEFAULT_TIMEOUT_MS = 30_000;

export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'application/json,text/csv,text/html,*/*',
};

/** Recent fiscal years for NPRI data */
export const RECENT_FISCAL_YEARS = [
  '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025',
];

/* ------------------------------------------------------------------ */
/*  Error Type                                                         */
/* ------------------------------------------------------------------ */

export class NpriError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'NPRI_ERROR',
    public readonly substance?: string,
    public readonly url?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'NpriError';
  }
}
