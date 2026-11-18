// SPDX-License-Identifier: AGPL-3.0-only
import { fetchPoliceData, fetchAllPolice } from './fetcher.js';
import { parseCrimeRecords, parsePoliceResponse } from './parser.js';
import { POLICE_AGENCIES } from './constants.js';
import type { CrimeStatistics, IncidentReport, PoliceRecord, PoliceIngestionResult } from './types.js';

export async function ingestPoliceCity(city: string): Promise<PoliceIngestionResult> {
  const start = Date.now();
  const result = await fetchPoliceData(city);
  if (result.error) {
    return { city: result.city, agency: result.agency, records: [], errors: [result.error], durationMs: Date.now() - start };
  }
  const records = parsePoliceResponse(result.rawData, result.city, result.agency, result.province);
  return { city: result.city, agency: result.agency, records, errors: [], durationMs: Date.now() - start };
}

export async function ingestAllPolice(): Promise<PoliceIngestionResult[]> {
  return Promise.all(POLICE_AGENCIES.map(a => ingestPoliceCity(a.city)));
}

export function searchPolice(params: { city?: string; province?: string; query?: string }): PoliceRecord[] {
  return POLICE_AGENCIES
    .filter(a => !params.city || a.city.toLowerCase() === params.city.toLowerCase())
    .filter(a => !params.province || a.province === params.province)
    .filter(a => !params.query || a.name.toLowerCase().includes(params.query.toLowerCase()) || a.city.toLowerCase().includes(params.query.toLowerCase()))
    .map((a, i) => ({
      id: `police:${i}`, city: a.city, province: a.province, agency: a.name,
    }));
}

export { POLICE_AGENCIES } from './constants.js';
export const ingestPoliceData = ingestPoliceCity;
export const ingestAllPoliceData = ingestAllPolice;
export type { CrimeStatistics, IncidentReport, PoliceRecord, PoliceIngestionResult } from './types.js';
