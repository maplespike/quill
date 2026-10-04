/**
 * Isc Data Types — Quill
 *
 * Types for Indigenous Health Funding data ingestion.
 *
 * Sources:
 *   - https://open.canada.ca/data/en/dataset/indigenous-health-funding
 */

export interface IndigenousHealthFunding {
  /** SHA-256 hash */
  id: string;
  /** Health program name */
  program: string;
  /** Community or First Nation */
  community: string;
  /** Funding amount in CAD */
  amount: number | null;
  /** Fiscal year */
  fiscalYear: string;
  /** ISO-8601 timestamp */
  ingestedAt: string;
}

export interface IscIngestionResult {
  dataset: 'indigenous-health-funding';
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
