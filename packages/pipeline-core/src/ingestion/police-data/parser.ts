// SPDX-License-Identifier: AGPL-3.0-or-later

import { computeHash } from '../../verification/hashing.js';
import type { CrimeStatistics, IncidentReport } from './types.js';

export async function parseCrimeRecord(
  raw: Record<string, unknown>,
  city: string,
  province: string,
): Promise<CrimeStatistics | null> {
  const crimeType = raw.type ?? raw.crime_type ?? raw.offence ?? raw.category;
  const year = raw.year ?? raw.report_year;
  const count = raw.count ?? raw.incident_count ?? raw.total;
  if (!crimeType || !year) return null;

  return {
    id: await computeHash(`${city}:${String(year)}:${String(crimeType)}`),
    city,
    province,
    year: parseInt(String(year), 10),
    crimeType: String(crimeType),
    count: parseInt(String(count ?? 0), 10),
    ratePer100k: raw.rate ? parseFloat(String(raw.rate)) : 0,
  };
}

export async function parseCrimeRecords(
  rawRecords: Record<string, unknown>[],
  city: string,
  province: string,
): Promise<CrimeStatistics[]> {
  const results: CrimeStatistics[] = [];
  for (const raw of rawRecords) {
    const parsed = await parseCrimeRecord(raw, city, province);
    if (parsed) results.push(parsed);
  }
  return results;
}
