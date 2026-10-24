// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { PolicingSecurityRecord } from './types.js';

export interface RcmpCrimeRow {
  geo: string;
  violations: string;
  statistics: string;
  value: number | null;
  year: number;
}

export function parseRcmpCrimeCsv(csvText: string): RcmpCrimeRow[] {
  const rows: RcmpCrimeRow[] = [];
  const lines = csvText.split('\n').map(l => l.trim()).filter(l => l);

  if (lines.length < 2) return rows;

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    try {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < 6) continue;

      rows.push({
        geo: cols[0] || '',
        violations: cols[3] || '',
        statistics: cols[4] || '',
        value: parseFloat(cols[5]) || null,
        year: parseInt(cols[2]) || 0,
      });
    } catch {
      continue;
    }
  }

  return rows;
}

function parseCsvLine(line: string): string[] {
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
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export async function rcmpCrimeToRecord(
  row: RcmpCrimeRow,
  sourceSystem: string = 'rcmp-statcan',
): Promise<PolicingSecurityRecord | null> {
  if (!row.violations && !row.value) return null;

  const content = JSON.stringify({
    geo: row.geo,
    violations: row.violations,
    statistics: row.statistics,
    value: row.value,
    year: row.year,
    sourceSystem,
  });

  return {
    id: await computeHash(content, 'sha256'),
    sourceSystem,
    recordType: 'crime_stat',
    title: `${row.violations} - ${row.geo} (${row.year})`,
    description: `${row.statistics}: ${row.value ?? 'N/A'}`,
    url: `https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=35100178`,
    publishedAt: `${row.year}-01-01T00:00:00.000Z`,
    ingestedAt: new Date().toISOString(),
    geo: row.geo,
    violations: row.violations,
    statistics: row.statistics,
    value: row.value,
    year: row.year,
  };
}
