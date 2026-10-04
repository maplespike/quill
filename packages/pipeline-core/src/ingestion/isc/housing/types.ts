/**
 * Isc Data Types — Quill
 *
 * Types for Housing Programs data ingestion.
 *
 * Sources:
 *   - https://open.canada.ca/data/en/dataset/indigenous-housing
 */

export interface HousingProgram {
  /** SHA-256 hash */
  id: string;
  /** Housing program name */
  program: string;
  /** Community or First Nation */
  community: string;
  /** Number of housing units */
  units: number | null;
  /** Funding amount in CAD */
  funding: number | null;
  /** Fiscal year */
  fiscalYear: string;
  /** ISO-8601 timestamp */
  ingestedAt: string;
}

export interface IscIngestionResult {
  dataset: 'indigenous-housing';
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
