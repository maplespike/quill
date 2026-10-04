/**
 * Isc Parser — Quill
 *
 * Parse and normalize First Nations Water Infrastructure CSV data.
 */

import { computeHash } from '../../../verification/hashing.js';
import type { WaterInfrastructure } from './types.js';

export async function parseWaterInfrastructure(csv: string): Promise<WaterInfrastructure[]> {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const records: WaterInfrastructure[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const record: WaterInfrastructure = {
      id: await computeHash(lines[i]),
      community: (mapField(values, headers, 'community') || mapField(values, headers, 'Community')) ?? '',
      systemType: (mapField(values, headers, 'systemType') || mapField(values, headers, 'System Type')) ?? '',
      status: (mapField(values, headers, 'status') || mapField(values, headers, 'Status')) ?? '',
      treatmentType: (mapField(values, headers, 'treatmentType') || mapField(values, headers, 'Treatment Type')) ?? '',
      lastInspection: mapField(values, headers, 'lastInspection') || mapField(values, headers, 'Last Inspection'),
      advisoryType: mapField(values, headers, 'advisoryType') || mapField(values, headers, 'Advisory Type'),
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
