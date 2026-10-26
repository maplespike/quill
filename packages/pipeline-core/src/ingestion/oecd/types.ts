// SPDX-License-Identifier: AGPL-3.0-only

/**
 * OECD Data Explorer API Types
 *
 * OECD Data Explorer provides CSV-format SDMX data via REST API.
 * Phase 1 focuses on National Accounts (NAAG) and Health Statistics.
 */

/**
 * Single OECD observation record
 */
export interface OecdRecord {
  /** Unique identifier for this record */
  id: string;
  /** Dataset identifier (e.g., 'NAAG', 'HEALTH') */
  datasetId: string;
  /** Dataset human-readable name */
  datasetName: string;
  /** Country/territory code */
  country: string;
  /** Topic/category within dataset */
  topic: string;
  /** Indicator/metric code */
  indicatorCode: string;
  /** Indicator/metric name */
  indicatorName: string;
  /** Year of observation */
  year: number;
  /** Numeric value */
  value: number;
  /** Unit of measurement */
  unit: string;
  /** Additional dimension filters */
  dimensions?: Record<string, string>;
}

/**
 * OECD topic/subject area
 */
export interface OecdTopic {
  /** Topic code */
  code: string;
  /** Topic name */
  name: string;
  /** Dataset IDs covered by this topic */
  datasets: string[];
  /** Description */
  description?: string;
}

/**
 * OECD dataset metadata
 */
export interface OecdDataset {
  /** Dataset code */
  id: string;
  /** Dataset name */
  name: string;
  /** Description */
  description?: string;
  /** Update frequency */
  updateFrequency: string;
  /** URL template for CSV export */
  csvUrlTemplate: string;
}

/**
 * Ingestion result for OECD data
 */
export interface OecdIngestionResult {
  /** Number of datasets attempted */
  datasetsAttempted: number;
  /** Number of datasets successfully fetched */
  datasetsSucceeded: number;
  /** All records fetched */
  records: OecdRecord[];
  /** Error messages per dataset */
  errors: Array<{ datasetId: string; error: string }>;
  /** Processing duration in milliseconds */
  durationMs: number;
}

/**
 * CSV row from OECD Data Explorer export
 */
export interface OecdCsvRow {
  /** Country/territory code */
  'Country Code': string;
  /** Country/territory name */
  'Country': string;
  /** Indicator code */
  'Indicator Code': string;
  /** Indicator name */
  'Indicator Name': string;
  /** Year */
  Year: string;
  /** Value */
  Value: string;
  /** Unit */
  'Unit': string;
  /** Additional dimension columns */
  [key: string]: string;
}

/**
 * API error wrapper
 */
export class OecdApiError extends Error {
  constructor(message: string, public datasetId?: string) {
    super(message);
    this.name = 'OecdApiError';
  }
}