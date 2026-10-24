// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { FisheriesRecord } from './types.js';

/**
 * Extract string value from row by key aliases
 */
export function extractString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const val = row[key];
    if (val !== undefined && val !== null && val !== '') return String(val);
    for (const [k, v] of Object.entries(row)) {
      if (k.toLowerCase() === key.toLowerCase() && v !== undefined && v !== null && v !== '') return String(v);
    }
  }
  return '';
}

/**
 * Extract year from row
 */
export function extractYear(row: Record<string, unknown>): number {
  const val = extractString(row, ['year', 'ref_year', 'reference_year', 'fiscal_year', 'season', 'date', 'period']);
  if (!val) return new Date().getFullYear();
  const parsed = parseInt(val, 10);
  if (!isNaN(parsed) && parsed > 1900 && parsed < 2100) return parsed;
  const matches = val.match(/\b(19|20)\d{2}\b/);
  if (matches) return parseInt(matches[0], 10);
  return new Date().getFullYear();
}

/**
 * Extract numeric value from row by key sets
 */
export function extractNumeric(row: Record<string, unknown>, ...keySets: string[][]): number {
  for (const keys of keySets) {
    for (const key of keys) {
      const val = row[key];
      if (val !== undefined && val !== null && val !== '') {
        const parsed = typeof val === 'number' ? val : parseFloat(String(val).replace(/[$,]/g, ''));
        if (!isNaN(parsed)) return parsed;
      }
      for (const [k, v] of Object.entries(row)) {
        if (k.toLowerCase() === key.toLowerCase() && v !== undefined && v !== null && v !== '') {
          const parsed = typeof v === 'number' ? v : parseFloat(String(v).replace(/[$,]/g, ''));
          if (!isNaN(parsed)) return parsed;
        }
      }
    }
  }
  return 0;
}

/**
 * Create FisheriesRecord from row with metadata
 */
export async function toFisheriesRecord(
  row: Record<string, unknown>,
  metadata: {
    datasetId?: string;
    packageId?: string;
    sourceName: string;
    sourceUrl: string;
    title?: string;
  },
): Promise<FisheriesRecord> {
  const now = new Date().toISOString();
  const year = extractYear(row);
  const value = extractNumeric(row, ['value', 'catch', 'landings', 'production', 'volume', 'amount']);
  const category = extractString(row, ['category', 'type', 'fishery_type', 'sector']) || metadata.sourceName;
  const subCategory = extractString(row, ['sub_category', 'subcategory', 'gear_type', 'method']) || '';
  const description = extractString(row, ['description', 'notes', 'title', 'name']) || metadata.title || '';
  const region = extractString(row, ['region', 'province', 'area', 'location', 'zone', 'fishing_area']) || 'Canada';
  const species = extractString(row, ['species', 'species_name', 'species_en', 'common_name', 'stock']) || '';
  const unit = extractString(row, ['unit', 'units', 'uom', 'measure']) || 'kg';

  const hashInput = metadata.datasetId
    ? JSON.stringify({ datasetId: metadata.datasetId, sourceName: metadata.sourceName, year, category, value, region, species })
    : JSON.stringify({ source: metadata.sourceName, package: metadata.packageId, row });
  const id = await computeHash(hashInput, 'sha256');

  return {
    id,
    year,
    category,
    subCategory,
    value,
    unit,
    description,
    region,
    species,
    sourceUrl: metadata.sourceUrl,
    sourceName: metadata.sourceName,
    ingestedAt: now,
  };
}

/**
 * Parse rows into FisheriesRecord array
 */
export async function parseFisheriesRecords(
  rows: Record<string, unknown>[],
  metadata: {
    datasetId?: string;
    packageId?: string;
    sourceName: string;
    sourceUrl: string;
    title?: string;
  },
  maxRecords: number,
): Promise<FisheriesRecord[]> {
  const records: FisheriesRecord[] = [];

  for (const row of rows) {
    if (records.length >= maxRecords) break;
    const record = await toFisheriesRecord(row, metadata);
    records.push(record);
  }

  return records;
}