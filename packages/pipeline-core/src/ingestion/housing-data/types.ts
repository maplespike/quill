// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Housing Data Records Types — Quill
 *
 * Strongly-typed interfaces for CMHC housing market data and CHSP
 * (Canada Housing Statistics Program) data from Statistics Canada.
 *
 * Primary sources:
 *   - CMHC Rental Market Survey: https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-data/data-tables/rental-market
 *   - CMHC Vacancy Rates: https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-data/data-tables/vacancy-rates
 *   - CMHC Housing Starts: https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-data/data-tables/housing-starts
 *   - StatCan New Housing Price Index: https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=18100205
 *   - CHSP Housing Statistics: Canada Housing Statistics Program
 *
 * Cross-reference opportunities:
 *   - Federal: CMHC reports, StatCan economic data
 *   - Provincial: Provincial housing ministries data
 */

/* ------------------------------------------------------------------ */
/*  Record Type Enums                                                   */
/* ------------------------------------------------------------------ */

/** Housing types for classification */
export type HousingType =
  | 'single-detached'
  | 'semi-detached'
  | 'row-house'
  | 'apartment-condo'
  | 'townhouse'
  | 'duplex'
  | 'other';

/** Data categories for housing records */
export type HousingCategory =
  | 'rental'
  | 'ownership'
  | 'vacancy'
  | 'starts'
  | 'completions'
  | 'under-construction'
  | 'affordability';

/* ------------------------------------------------------------------ */
/*  Core Record Types                                                   */
/* ------------------------------------------------------------------ */

/**
 * A single housing market data record from CMHC or StatCan.
 * Normalised across rental, ownership, vacancy, and affordability data.
 */
export interface HousingMarketRecord {
  /** SHA-256 hash of record content (primary key) */
  id: string;

  /** Data category */
  category: HousingCategory;

  /** Metro area or city name */
  metroArea: string | null;

  /** Housing type */
  housingType: string | null;

  /** Average price (string to preserve precision and currency) */
  averagePrice: string | null;

  /** Median price (string to preserve precision and currency) */
  medianPrice: string | null;

  /** Rental rate (string to preserve units) */
  rentalRate: string | null;

  /** Vacancy rate (percentage) */
  vacancyRate: string | null;

  /** Period/quarter (e.g., "2024-Q1", "2024-03") */
  period: string | null;

  /** Source URL */
  sourceUrl: string;

  /** Source system name */
  sourceSystem: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/**
 * A single housing starts record from CHSP/CMHC.
 */
export interface HousingStartRecord {
  /** SHA-256 hash of record content (primary key) */
  id: string;

  /** Province or territory */
  province: string | null;

  /** Metro area or city (optional) */
  metroArea: string | null;

  /** Housing type */
  housingType: string | null;

  /** Number of housing starts */
  housingStarts: string | null;

  /** Period/quarter */
  period: string | null;

  /** Source URL */
  sourceUrl: string;

  /** Source system name */
  sourceSystem: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/**
 * A single housing completions record from CHSP/CMHC.
 */
export interface HousingCompletionRecord {
  /** SHA-256 hash of record content (primary key) */
  id: string;

  /** Province or territory */
  province: string | null;

  /** Metro area or city (optional) */
  metroArea: string | null;

  /** Housing type */
  housingType: string | null;

  /** Number of completions */
  completions: string | null;

  /** Number under construction */
  underConstruction: string | null;

  /** Period/quarter */
  period: string | null;

  /** Source URL */
  sourceUrl: string;

  /** Source system name */
  sourceSystem: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Raw Fetch Types                                                    */
/* ------------------------------------------------------------------ */

/** Generic raw record from CMHC housing market data */
export interface RawHousingMarketRecord {
  category?: string;
  metroArea?: string;
  metro_area?: string;
  city?: string;
  housingType?: string;
  housing_type?: string;
  type?: string;
  averagePrice?: string;
  average_price?: string;
  avgPrice?: string;
  avg_price?: string;
  medianPrice?: string;
  median_price?: string;
  rentalRate?: string;
  rental_rate?: string;
  vacancyRate?: string;
  vacancy_rate?: string;
  period?: string;
  quarter?: string;
  sourceUrl?: string;
  source_url?: string;
  url?: string;
  sourceSystem?: string;
  source_system?: string;

  /** Catch-all for any other fields */
  [key: string]: unknown;
}

/** Generic raw record from CHSP housing starts data */
export interface RawHousingStartRecord {
  province?: string;
  metroArea?: string;
  metro_area?: string;
  city?: string;
  housingType?: string;
  housing_type?: string;
  type?: string;
  housingStarts?: string;
  housing_starts?: string;
  starts?: string;
  period?: string;
  quarter?: string;
  sourceUrl?: string;
  source_url?: string;
  url?: string;
  sourceSystem?: string;
  source_system?: string;

  /** Catch-all for any other fields */
  [key: string]: unknown;
}

/** Generic raw record from CHSP housing completions data */
export interface RawHousingCompletionRecord {
  province?: string;
  metroArea?: string;
  metro_area?: string;
  city?: string;
  housingType?: string;
  housing_type?: string;
  type?: string;
  completions?: string;
  underConstruction?: string;
  under_construction?: string;
  period?: string;
  quarter?: string;
  sourceUrl?: string;
  source_url?: string;
  url?: string;
  sourceSystem?: string;
  source_system?: string;

  /** Catch-all for any other fields */
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Ingestion Options & Result                                         */
/* ------------------------------------------------------------------ */

export interface HousingDataIngestionOptions {
  /** Categories to ingest (default: all) */
  categories?: HousingCategory[];

  /** Metro areas to filter (default: all) */
  metroAreas?: string[];

  /** Max records to process */
  maxRecords?: number;

  /** Force re-ingest of already-ingested records */
  force?: boolean;

  /** Progress callback */
  onProgress?: (msg: string) => void;
}

export interface HousingDataIngestionResult {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  perCategory: Record<string, {
    recordsFound: number;
    recordsIngested: number;
  }>;
  durationMs: number;
}

/* ------------------------------------------------------------------ */
/*  Search Options                                                     */
/* ------------------------------------------------------------------ */

export interface HousingDataSearchOptions {
  limit?: number;
  category?: HousingCategory;
  metroArea?: string;
  housingType?: string;
  period?: string;
}