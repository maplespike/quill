// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Defence Data Parsers
 *
 * Parses CSV data from National Defence datasets into typed structures.
 */

import type { DndPersonnelRecord, DndProcurementRecord } from './types.js';

/**
 * Parse personnel record from CSV row
 */
export function toPersonnelRecord(headers: string[], cols: string[]): DndPersonnelRecord | null {
  if (cols.length < 3) return null;

  const h = headers.map((c) => c.toLowerCase());
  const yi = h.indexOf('year');
  const mi = h.indexOf('month');
  const ri = h.indexOf('rank') >= 0 ? h.indexOf('rank') : h.indexOf('classification');
  const ci = h.indexOf('component') >= 0 ? h.indexOf('component') : -1;
  const gi = h.indexOf('gender') >= 0 ? h.indexOf('gender') : -1;
  const vi = h.findIndex((x) => x.includes('count') || x.includes('number') || x.includes('value') || x === 'v');

  const val = parseFloat(cols[vi] || '0');
  if (isNaN(val) || val <= 0) return null;

  return {
    year: parseInt(cols[yi] || '0') || 0,
    month: parseInt(cols[mi] || '0') || 0,
    rank: cols[ri] || '',
    component: ci >= 0 ? cols[ci] : 'Regular Force',
    gender: gi >= 0 ? cols[gi] : undefined,
    count: val,
  };
}

/**
 * Parse personnel records from CSV text
 */
export function parsePersonnelRecords(csvText: string): DndPersonnelRecord[] {
  const lines = csvText.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((c) => c.trim());
  const results: DndPersonnelRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const record = toPersonnelRecord(headers, cols);
    if (record) results.push(record);
  }

  return results;
}

/**
 * Parse procurement record from CSV row
 */
export function toProcurementRecord(headers: string[], cols: string[]): DndProcurementRecord | null {
  if (cols.length < 3) return null;

  const h = headers.map((c) => c.toLowerCase());
  const yi = h.indexOf('year') >= 0 ? h.indexOf('year') : 0;
  const vi = h.findIndex((x) => x.includes('vendor') || x.includes('contract'));
  const di = h.findIndex((x) => x.includes('description') || x.includes('subject'));
  const vli = h.findIndex((x) => x.includes('value') || x.includes('amount') || x.includes('contract'));

  const val = parseFloat(cols[vli]?.replace(/[$,]/g, '') || '0');
  if (isNaN(val)) return null;

  return {
    year: parseInt(cols[yi] || '0') || 0,
    vendor: cols[vi] || '',
    description: cols[di] || '',
    value: val,
  };
}

/**
 * Parse procurement records from CSV text
 */
export function parseProcurementRecords(csvText: string): DndProcurementRecord[] {
  const lines = csvText.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((c) => c.trim());
  const results: DndProcurementRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const record = toProcurementRecord(headers, cols);
    if (record) results.push(record);
  }

  return results;
}