// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { TelecommunicationsRecord } from './types.js';

export interface TelecomCsvRow {
  provider: string;
  serviceType: string;
  revenue: number | null;
  subscribers: number | null;
  year: number;
}

export function parseCrtcCsv(csvText: string): TelecomCsvRow[] {
  const rows: TelecomCsvRow[] = [];
  const lines = csvText.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length < 2) return rows;

  for (let i = 1; i < lines.length; i++) {
    try {
      const cols = lines[i].split(',');
      if (cols.length < 5) continue;
      rows.push({
        provider: cols[0].trim(),
        serviceType: cols[1].trim(),
        revenue: parseFloat(cols[2]) || null,
        subscribers: parseInt(cols[3]) || null,
        year: parseInt(cols[4]) || 0,
      });
    } catch {
      continue;
    }
  }
  return rows;
}

export async function telecomCsvToRecord(
  row: TelecomCsvRow,
  sourceSystem: string = 'crtc',
): Promise<TelecommunicationsRecord | null> {
  if (!row.provider) return null;
  const content = JSON.stringify(row);
  return {
    id: await computeHash(content, 'sha256'),
    sourceSystem,
    recordType: 'telecom_market',
    title: `${row.provider} - ${row.serviceType} (${row.year})`,
    description: `Revenue: $${row.revenue}, Subscribers: ${row.subscribers}`,
    url: 'https://crtc.gc.ca/eng/open-data.htm',
    publishedAt: `${row.year}-01-01T00:00:00.000Z`,
    ingestedAt: new Date().toISOString(),
    provider: row.provider,
    serviceType: row.serviceType,
    revenue: row.revenue,
    subscribers: row.subscribers,
    year: row.year,
  };
}
