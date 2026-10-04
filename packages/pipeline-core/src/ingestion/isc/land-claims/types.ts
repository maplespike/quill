/**
 * Isc Data Types — Quill
 *
 * Types for Land Claims Agreements data ingestion.
 *
 * Sources:
 *   - https://open.canada.ca/data/en/dataset/land-claims
 */

export interface LandClaim {
  /** SHA-256 hash */
  id: string;
  /** Land claim agreement name */
  claimName: string;
  /** Signatory Indigenous group */
  aboriginalGroup: string;
  /** Province code */
  province: string;
  /** Agreement signing date */
  signingDate: string;
  /** Status (settled, in-negotiation, final-agreement) */
  status: string;
  /** ISO-8601 timestamp */
  ingestedAt: string;
}

export interface IscIngestionResult {
  dataset: 'land-claims';
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
