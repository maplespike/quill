// SPDX-License-Identifier: AGPL-3.0-or-later

import { computeHash } from '../../verification/hashing.js';
import type { RefugeeRecord } from './types.js';

const POPULATION_TYPE_MAP: Record<string, RefugeeRecord['populationType']> = {
  'Refugees (under UNHCR\'s mandate)': 'refugees',
  'Asylum-seekers': 'asylum-seekers',
  'IDPs': 'idps',
  'Stateless': 'stateless',
  'Others of concern': 'ooc',
  'Returnees': 'returnees',
};

export async function parsePopulationRecord(
  record: { iso3?: string; year?: number; population_type?: string; population_value?: number },
): Promise<RefugeeRecord | null> {
  if (!record.iso3 || record.population_value == null) return null;

  const populationType = POPULATION_TYPE_MAP[record.population_type ?? ''];
  if (!populationType) return null;

  return {
    id: await computeHash(`UNHCR:${record.iso3}:${record.year}:${populationType}`),
    countryCode: record.iso3,
    year: record.year ?? 0,
    populationType,
    value: record.population_value,
    source: 'UNHCR',
  };
}

export async function parsePopulationRecords(
  records: Array<{ iso3?: string; year?: number; population_type?: string; population_value?: number }>,
): Promise<RefugeeRecord[]> {
  const results: RefugeeRecord[] = [];
  for (const record of records) {
    const parsed = await parsePopulationRecord(record);
    if (parsed) results.push(parsed);
  }
  return results;
}
