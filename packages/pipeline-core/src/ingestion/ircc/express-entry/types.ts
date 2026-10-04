/**
 * Ircc Data Types — Quill
 *
 * Types for IRCC Express Entry Rounds data ingestion.
 *
 * Sources:
 *   - https://open.canada.ca/data/en/dataset/express-entry
 */

export interface ExpressEntryRound {
  /** SHA-256 hash */
  id: string;
  /** Round number */
  roundNumber: number | null;
  /** Round date */
  date: string;
  /** Program (CEC, FSW, FST, PNP) */
  program: string;
  /** CRS score cutoff */
  crsCutoff: number | null;
  /** Number of invitations issued */
  invitationsSent: number | null;
  /** ISO-8601 timestamp */
  ingestedAt: string;
}

export interface IrccIngestionResult {
  dataset: 'express-entry-rounds';
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
