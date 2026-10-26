// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { CrimeStatistics } from './types.js';

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

export function parsePoliceResponse(raw: unknown, city: string, agency: string, province: string) {
  if (Array.isArray(raw)) {
    return raw.map((r: any, i: number) => ({
      id: `${city.toLowerCase()}:police:${i}`,
      city, agency, province,
      incidentType: r.incident_type || r.type || r.category || '',
      location: r.location || r.address || r.neighborhood || '',
      date: r.date || r.occurrence_date || r.report_date || '',
      disposition: r.disposition || r.status || r.clearance || '',
      lat: parseFloat(r.latitude || r.lat) || undefined,
      lon: parseFloat(r.longitude || r.lon || r.lng) || undefined,
    }));
  }
  const pkg = (raw as any)?.result;
  if (pkg?.resources) {
    return pkg.resources.map((r: any, i: number) => ({
      id: `${city.toLowerCase()}:police:${i}`,
      city, agency, province,
      incidentType: r.name || r.title || '',
      location: '',
    }));
  }
  return [];
}
