/**
 * CMHC (Canada Mortgage and Housing Corporation) Constants — Quill
 *
 * Source URLs, known metrics, DDL, and defaults for ingesting
 * Canadian housing market data from CMHC.
 *
 * Primary sources:
 *   CMHC Housing Market Information: https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research
 *   CMHC Open Data (CKAN):          Various CKAN datasets
 */

import type { CmhcMetric, CmhcHousingType } from './types.js';

/* ------------------------------------------------------------------ */
/*  Source URLs                                                        */
/* ------------------------------------------------------------------ */

export const CMHC_SOURCES = {
  /** Main CMHC housing market information portal */
  PORTAL: 'https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research',

  /** CMHC open data portal */
  OPENDATA: 'https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-market-data',

  /** Housing starts */
  HOUSING_STARTS: 'https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-market-data/housing-starts',

  /** Vacancy rates */
  VACANCY_RATES: 'https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-market-data/vacancy-rates',

  /** Rental market survey */
  RENTAL_MARKET: 'https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-market-data/rental-market',

  /** Housing affordability */
  AFFORDABILITY: 'https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-market-data/housing-affordability',

  /** CKAN API base */
  CKAN_API: 'https://open.canada.ca/data/api/3/action',

  /** Known CKAN package IDs for CMHC datasets */
  CKAN_PACKAGE_IDS: {
    HOUSING_STARTS: 'cmhc-housing-starts',
    VACANCY_RATES: 'cmhc-vacancy-rates',
    RENTAL_MARKET: 'cmhc-rental-market-survey',
    AFFORDABILITY: 'cmhc-housing-affordability',
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Metric Configuration                                               */
/* ------------------------------------------------------------------ */

export interface CmhcSourceConfig {
  /** Human-readable label */
  label: string;
  /** Source URL */
  url: string;
  /** Source system identifier */
  sourceSystem: string;
  /** Default limit for fetches */
  defaultLimit: number;
}

export const CMHC_METRIC_CONFIG: Record<CmhcMetric, CmhcSourceConfig> = {
  housing_starts: {
    label: 'Housing Starts',
    url: CMHC_SOURCES.HOUSING_STARTS,
    sourceSystem: 'cmhc-housing-starts',
    defaultLimit: 500,
  },
  vacancy_rate: {
    label: 'Vacancy Rates',
    url: CMHC_SOURCES.VACANCY_RATES,
    sourceSystem: 'cmhc-vacancy-rates',
    defaultLimit: 500,
  },
  rental_rate: {
    label: 'Rental Rates',
    url: CMHC_SOURCES.RENTAL_MARKET,
    sourceSystem: 'cmhc-rental-rates',
    defaultLimit: 500,
  },
  affordability: {
    label: 'Housing Affordability',
    url: CMHC_SOURCES.AFFORDABILITY,
    sourceSystem: 'cmhc-affordability',
    defaultLimit: 500,
  },
  home_price: {
    label: 'Home Prices',
    url: CMHC_SOURCES.PORTAL,
    sourceSystem: 'cmhc-home-prices',
    defaultLimit: 500,
  },
  mortgage_arrears: {
    label: 'Mortgage Arrears',
    url: CMHC_SOURCES.PORTAL,
    sourceSystem: 'cmhc-mortgage-arrears',
    defaultLimit: 500,
  },
  housing_completions: {
    label: 'Housing Completions',
    url: CMHC_SOURCES.HOUSING_STARTS,
    sourceSystem: 'cmhc-housing-completions',
    defaultLimit: 500,
  },
  housing_under_construction: {
    label: 'Housing Under Construction',
    url: CMHC_SOURCES.HOUSING_STARTS,
    sourceSystem: 'cmhc-under-construction',
    defaultLimit: 500,
  },
  supply: {
    label: 'Housing Supply',
    url: CMHC_SOURCES.PORTAL,
    sourceSystem: 'cmhc-supply',
    defaultLimit: 500,
  },
  demand: {
    label: 'Housing Demand',
    url: CMHC_SOURCES.PORTAL,
    sourceSystem: 'cmhc-demand',
    defaultLimit: 500,
  },
  absorption: {
    label: 'Absorption',
    url: CMHC_SOURCES.HOUSING_STARTS,
    sourceSystem: 'cmhc-absorption',
    defaultLimit: 500,
  },
  other: {
    label: 'Other Housing Data',
    url: CMHC_SOURCES.PORTAL,
    sourceSystem: 'cmhc-other',
    defaultLimit: 500,
  },
};

export const ALL_CMHC_METRICS: CmhcMetric[] = [
  'housing_starts', 'vacancy_rate', 'rental_rate', 'affordability',
  'home_price', 'mortgage_arrears', 'housing_completions',
  'housing_under_construction', 'supply', 'demand', 'absorption', 'other',
];

export const ALL_CMHC_HOUSING_TYPES: CmhcHousingType[] = [
  'rental', 'ownership', 'social', 'co-op', 'condo',
  'single_detached', 'semi_detached', 'row', 'apartment', 'all',
];

/* ------------------------------------------------------------------ */
/*  Metric Type Map                                                    */
/* ------------------------------------------------------------------ */

export const CMHC_METRIC_TYPE_MAP: Record<string, CmhcMetric> = {
  'housing starts': 'housing_starts',
  'housing_starts': 'housing_starts',
  'starts': 'housing_starts',
  'vacancy rate': 'vacancy_rate',
  'vacancy_rate': 'vacancy_rate',
  'vacancy': 'vacancy_rate',
  'rental rate': 'rental_rate',
  'rental_rate': 'rental_rate',
  'rent': 'rental_rate',
  'affordability': 'affordability',
  'home price': 'home_price',
  'home_price': 'home_price',
  'price': 'home_price',
  'mortgage arrears': 'mortgage_arrears',
  'mortgage_arrears': 'mortgage_arrears',
  'completions': 'housing_completions',
  'housing completions': 'housing_completions',
  'under construction': 'housing_under_construction',
  'supply': 'supply',
  'demand': 'demand',
  'absorption': 'absorption',
};

export const CMHC_HOUSING_TYPE_MAP: Record<string, CmhcHousingType> = {
  'rental': 'rental',
  'ownership': 'ownership',
  'owner': 'ownership',
  'social': 'social',
  'social housing': 'social',
  'co-op': 'co-op',
  'cooperative': 'co-op',
  'condo': 'condo',
  'condominium': 'condo',
  'single detached': 'single_detached',
  'single_detached': 'single_detached',
  'semi detached': 'semi_detached',
  'semi_detached': 'semi_detached',
  'row': 'row',
  'row house': 'row',
  'apartment': 'apartment',
  'all': 'all',
  'total': 'all',
};

/* ------------------------------------------------------------------ */
/*  DDL — Database Schema Definition                                   */
/* ------------------------------------------------------------------ */

export const CMHC_DDL = `
-- CMHC — Canada Mortgage and Housing Corporation housing market data
-- Tracks housing starts, vacancy rates, rental rates, affordability, and related metrics.
CREATE TABLE IF NOT EXISTS cmhc_records (
  id TEXT PRIMARY KEY,

  -- Metric identity
  metric_name TEXT NOT NULL,
  metric_type TEXT NOT NULL CHECK(metric_type IN (
    'housing_starts', 'vacancy_rate', 'rental_rate', 'affordability',
    'home_price', 'mortgage_arrears', 'housing_completions',
    'housing_under_construction', 'supply', 'demand', 'absorption', 'other'
  )),

  -- Geography
  geographic_area TEXT NOT NULL,
  geographic_level TEXT NOT NULL DEFAULT 'city',

  -- Time period
  period TEXT NOT NULL,
  period_start TEXT,
  period_end TEXT,

  -- Value
  value REAL,
  unit TEXT,

  -- Housing type
  housing_type TEXT NOT NULL DEFAULT 'all' CHECK(housing_type IN (
    'rental', 'ownership', 'social', 'co-op', 'condo',
    'single_detached', 'semi_detached', 'row', 'apartment', 'all'
  )),

  -- Adjustment
  seasonally_adjusted INTEGER,

  -- Provenance
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'cmhc-housing-starts',

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(metric_name, geographic_area, period, housing_type, source_url)
);

CREATE INDEX IF NOT EXISTS idx_cmhc_metric_name ON cmhc_records(metric_name);
CREATE INDEX IF NOT EXISTS idx_cmhc_metric_type ON cmhc_records(metric_type);
CREATE INDEX IF NOT EXISTS idx_cmhc_geo ON cmhc_records(geographic_area);
CREATE INDEX IF NOT EXISTS idx_cmhc_period ON cmhc_records(period DESC);
CREATE INDEX IF NOT EXISTS idx_cmhc_housing_type ON cmhc_records(housing_type);
CREATE INDEX IF NOT EXISTS idx_cmhc_value ON cmhc_records(value);
CREATE INDEX IF NOT EXISTS idx_cmhc_geo_period ON cmhc_records(geographic_area, period DESC);
CREATE INDEX IF NOT EXISTS idx_cmhc_metric_period ON cmhc_records(metric_type, period DESC);
CREATE INDEX IF NOT EXISTS idx_cmhc_ingested ON cmhc_records(ingested_at DESC);
`;

/* ------------------------------------------------------------------ */
/*  Default Options                                                    */
/* ------------------------------------------------------------------ */

export const DEFAULT_MAX_RECORDS = 500;
export const DEFAULT_USER_AGENT = 'Quill/0.1 (civic-tech; mailto:dev@maplespike.ca)';
export const DEFAULT_TIMEOUT_MS = 30_000;

export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'application/json,text/csv,*/*',
};

/* ------------------------------------------------------------------ */
/*  Error Type                                                         */
/* ------------------------------------------------------------------ */

export class CmhcError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'CMHC_ERROR',
    public readonly metric?: string,
    public readonly url?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'CmhcError';
  }
}
