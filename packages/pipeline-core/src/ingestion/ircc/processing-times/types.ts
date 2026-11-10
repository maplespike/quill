// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Ircc Data Types — Quill
 *
 * Types for IRCC Application Processing Times data ingestion.
 *
 * Sources:
 *   - https://open.canada.ca/data/en/dataset/immigration-refugees-and-citizenship-canada-processing-times
 */

export interface ProcessingTime {
  /** SHA-256 hash */
  id: string;
  /** Visa office or processing centre */
  visaOffice: string;
  /** Type of application (visitor, study, work, PR) */
  applicationType: string;
  /** Processing time (e.g. '4 weeks', '12 months') */
  processingTime: string;
  /** Timeframe description */
  timeframe: string;
  /** Date last updated */
  lastUpdated: string;
  /** ISO-8601 timestamp */
  ingestedAt: string;
}

export interface IrccIngestionResult {
  dataset: 'ircc-processing-times';
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
