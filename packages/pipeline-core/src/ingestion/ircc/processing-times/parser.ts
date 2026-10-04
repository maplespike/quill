/**
 * Ircc Parser — Quill
 *
 * Parse and normalize IRCC Application Processing Times CSV data.
 */

import { computeHash } from '../../../verification/hashing.js';
import type { ProcessingTime } from './types.js';

export async function parseProcessingTime(csv: string): Promise<ProcessingTime[]> {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const records: ProcessingTime[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const record: ProcessingTime = {
      id: await computeHash(lines[i]),
      visaOffice: (mapField(values, headers, 'visaOffice') || mapField(values, headers, 'Visa Office')) ?? '',
      applicationType: (mapField(values, headers, 'applicationType') || mapField(values, headers, 'Application Type')) ?? '',
      processingTime: (mapField(values, headers, 'processingTime') || mapField(values, headers, 'Processing Time')) ?? '',
      timeframe: (mapField(values, headers, 'timeframe') || mapField(values, headers, 'Timeframe')) ?? '',
      lastUpdated: (mapField(values, headers, 'lastUpdated') || mapField(values, headers, 'Last Updated')) ?? '',
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
