// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Nrcan Data Types — Quill
 *
 * Types for National Forest Inventory data ingestion.
 *
 * Sources:
 *   - https://open.canada.ca/data/en/dataset/national-forest-inventory
 */

export interface ForestInventory {
  /** SHA-256 hash */
  id: string;
  /** Terrestrial ecozone name */
  ecozone: string;
  /** Dominant tree species */
  species: string;
  /** Biomass in tonnes/ha */
  biomass: number | null;
  /** Carbon stock in tonnes/ha */
  carbon: number | null;
  /** Forest area in hectares */
  area: number | null;
  /** Inventory year */
  year: string;
  /** ISO-8601 timestamp */
  ingestedAt: string;
}

export interface NrcanIngestionResult {
  dataset: 'national-forest-inventory';
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
