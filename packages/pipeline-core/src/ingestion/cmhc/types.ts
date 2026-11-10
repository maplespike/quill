// SPDX-License-Identifier: AGPL-3.0-only
/**
 * CMHC (Canada Mortgage and Housing Corporation) Types — Quill
 *
 * Strongly-typed interfaces for Canadian housing market data:
 *   - Housing starts
 *   - Vacancy rates
 *   - Rental rates
 *   - Affordability indicators
 *   - Housing supply / demand metrics
 *
 * Primary sources:
 *   CMHC Housing Market Information: https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research
 *   CMHC Open Data (CKAN):          https://open.canada.ca/en/open-data
 *
 * Cross-reference opportunities:
 *   - Municipal: local housing policies and zoning decisions
 *   - Federal Budget: national housing strategy funding
 *   - Bank of Canada: interest rate impacts on housing affordability
 */

/* ------------------------------------------------------------------ */
/*  Metric Type                                                        */
/* ------------------------------------------------------------------ */

/** Types of housing metrics tracked from CMHC. */
export type CmhcMetric =
  | 'housing_starts'
  | 'vacancy_rate'
  | 'rental_rate'
  | 'affordability'
  | 'home_price'
  | 'mortgage_arrears'
  | 'housing_completions'
  | 'housing_under_construction'
  | 'supply'
  | 'demand'
  | 'absorption'
  | 'other';

/* ------------------------------------------------------------------ */
/*  Housing Type                                                       */
/* ------------------------------------------------------------------ */

/** Type of housing tracked by CMHC metrics. */
export type CmhcHousingType =
  | 'rental'
  | 'ownership'
  | 'social'
  | 'co-op'
  | 'condo'
  | 'single_detached'
  | 'semi_detached'
  | 'row'
  | 'apartment'
  | 'all';

/* ------------------------------------------------------------------ */
/*  Core Record Type                                                   */
/* ------------------------------------------------------------------ */

/**
 * A single CMHC housing market data point.
 */
export interface CmhcRecord {
  /** SHA-256 hash of record content (primary key) */
  id: string;

  /** Metric name/identifier */
  metricName: string;

  /** Metric type category */
  metricType: CmhcMetric;

  /** Geographic area (city, CMA, province, national) */
  geographicArea: string;

  /** Geographic level (city, CMA, province, national) */
  geographicLevel: string;

  /** Time period (e.g. "2024-Q1", "2024") */
  period: string;

  /** Start date of the period (ISO-8601) */
  periodStart: string | null;

  /** End date of the period (ISO-8601) */
  periodEnd: string | null;

  /** Numeric value of the metric */
  value: number | null;

  /** Unit of measurement (e.g. "units", "percent", "dollars", "index") */
  unit: string | null;

  /** Housing type */
  housingType: CmhcHousingType;

  /** Seasonally adjusted (true/false) */
  seasonallyAdjusted: boolean | null;

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

/** Generic raw record from any CMHC source. */
export interface RawCmhcRecord {
  metricName?: string;
  metricType?: string;
  geographicArea?: string;
  geographicLevel?: string;
  period?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  value?: number | string | null;
  unit?: string | null;
  housingType?: string;
  seasonallyAdjusted?: boolean | string | null;
  sourceUrl?: string;
  sourceSystem?: string;

  /** Catch-all for any other fields */
  [key: string]: unknown;
}

/** Shape of a CMHC CKAN API package response item. */
export interface CmhcCkanRecord {
  METRIC?: string;
  GEO?: string;
  PERIOD?: string;
  VALUE?: number | string;
  UNIT?: string;
  TYPE?: string;
  SEASONAL?: string;
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Ingestion Options & Result                                         */
/* ------------------------------------------------------------------ */

export interface CmhcIngestionOptions {
  /** Metric types to ingest (default: all) */
  metricTypes?: CmhcMetric[];

  /** Year filter */
  year?: number;

  /** Geographic area filter */
  geographicArea?: string;

  /** Max records to process */
  maxRecords?: number;

  /** Force re-ingest of already-ingested records */
  force?: boolean;

  /** Initialize table if it doesn't exist */
  initializeTable?: boolean;

  /** Progress callback */
  onProgress?: (msg: string) => void;
}

export interface CmhcIngestionResult {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  perMetric: Record<string, {
    recordsFound: number;
    recordsIngested: number;
  }>;
  durationMs: number;
}
