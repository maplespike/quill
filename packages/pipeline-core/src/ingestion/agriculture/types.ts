// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Agriculture Data Types — Quill
 *
 * Types for Canadian agriculture and agri-food data from:
 *   - Agriculture & Agri-Food Canada (AAFC)
 *   - Canadian Dairy Commission / Poultry
 *   - CFIA (Canadian Food Inspection Agency)
 *   - Canadian Grain Commission
 *   - Farm Credit Canada
 */

export interface AgricultureRecord {
  id: string;
  year: number;
  category: string;
  subCategory: string;
  value: number;
  unit: string;
  description: string;
  region: string;
  commodity: string;
  sourceUrl: string;
  sourceName: string;
  ingestedAt: string;
}

export interface AgricultureIngestionResult {
  source: string;
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
