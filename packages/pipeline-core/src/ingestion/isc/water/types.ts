/**
 * Isc Data Types — Quill
 *
 * Types for First Nations Water Infrastructure data ingestion.
 *
 * Sources:
 *   - https://open.canada.ca/data/en/dataset/first-nations-water-infrastructure
 */

export interface WaterInfrastructure {
  /** SHA-256 hash */
  id: string;
  /** First Nation community */
  community: string;
  /** Water system type (drinking, wastewater, both) */
  systemType: string;
  /** System status */
  status: string;
  /** Treatment type */
  treatmentType: string;
  /** Last inspection date */
  lastInspection: string | null;
  /** Water advisory type */
  advisoryType: string | null;
  /** ISO-8601 timestamp */
  ingestedAt: string;
}

export interface IscIngestionResult {
  dataset: 'first-nations-water-infrastructure';
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
