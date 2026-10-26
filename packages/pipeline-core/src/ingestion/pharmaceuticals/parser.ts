// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { PharmaceuticalsRecord } from './types.js';

export interface DrugShortageRow {
  drugName: string;
  manufacturer: string;
  shortageDate: string | null;
  shortageReason: string;
  status: string;
}

export function parseDrugShortageJson(jsonData: string): DrugShortageRow[] {
  try {
    const parsed = JSON.parse(jsonData);
    const reports = parsed.data || parsed.reports || [];
    return reports.map((r: Record<string, unknown>) => ({
      drugName: String(r.drug_name || r.name || ''),
      manufacturer: String(r.manufacturer_company || r.company || ''),
      shortageDate: String(r.shortage_date || r.reported_date || null),
      shortageReason: String(r.reason || r.shortage_reason || ''),
      status: String(r.status || 'unknown'),
    }));
  } catch {
    return [];
  }
}

export async function drugShortageToRecord(
  row: DrugShortageRow,
  sourceSystem: string = 'drug-shortages',
): Promise<PharmaceuticalsRecord | null> {
  if (!row.drugName) return null;
  const content = JSON.stringify(row);
  return {
    id: await computeHash(content, 'sha256'),
    sourceSystem,
    recordType: 'drug_shortage',
    title: `${row.drugName} - ${row.manufacturer}`,
    description: `Shortage: ${row.shortageReason} (${row.status})`,
    url: 'https://www.drugshortagescanada.ca',
    publishedAt: row.shortageDate || new Date().toISOString(),
    ingestedAt: new Date().toISOString(),
    drugName: row.drugName,
    manufacturer: row.manufacturer,
    shortageDate: row.shortageDate,
    shortageReason: row.shortageReason,
    status: row.status,
  };
}
