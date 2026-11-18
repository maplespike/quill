// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Ircc Parser — Quill
 *
 * Parse and normalize IRCC Quarterly Entry/Exit Data CSV data.
 */

import { computeHash } from '../../../verification/hashing.js';
import type { EntryExit } from './types.js';

export async function parseEntryExit(csv: string): Promise<EntryExit[]> {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const records: EntryExit[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const record: EntryExit = {
      id: await computeHash(lines[i]),
      borderCrossing: (mapField(values, headers, 'borderCrossing') || mapField(values, headers, 'Border Crossing')) ?? '',
      modeOfTravel: (mapField(values, headers, 'modeOfTravel') || mapField(values, headers, 'Mode Of Travel')) ?? '',
      nationality: (mapField(values, headers, 'nationality') || mapField(values, headers, 'Nationality')) ?? '',
      entries: parseNumeric(mapField(values, headers, 'entries') || mapField(values, headers, 'Entries')),
      exits: parseNumeric(mapField(values, headers, 'exits') || mapField(values, headers, 'Exits')),
      quarter: (mapField(values, headers, 'quarter') || mapField(values, headers, 'Quarter')) ?? '',
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
