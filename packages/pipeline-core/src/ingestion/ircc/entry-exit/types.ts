// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Ircc Data Types — Quill
 *
 * Types for IRCC Quarterly Entry/Exit Data data ingestion.
 *
 * Sources:
 *   - https://open.canada.ca/data/en/dataset/ircc-quarterly-entry-exit
 */

export interface EntryExit {
  /** SHA-256 hash */
  id: string;
  /** Port of entry or border crossing */
  borderCrossing: string;
  /** Mode of travel (air, land, sea) */
  modeOfTravel: string;
  /** Traveler nationality/country of citizenship */
  nationality: string;
  /** Number of entries */
  entries: number | null;
  /** Number of exits */
  exits: number | null;
  /** Quarter (e.g. '2024-Q1') */
  quarter: string;
  /** ISO-8601 timestamp */
  ingestedAt: string;
}

export interface IrccIngestionResult {
  dataset: 'ircc-quarterly-entry-exit';
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
