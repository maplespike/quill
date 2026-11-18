// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Nrcan Data Types — Quill
 *
 * Types for Mineral Production data ingestion.
 *
 * Sources:
 *   - https://open.canada.ca/data/en/dataset/mineral-production
 */

export interface MineralProduction {
  /** SHA-256 hash */
  id: string;
  /** Mineral commodity (gold, copper, nickel, etc.) */
  commodity: string;
  /** Province code */
  province: string;
  /** Year */
  year: string;
  /** Production volume in tonnes */
  tonnes: number | null;
  /** Production value in CAD */
  value: number | null;
  /** ISO-8601 timestamp */
  ingestedAt: string;
}

export interface NrcanIngestionResult {
  dataset: 'mineral-production';
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
