/**
 * Ircc Parser — Quill
 *
 * Parse and normalize IRCC Work Permit Holders CSV data.
 */

import { computeHash } from '../../../verification/hashing.js';
import type { WorkPermit } from './types.js';

export async function parseWorkPermit(csv: string): Promise<WorkPermit[]> {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const records: WorkPermit[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const record: WorkPermit = {
      id: await computeHash(lines[i]),
      nocCode: (mapField(values, headers, 'nocCode') || mapField(values, headers, 'Noc Code')) ?? '',
      province: (mapField(values, headers, 'province') || mapField(values, headers, 'Province')) ?? '',
      country: (mapField(values, headers, 'country') || mapField(values, headers, 'Country')) ?? '',
      year: (mapField(values, headers, 'year') || mapField(values, headers, 'Year')) ?? '',
      count: parseNumeric(mapField(values, headers, 'count') || mapField(values, headers, 'Count')),
      ingestedAt: new Date().toISOString(),
    };

    records.push(record);
  }
  return records;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []; let current = ''; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; } }
    else if (char === ',' && !inQuotes) { result.push(current.trim().replace(/^"|"$/g, '')); current = ''; }
    else { current += char; }
  }
  result.push(current.trim().replace(/^"|"$/g, '')); return result;
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
