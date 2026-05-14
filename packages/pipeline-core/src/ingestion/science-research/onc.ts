import { SOURCES } from './constants.js';
import type { OceanObservation } from './types.js';
import { computeHash } from '../../verification/hashing.js';

export async function fetchOceanObservations(): Promise<OceanObservation[]> {
  const observations: OceanObservation[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await fetch(SOURCES.OCEAN_NETWORKS.stationsUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    if (resp.ok) {
      const stations = (await resp.json()) as Record<string, unknown>[];

      for (const station of stations.slice(0, 20)) {
        const stationId = station.stationId ?? station.id;
        if (!stationId) continue;

        const locationCode = String(station.locationCode ?? station.region ?? '');
        const id = await computeHash(`onc:${stationId}`, 'sha256');

        observations.push({
          id,
          station: String(station.name ?? stationId),
          region: locationCode,
          latitude: Number(station.latitude ?? 0),
          longitude: Number(station.longitude ?? 0),
          parameter: 'location',
          value: 0,
          unit: '',
          timestamp: now,
          depth: null,
          sourceUrl: `${SOURCES.OCEAN_NETWORKS.baseUrl}/${stationId}`,
          ingestedAt: now,
        });
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
    const resp = await fetch(SOURCES.POLAR_CATALOGUE.searchApi, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    if (resp.ok) {
      const data = (await resp.json()) as Record<string, unknown>[];
      for (const raw of data.slice(0, 50)) {
        const id = await computeHash(`polar:${raw.id ?? raw.title}`, 'sha256');
        records.push({
          id,
          title: String(raw.title ?? ''),
          investigator: String(raw.investigator ?? raw.principalInvestigator ?? ''),
          organization: String(raw.organization ?? ''),
          region: String(raw.region ?? ''),
          discipline: String(raw.discipline ?? ''),
          startYear: Number(raw.startYear ?? new Date().getFullYear()),
          endYear: raw.endYear ? Number(raw.endYear) : null,
          fundingAmount: raw.fundingAmount ? Number(raw.fundingAmount) : null,
          sourceUrl: `${SOURCES.POLAR_CATALOGUE.baseUrl}/dataset/${raw.id ?? ''}`,
          ingestedAt: now,
        });
      }
    }
  } catch {
  }

  return records;
}
