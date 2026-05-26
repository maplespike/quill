/**
 * World Bank Indicators Data Types — MapleSpike Pipeline
 *
 * Strongly typed interfaces for the World Bank Indicators API V2.
 * Covers 16,000+ indicators across 200+ countries with 50+ years of data.
 *
 * Data License: World Bank Open License — free for all uses.
 * https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets
 */

/* ------------------------------------------------------------------ */
/*  Base Record Types                                                  */
/* ------------------------------------------------------------------ */

/** Common fields across all World Bank indicator records. */
export interface WorldBankRecord {
  /** SHA-256 hash of the row content (primary key) */
  id: string;
  /** World Bank indicator code (e.g. "NY.GDP.MKTP.CD") */
  indicatorCode: string;
  /** Human-readable indicator name */
  indicatorName: string;
  /** Indicator category group (economy, health, education, etc.) */
  indicatorCategory: WorldBankIndicatorCategory;
  /** The numeric value */
  value: number | null;
  /** ISO-2 country code (e.g. "CA" for Canada, "US" for USA) */
  countryCode: string;
  /** Full country name */
  countryName: string;
  /** Year of the observation */
  year: number;
  /** ISO date string (year-01-01) */
  date: string;
  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
  /** Unit of measurement */
  unit: string | null;
  /** Decimal precision */
  decimal: number | null;
  /** Source URL for provenance */
  sourceUrl: string;
}

export type WorldBankIndicatorCategory =
  | 'economy'
  | 'trade'
  | 'health'
  | 'education'
  | 'population'
  | 'environment'
  | 'infrastructure'
  | 'poverty'
  | 'gender'
  | 'energy'
  | 'finance'
  | 'agriculture'
  | 'social';

/* ------------------------------------------------------------------ */
/*  Ingestion Result                                                   */
/* ------------------------------------------------------------------ */

export interface WorldBankIngestionResult {
  indicatorCode: string;
  indicatorName: string;
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}

export interface WorldBankAllIndicatorsResult {
  results: WorldBankIngestionResult[];
  totalRecords: number;
  totalErrors: number;
  durationMs: number;
}

/* ------------------------------------------------------------------ */
/*  API Response Types                                                 */
/* ------------------------------------------------------------------ */

/**
 * World Bank API response format.
 * Always returns a JSON array: [metadata_object, data_array]
 */
export interface WbApiMetadata {
  page: number;
  pages: number;
  per_page: number;
  total: number;
  sourceid: string;
  sourcename: string;
  lastupdated: string;
}

/** Raw data record from the World Bank API. */
export interface WbApiRecord {
  indicator: {
    id: string;
    value: string;
  };
  country: {
    id: string;
    value: string;
  };
  countryiso3code: string;
  date: string;
  value: number | null;
  unit: string;
  obs_status: string;
  decimal: number;
}

/** Typed World Bank API response tuple. */
export type WbApiResponse = [WbApiMetadata, WbApiRecord[]];

/** Indicator metadata from the /indicator endpoint. */
export interface WbIndicatorMeta {
  id: string;
  name: string;
  unit: string;
  source: {
    id: string;
    value: string;
  };
  sourceNote: string;
  sourceOrganization: string;
  topics: Array<{ id: string; value: string }>;
}

/* ------------------------------------------------------------------ */
/*  Country Types                                                      */
/* ------------------------------------------------------------------ */

export interface WbCountry {
  id: string;
  iso2Code: string;
  name: string;
  region: { id: string; value: string };
  adminregion: { id: string; value: string };
  incomeLevel: { id: string; value: string };
  lendingType: { id: string; value: string };
  capitalCity: string;
  longitude: string;
  latitude: string;
}
