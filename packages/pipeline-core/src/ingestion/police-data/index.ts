// SPDX-License-Identifier: AGPL-3.0-or-later

import { buildAttribution, withAttribution } from '../../shared/attribution.js';
import { fetchPoliceData, fetchAllPoliceAgencies } from './fetcher.js';
import { parseCrimeRecords } from './parser.js';
import { POLICE_AGENCIES } from './constants.js';
import type { CrimeStatistics, IncidentReport } from './types.js';

function makeAttribution(city: string, province: string) {
  return buildAttribution(`${city} Police`, {
    sourceUrl: POLICE_AGENCIES.find(a => a.city === city)?.url ?? '',
    license: 'Open Data License',
    attributionText: `Source: ${city} Police Open Data`,
  });
}

export async function ingestPoliceCity(city: string) {
  const attribution = makeAttribution(city, provinceFromCity(city));
  const result = await fetchPoliceData(city);
  const crimes = await parseCrimeRecords(result.rawRecords, city, result.province);

  return withAttribution({
    city,
    province: result.province,
    crimes,
    totalIncidents: crimes.length,
    error: result.error,
  }, attribution);
}

export async function ingestAllPoliceAgencies() {
  const results = await fetchAllPoliceAgencies();
  return results.map(r => ({
    city: r.city,
    province: r.province,
    totalCrimes: r.rawRecords.length,
    error: r.error,
  }));
}

function provinceFromCity(city: string): string {
  return POLICE_AGENCIES.find(a => a.city === city)?.province ?? '';
}

export { POLICE_AGENCIES } from './constants.js';
// Aliases expected by module registry
export const ingestPoliceData = ingestPoliceCity;
export const ingestAllPoliceData = ingestAllPoliceAgencies;

export type { CrimeStatistics, IncidentReport } from './types.js';
