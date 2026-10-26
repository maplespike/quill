// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { EmergencyManagementRecord } from './types.js';

export interface DisasterCsvRow {
  disasterType: string;
  location: string;
  eventDate: string | null;
  estimatedCost: number | null;
  fatalities: number | null;
}

export function parseDisasterDbCsv(csvText: string): DisasterCsvRow[] {
  const rows: DisasterCsvRow[] = [];
  const lines = csvText.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length < 2) return rows;

  for (let i = 1; i < lines.length; i++) {
    try {
      const cols = lines[i].split(',');
      if (cols.length < 5) continue;
      rows.push({
        disasterType: cols[0].trim(),
        location: cols[1].trim(),
        eventDate: cols[2].trim() || null,
        estimatedCost: parseFloat(cols[3]) || null,
        fatalities: parseInt(cols[4]) || null,
      });
    } catch {
      continue;
    }
  }
  return rows;
}

export async function disasterCsvToRecord(
  row: DisasterCsvRow,
  sourceSystem: string = 'disaster-db',
): Promise<EmergencyManagementRecord | null> {
  if (!row.disasterType) return null;
  const content = JSON.stringify(row);
  return {
    id: await computeHash(content, 'sha256'),
    sourceSystem,
    recordType: 'disaster_event',
    title: `${row.disasterType} - ${row.location}`,
    description: `Cost: $${row.estimatedCost}, Fatalities: ${row.fatalities}`,
    url: 'https://www.publicsafety.gc.ca/cnt/rsrcs/cndn-dsstr-dtbs/index-en.aspx',
    publishedAt: row.eventDate || new Date().toISOString(),
    ingestedAt: new Date().toISOString(),
    disasterType: row.disasterType,
    location: row.location,
    eventDate: row.eventDate,
    estimatedCost: row.estimatedCost,
    fatalities: row.fatalities,
  };
}
