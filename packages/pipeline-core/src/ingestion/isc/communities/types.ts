// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Isc Data Types — Quill
 *
 * Types for First Nations Communities Directory data ingestion.
 *
 * Sources:
 *   - https://open.canada.ca/data/en/dataset/first-nations-communities-directory
 */

export interface FirstNationCommunity {
  /** SHA-256 hash */
  id: string;
  /** Community or First Nation name */
  name: string;
  /** Province/territory (2-letter code) */
  province: string;
  /** Band number */
  bandNumber: string;
  /** Population */
  population: number | null;
  /** Tribal council affiliation */
  tribalCouncil: string;
  /** Available services */
  services: string;
  /** ISO-8601 timestamp */
  ingestedAt: string;
}

export interface IscIngestionResult {
  dataset: 'first-nations-communities';
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
