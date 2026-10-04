/**
 * Nrcan Data Types — Quill
 *
 * Types for Energy Statistics data ingestion.
 *
 * Sources:
 *   - https://open.canada.ca/data/en/dataset/energy-statistics
 */

export interface EnergyStat {
  /** SHA-256 hash */
  id: string;
  /** Energy source (crude-oil, natural-gas, hydro, nuclear, renewables) */
  source: string;
  /** Province code */
  province: string;
  /** Year */
  year: string;
  /** Statistic value */
  value: number | null;
  /** Unit (PJ, MW, GWh, etc.) */
  unit: string;
  /** ISO-8601 timestamp */
  ingestedAt: string;
}

export interface NrcanIngestionResult {
  dataset: 'energy-statistics';
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
