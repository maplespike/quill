/**
 * Ircc Data Types — Quill
 *
 * Types for IRCC Permanent Resident Admissions data ingestion.
 *
 * Sources:
 *   - https://open.canada.ca/data/en/dataset/permanent-resident-admissions
 */

export interface PermanentResidentAdmission {
  /** SHA-256 hash */
  id: string;
  /** Year of admission */
  year: string;
  /** Province/territory (2-letter code) */
  province: string;
  /** Admission category (economic, family, refugee, humanitarian) */
  category: string;
  /** Number of admissions */
  count: number | null;
  /** ISO-8601 timestamp */
  ingestedAt: string;
}

export interface IrccIngestionResult {
  dataset: 'permanent-resident-admissions';
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
