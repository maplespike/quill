/**
 * IRCC Data Types — Quill
 *
 * Types for Immigration, Refugees and Citizenship Canada family sponsorship applications.
 */

export interface FamilySponsorship {
  /** SHA-256 hash of the row content (primary key) */
  id: string;
  /** Sponsor category (spousal, parent, grandparent, etc.) */
  sponsorCategory: string;
  /** Province/territory (2-letter code) */
  province: string;
  /** Processing time in months */
  processingTime: number | null;
  /** Year of the data */
  year: string;
  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

export interface IrccIngestionResult {
  dataset: 'family-sponsorship';
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}