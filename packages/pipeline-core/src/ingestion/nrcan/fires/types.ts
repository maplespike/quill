// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Nrcan Data Types — Quill
 *
 * Types for Forest Fire Data data ingestion.
 *
 * Sources:
 *   - https://open.canada.ca/data/en/dataset/forest-fire-data
 */

export interface ForestFire {
  /** SHA-256 hash */
  id: string;
  /** Fire location description */
  location: string;
  /** Province code */
  province: string;
  /** Fire year */
  year: string;
  /** Area burned in hectares */
  hectares: number | null;
  /** Fire cause (lightning, human, unknown) */
  cause: string;
  /** Latitude of fire origin */
  latitude: number | null;
  /** Longitude of fire origin */
  longitude: number | null;
  /** ISO-8601 timestamp */
  ingestedAt: string;
}

export interface NrcanIngestionResult {
  dataset: 'forest-fire-data';
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
