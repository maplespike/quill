// SPDX-License-Identifier: AGPL-3.0-only
/**
 * ISC Parser — Quill
 *
 * Parse and normalize ISC community safety CSV data.
 */

import { computeHash } from '../../verification/hashing.js';
import type { SafetyProgram } from './types.js';

export async function parseSafetyPrograms(csv: string): Promise<SafetyProgram[]> {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const programs: SafetyProgram[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const program: SafetyProgram = {
      id: await computeHash(lines[i]),
      program: getValue(values, headers, 'program') || getValue(values, headers, 'Program Name') || 'Unknown',
      community: getValue(values, headers, 'community') || getValue(values, headers, 'Community') || '',
      funding: parseFunding(getValue(values, headers, 'funding') || getValue(values, headers, 'Funding Amount')),
      type: normalizeProgramType(getValue(values, headers, 'type') || getValue(values, headers, 'Program Type')),
      ingestedAt: new Date().toISOString(),
    };

    if (program.program && program.program !== 'Unknown') {
      programs.push(program);
    }
  }

  return programs;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

function getValue(values: string[], headers: string[], name: string): string | null {
  const index = headers.indexOf(name);
  return index >= 0 && index < values.length ? values[index] || null : null;
}

function parseFunding(value: string | null): number | null {
  if (!value) return null;
  const cleaned = value.trim().replace(/[$,]/g, '');
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

function normalizeProgramType(value: string | null): string {
  if (!value) return 'other';
  const normalized = value.trim().toLowerCase();
  const typeMap: Record<string, string> = {
    'infrastructure': 'infrastructure',
    'policing': 'policing',
    'prevention': 'prevention',
    'emergency response': 'emergency-response',
    'justice': 'justice',
  };
  return typeMap[normalized] || 'other';
}