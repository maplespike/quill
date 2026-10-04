/**
 * Ircc Data Types — Quill
 *
 * Types for IRCC Citizenship Grants data ingestion.
 *
 * Sources:
 *   - https://open.canada.ca/data/en/dataset/citizenship-grants
 */

export interface CitizenshipGrant {
  /** SHA-256 hash */
  id: string;
  /** Year */
  year: string;
  /** Province/territory (2-letter code) */
  province: string;
  /** Demographic group */
  demographic: string;
  /** Number of citizenship grants */
  count: number | null;
  /** ISO-8601 timestamp */
  ingestedAt: string;
}

export interface IrccIngestionResult {
  dataset: 'citizenship-grants';
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
