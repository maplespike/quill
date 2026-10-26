// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { FireIncident, ResponseTime, Station } from './types.js';

export async function parseFireRecord(
  raw: Record<string, unknown>,
  city: string,
  province: string,
): Promise<FireIncident | null> {
  const date = raw.date ?? raw.incident_date ?? raw.calendar_date;
  const incidentType = raw.type ?? raw.incident_type ?? raw.nature ?? '';
  if (!date || !incidentType) return null;

  return {
    id: await computeHash(`${city}:${String(date)}:${String(incidentType)}`),
    city,
    province,
    date: new Date(String(date)),
    incidentType: String(incidentType),
    address: raw.address ? String(raw.address) : undefined,
    description: raw.description ? String(raw.description) : undefined,
  };
}

export async function parseFireRecords(
  rawRecords: Record<string, unknown>[],
  city: string,
  province: string,
): Promise<FireIncident[]> {
  const results: FireIncident[] = [];
  for (const raw of rawRecords) {
    const parsed = await parseFireRecord(raw, city, province);
    if (parsed) results.push(parsed);
  }
  return results;
}

export { FIRE_DEPARTMENTS } from './constants.js';
