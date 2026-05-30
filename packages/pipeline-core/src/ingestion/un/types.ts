// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * UN SDMX REST API Record
 */
export interface UnRecord {
  /** Unique identifier for this record */
  id: string;
  /** Database code (e.g., 'UNCTAD', 'WHO', 'UNESCO') */
  database: string;
  /** Database name */
  databaseName: string;
  /** Dataset code within database */
  dataset: string;
  /** Dataset description */
  datasetDescription: string;
  /** Data dimensions (key-value pairs) */
  dimensions: Record<string, string>;
  /** Year of observation */
  year: number;
  /** Indicator/metric value */
  value: number;
  /** Unit of measurement */
  unit: string;
  /** Country/territory code */
  country: string;
  /** Country/territory name */
  countryName: string;
  /** Time period */
  timePeriod: string;
  /** Observation status (A = actual, E = estimated, P = projected) */
  observationStatus: 'A' | 'E' | 'P';
  /** Data quality flags */
  qualityFlags: string[];
  /** Confidence level */
  confidence: number;
  /** Source URL for verification */
  sourceUrl: string;
  /** Original SDMX data structure ID */
  dataflow: string;
  /** Ingestion timestamp */
  ingestedAt: string;
}

/**
 * Ingestion result for UN data
 */
export interface UnIngestionResult {
  database: string;
  dataset: string;
  records: UnRecord[];
  recordsFetched: number;
  errors: string[];
  durationMs: number;
}

/**
 * SDMX API response wrapper
 */
export class UnApiError extends Error {
  constructor(message: string, public database?: string, public dataset?: string) {
    super(message);
    this.name = 'UnApiError';
  }
}

/**
 * Filter options for data queries
 */
export interface UnFilterOptions {
  database: string;
  dataset: string;
  country?: string | string[];
  year?: number | number[];
  yearStart?: number;
  yearEnd?: number;
  indicator?: string;
  format?: 'json' | 'xml' | 'csv';
  dimensionFilters?: Record<string, string>;
  maxRecords?: number;
}