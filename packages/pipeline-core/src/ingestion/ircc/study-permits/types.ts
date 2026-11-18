// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Ircc Data Types — Quill
 *
 * Types for IRCC Study Permit Holders data ingestion.
 *
 * Sources:
 *   - https://open.canada.ca/data/en/dataset/study-permit-holders
 */

export interface StudyPermit {
  /** SHA-256 hash */
  id: string;
  /** Designated learning institution name */
  institution: string;
  /** Province/territory (2-letter code) */
  province: string;
  /** Country of citizenship */
  country: string;
  /** Year */
  year: string;
  /** Number of permit holders */
  count: number | null;
  /** ISO-8601 timestamp */
  ingestedAt: string;
}

export interface IrccIngestionResult {
  dataset: 'study-permit-holders';
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
