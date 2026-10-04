/**
 * Ircc Parser — Quill
 *
 * Parse and normalize IRCC Express Entry Rounds CSV data.
 */

import { computeHash } from '../../../verification/hashing.js';
import type { ExpressEntryRound } from './types.js';

export async function parseExpressEntryRound(csv: string): Promise<ExpressEntryRound[]> {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const records: ExpressEntryRound[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const record: ExpressEntryRound = {
      id: await computeHash(lines[i]),
      roundNumber: parseNumeric(mapField(values, headers, 'roundNumber') || mapField(values, headers, 'Round Number')),
      date: (mapField(values, headers, 'date') || mapField(values, headers, 'Date')) ?? '',
      program: (mapField(values, headers, 'program') || mapField(values, headers, 'Program')) ?? '',
      crsCutoff: parseNumeric(mapField(values, headers, 'crsCutoff') || mapField(values, headers, 'Crs Cutoff')),
      invitationsSent: parseNumeric(mapField(values, headers, 'invitationsSent') || mapField(values, headers, 'Invitations Sent')),
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
