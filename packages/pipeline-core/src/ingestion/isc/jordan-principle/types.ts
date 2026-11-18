// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Isc Data Types — Quill
 *
 * Types for Jordan Principle Requests data ingestion.
 *
 * Sources:
 *   - https://open.canada.ca/data/en/dataset/jordan-principle
 */

export interface JordanPrincipleRequest {
  /** SHA-256 hash */
  id: string;
  /** Anonymized child identifier */
  childId: string;
  /** Service type requested */
  serviceType: string;
  /** Approved funding amount */
  fundingAmount: number | null;
  /** Request status (approved, pending, denied) */
  status: string;
  /** Decision date */
  decisionDate: string | null;
  /** ISO-8601 timestamp */
  ingestedAt: string;
}

export interface IscIngestionResult {
  dataset: 'jordan-principle';
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
