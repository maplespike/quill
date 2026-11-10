// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Isc Data Types — Quill
 *
 * Types for Indigenous Education Funding data ingestion.
 *
 * Sources:
 *   - https://open.canada.ca/data/en/dataset/indigenous-education-funding
 */

export interface EducationFunding {
  /** SHA-256 hash */
  id: string;
  /** School or institution */
  school: string;
  /** Province code */
  province: string;
  /** Funding amount in CAD */
  amount: number | null;
  /** Number of students */
  studentCount: number | null;
  /** Fiscal year */
  fiscalYear: string;
  /** ISO-8601 timestamp */
  ingestedAt: string;
}

export interface IscIngestionResult {
  dataset: 'indigenous-education-funding';
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
