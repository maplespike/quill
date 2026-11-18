// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from '../../utils/http.js';
import { SOURCES } from './constants.js';
import type { OceanObservation } from './types.js';
import { toOceanObservation, toPolarRecord } from './parser.js';

export async function fetchOceanObservations(): Promise<OceanObservation[]> {
  const observations: OceanObservation[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(SOURCES.OCEAN_NETWORKS.stationsUrl, {
      headers: { Accept: 'application/json' },
      timeoutMs: 15000,
    });

    if (resp.statusCode < 400) {
      const stations = (await resp.json()) as Record<string, unknown>[];

      for (const station of stations.slice(0, 20)) {
        const stationId = station.stationId ?? station.id;
        if (!stationId) continue;
        observations.push(await toOceanObservation(station, String(stationId), SOURCES.OCEAN_NETWORKS.baseUrl, now));
      }
    }
  } catch {
  }

  return observations;
}

export async function fetchPolarRecords(): Promise<import('./types.js').PolarRecord[]> {
  const records: import('./types.js').PolarRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(SOURCES.POLAR_CATALOGUE.searchApi, {
      headers: { Accept: 'application/json' },
      timeoutMs: 15000,
    });

    if (resp.statusCode < 400) {
      const data = (await resp.json()) as Record<string, unknown>[];
      for (const raw of data.slice(0, 50)) {
        records.push(await toPolarRecord(raw, SOURCES.POLAR_CATALOGUE.baseUrl, now));
      }
    }
  } catch {
  }

  return records;
}
