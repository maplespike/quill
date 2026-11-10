// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Nrcan Parser — Quill
 *
 * Parse and normalize National Forest Inventory CSV data.
 */

import { computeHash } from '../../../verification/hashing.js';
import type { ForestInventory } from './types.js';

export async function parseForestInventory(csv: string): Promise<ForestInventory[]> {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const records: ForestInventory[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const record: ForestInventory = {
      id: await computeHash(lines[i]),
      ecozone: (mapField(values, headers, 'ecozone') || mapField(values, headers, 'Ecozone')) ?? '',
      species: (mapField(values, headers, 'species') || mapField(values, headers, 'Species')) ?? '',
      biomass: parseNumeric(mapField(values, headers, 'biomass') || mapField(values, headers, 'Biomass')),
      carbon: parseNumeric(mapField(values, headers, 'carbon') || mapField(values, headers, 'Carbon')),
      area: parseNumeric(mapField(values, headers, 'area') || mapField(values, headers, 'Area')),
      year: (mapField(values, headers, 'year') || mapField(values, headers, 'Year')) ?? '',
      ingestedAt: new Date().toISOString(),
    };

    records.push(record);
  }

  return records;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else { current += char; }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

function mapField(values: string[], headers: string[], name: string): string | null {
  const index = headers.indexOf(name);
  return index >= 0 && index < values.length ? values[index] || null : null;
}

function parseNumeric(value: string | null): number | null {
  if (!value) return null;
  const cleaned = value.trim().replace(/[$,]/g, '');
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}
