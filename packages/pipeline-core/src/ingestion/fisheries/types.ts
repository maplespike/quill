// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Fisheries Data Types — Quill
 *
 * Types for Canadian fisheries and oceans data from:
 *   - Fisheries & Oceans Canada (DFO)
 *   - Canadian Coast Guard
 *   - Marine protected areas
 *   - Aquaculture regulation
 */

export interface FisheriesRecord {
  id: string;
  year: number;
  category: string;
  subCategory: string;
  value: number;
  unit: string;
  description: string;
  region: string;
  species: string;
  sourceUrl: string;
  sourceName: string;
  ingestedAt: string;
}

export interface FisheriesIngestionResult {
  source: string;
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
