// SPDX-License-Identifier: AGPL-3.0-only

/**
 * UNESCO Institute for Statistics (UIS) API Types
 *
 * UNESCO UIS provides SDMX-JSON data via REST API covering education,
 * science, technology, culture, and communication statistics.
 * Phase 1 focuses on Education and R&D indicators for Canada.
 */

/**
 * Single UNESCO UIS observation record
 */
export interface UnescoRecord {
  /** Unique identifier for this record (SHA-256) */
  id: string;
  /** Dataset identifier (e.g., 'EDULIT_DS', 'SCN_DS') */
  datasetId: string;
  /** Dataset human-readable name */
  datasetName: string;
  /** Country/territory code (ISO-3, e.g., CAN) */
  country: string;
  /** Indicator code */
  indicatorCode: string;
  /** Indicator human-readable name */
  indicatorName: string;
  /** Year of observation */
  year: number;
  /** Numeric value */
  value: number;
  /** Unit of measurement */
  unit: string;
  /** SDMX observation status (e.g., A=Official, E=Estimated) */
  obsStatus?: string;
}

/**
 * UNESCO UIS dataset metadata
 */
export interface UnescoDataset {
  /** Dataset code */
  id: string;
  /** Dataset name */
  name: string;
  /** Description */
  description?: string;
  /** Update frequency */
  updateFrequency: string;
  /** URL template for SDMX-JSON export */
  sdmxUrlTemplate: string;
}

/**
 * UNESCO UIS topic/subject area
 */
export interface UnescoTopic {
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
 * Ingestion result for UNESCO UIS data
 */
export interface UnescoIngestionResult {
  /** Number of datasets attempted */
  datasetsAttempted: number;
  /** Number of datasets successfully fetched */
  datasetsSucceeded: number;
  /** All records fetched */
  records: UnescoRecord[];
  /** Error messages per dataset */
  errors: Array<{ datasetId: string; error: string }>;
  /** Processing duration in milliseconds */
  durationMs: number;
}

/**
 * SDMX-JSON response structure from UNESCO UIS API
 */
export interface UnescoSdmxResponse {
  data?: {
    structures?: Array<{
      attributes?: {
        observation?: Array<{
          id: string;
          name: string;
          values?: Array<{ id: string; name: string }>;
        }>;
      };
    }>;
  };
  dataSets?: Array<{
    series?: Record<string, {
      observations?: Record<string, number[]>;
      attributes?: number[];
    }>;
  }>;
  structure?: {
    dimensions?: {
      series?: Array<{
        id: string;
        name: string;
        values?: Array<{ id: string; name: string }>;
      }>;
      observation?: Array<{
        id: string;
        name: string;
        values?: Array<{ id: string; name: string }>;
      }>;
    };
    attributes?: {
      observation?: Array<{
        id: string;
        name: string;
        values?: Array<{ id: string; name: string }>;
      }>;
      series?: Array<{
        id: string;
        name: string;
        values?: Array<{ id: string; name: string }>;
      }>;
    };
  };
}

/**
 * API error wrapper
 */
export class UnescoApiError extends Error {
  constructor(message: string, public datasetId?: string) {
    super(message);
    this.name = 'UnescoApiError';
  }
}
