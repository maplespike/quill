// SPDX-License-Identifier: AGPL-3.0-only

/**
 * UNDP Human Development Reports API Types
 *
 * Types for UNDP HDR indicators including:
 * - HDI: Human Development Index
 * - IHDI: Inequality-adjusted Human Development Index
 * - GDI: Gender Development Index
 * - GII: Gender Inequality Index
 * - PHDI: Planetary pressures-adjusted Human Development Index
 * - MPI: Multidimensional Poverty Index
 *
 * API Docs: https://hdr.undp.org/data-center/documentation/
 * Data License: UNDP Human Development Report — free to use with attribution
 */

/* ------------------------------------------------------------------ */
/* Base Record Types */
/* ------------------------------------------------------------------ */

/** A single UNDP HDR indicator record. */
export interface UndpRecord {
  /** SHA-256 hash of the record content (primary key) */
  id: string;
  /** UNDP indicator code (e.g., "HDI", "IHDI", "GDI", "GII", "PHDI", "MPI") */
  indicatorCode: string;
  /** Human-readable indicator name */
  indicatorName: string;
  /** ISO-3 country code (e.g., "CAN", "USA") */
  countryCode: string;
  /** Country or area name */
  countryName: string;
  /** Year of the observation */
  year: number;
  /** The numeric indicator value */
  value: number | null;
  /** Rank of the country for this indicator in the given year */
  rank: number | null;
  /** Number of countries ranked in this indicator for this year */
  rankCount: number | null;
  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
  /** Source URL for provenance */
  sourceUrl: string;
}

/* ------------------------------------------------------------------ */
/* Ingestion Result */
/* ------------------------------------------------------------------ */

/** Result of ingesting a single UNDP HDR indicator. */
export interface UndpIngestionResult {
  /** Indicator code (e.g., "HDI") */
  indicatorCode: string;
  /** Human-readable indicator name */
  indicatorName: string;
  /** Number of records found in the API response */
  recordsFound: number;
  /** Number of records successfully ingested */
  recordsIngested: number;
  /** Any errors encountered during ingestion */
  errors: string[];
  /** Time taken to ingest in milliseconds */
  durationMs: number;
}

/** Result of ingesting all UNDP HDR indicators. */
export interface UndpAllIndicatorsResult {
  /** Individual results for each indicator */
  results: UndpIngestionResult[];
  /** Total records across all indicators */
  totalRecords: number;
  /** Total errors across all indicators */
  totalErrors: number;
  /** Total time taken in milliseconds */
  durationMs: number;
}

/* ------------------------------------------------------------------ */
/* Indicator Metadata */
/* ------------------------------------------------------------------ */

/** Metadata for a UNDP HDR indicator. */
export interface UndpIndicator {
  /** Indicator code (e.g., "HDI", "IHDI") */
  code: string;
  /** Human-readable indicator name */
  name: string;
  /** Description of the indicator */
  description: string;
  /** Unit of measurement (if applicable) */
  unit: string | null;
}

/* ------------------------------------------------------------------ */
/* API Response Types */
/* ------------------------------------------------------------------ */

/** Raw UNDP API response structure (may vary based on actual API). */
export interface UndpApiResponse {
  /** Data rows from the API */
  data: UndpApiRow[];
  /** Metadata about the response */
  metadata?: {
    /** Total number of records */
    total?: number;
    /** Page number (if paginated) */
    page?: number;
    /** Records per page */
    perPage?: number;
  };
}

/** A single row from the UNDP API response. */
export interface UndpApiRow {
  /** ISO-3 country code */
  country_code?: string;
  /** Country name */
  country_name?: string;
  /** Year */
  year?: number | string;
  /** Indicator value */
  value?: number | string | null;
  /** Rank */
  rank?: number | string | null;
  /** Number of countries ranked */
  rank_count?: number | string | null;
}