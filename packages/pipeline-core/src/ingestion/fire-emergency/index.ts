// SPDX-License-Identifier: AGPL-3.0-or-later

import { buildAttribution, withAttribution } from '../../shared/attribution.js';
import { fetchFireIncidents, fetchAllFireDepartments } from './fetcher.js';
import { parseFireRecords, FIRE_DEPARTMENTS } from './parser.js';
import type { FireIncident, ResponseTime, Station } from './types.js';

function makeAttribution(city: string) {
  return buildAttribution(`${city} Fire Department`, {
    attributionText: `No publisher license declaration is attached to this source configuration. Consult ${city} Fire Department terms for the specific dataset and material.`,
  });
}

export async function ingestFireData(city: string) {
  const attribution = makeAttribution(city);
  const result = await fetchFireIncidents(city);
  const incidents = result.error ? [] : await parseFireRecords(result.rawRecords, city, result.province);

  return withAttribution({
    incidents,
    responseTimes: [] as ResponseTime[],
    stations: [] as Station[],
    error: result.error,
  } satisfies Record<string, unknown>, attribution);
}

export async function ingestAllFireData() {
  const results = await fetchAllFireDepartments();
  return results.map(r => ({
    city: r.city,
    success: !r.error,
    recordCount: r.rawRecords.length,
    error: r.error,
  }));
}

export { FIRE_DEPARTMENTS } from './constants.js';
export type { FireIncident, ResponseTime, Station } from './types.js';
