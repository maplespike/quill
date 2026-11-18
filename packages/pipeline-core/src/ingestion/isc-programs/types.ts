// SPDX-License-Identifier: AGPL-3.0-only
/**
 * ISC Data Types — Quill
 *
 * Types for Indigenous Services Canada community safety programs.
 */

export interface SafetyProgram {
  /** SHA-256 hash of the row content (primary key) */
  id: string;
  /** Program name or identifier */
  program: string;
  /** Indigenous community or First Nation name */
  community: string;
  /** Funding amount in dollars */
  funding: number | null;
  /** Program type (infrastructure, policing, prevention, etc.) */
  type: string;
  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

export interface IscIngestionResult {
  dataset: 'community-safety';
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}