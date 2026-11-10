// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Nrcan Parser — Quill
 *
 * Parse and normalize Mineral Production CSV data.
 */

import { computeHash } from '../../../verification/hashing.js';
import type { MineralProduction } from './types.js';

export async function parseMineralProduction(csv: string): Promise<MineralProduction[]> {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const records: MineralProduction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const record: MineralProduction = {
      id: await computeHash(lines[i]),
      commodity: (mapField(values, headers, 'commodity') || mapField(values, headers, 'Commodity')) ?? '',
      province: (mapField(values, headers, 'province') || mapField(values, headers, 'Province')) ?? '',
      year: (mapField(values, headers, 'year') || mapField(values, headers, 'Year')) ?? '',
      tonnes: parseNumeric(mapField(values, headers, 'tonnes') || mapField(values, headers, 'Tonnes')),
      value: parseNumeric(mapField(values, headers, 'value') || mapField(values, headers, 'Value')),
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
