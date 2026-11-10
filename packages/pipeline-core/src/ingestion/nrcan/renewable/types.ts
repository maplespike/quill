// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Nrcan Data Types — Quill
 *
 * Types for Renewable Energy Capacity data ingestion.
 *
 * Sources:
 *   - https://open.canada.ca/data/en/dataset/renewable-energy
 */

export interface RenewableCapacity {
  /** SHA-256 hash */
  id: string;
  /** Energy type (hydro, wind, solar, biomass, geothermal, tidal) */
  type: string;
  /** Province code (2-letter) */
  province: string;
  /** Installed capacity in MW */
  capacityMW: number | null;
  /** Annual generation in GWh */
  generationGWh: number | null;
  /** Year of data */
  year: string;
  /** ISO-8601 timestamp */
  ingestedAt: string;
}

export interface NrcanIngestionResult {
  dataset: 'renewable-energy';
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
