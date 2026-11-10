// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Ircc Data Types — Quill
 *
 * Types for IRCC Work Permit Holders data ingestion.
 *
 * Sources:
 *   - https://open.canada.ca/data/en/dataset/work-permit-holders
 */

export interface WorkPermit {
  /** SHA-256 hash */
  id: string;
  /** National Occupation Classification (NOC) code */
  nocCode: string;
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
  dataset: 'work-permit-holders';
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
