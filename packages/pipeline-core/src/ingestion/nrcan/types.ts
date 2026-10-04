/**
 * NRCan Data Types — Quill
 *
 * Types for Natural Resources Canada mining and topographic data.
 *
 * Sources:
 *   - Mining Activities: https://open.canada.ca/data/en/dataset/mining-activities
 *   - Topographic Maps: https://open.canada.ca/data/en/dataset/topographic-maps
 */

export interface MiningActivity {
  /** SHA-256 hash of the row content (primary key) */
  id: string;

  /** Project name or identifier */
  project: string;

  /** Province/territory where the project is located (2-letter code) */
  province: string;

  /** Project stage (exploration, development, production, closure) */
  stage: string;

  /** Primary commodity/mineral (gold, copper, iron ore, etc.) */
  commodity: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

export interface TopographicMap {
  /** SHA-256 hash of the row content (primary key) */
  id: string;

  /** National Topographic System (NTS) number */
  ntsNumber: string;

  /** Map scale (1:50000, 1:250000, etc.) */
  scale: string;

  /** Map edition number */
  edition: string;

  /** Year of the edition */
  year: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

export interface NrcanIngestionResult {
  dataset: 'mining-activities' | 'topographic-maps';
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}