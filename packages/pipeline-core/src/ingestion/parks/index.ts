// SPDX-License-Identifier: AGPL-3.0-only
import { fetchParkData, fetchAllParks } from './fetcher.js';
import { parseParkData } from './parser.js';
import { PARK_PORTALS } from './constants.js';
import type { ParkRecord, ParkIngestionResult } from './types.js';

export async function ingestParks(cityId: string): Promise<ParkIngestionResult> {
  const start = Date.now();
  const portal = PARK_PORTALS[cityId];
  try {
    const fetched = await fetchParkData(cityId);
    if (fetched.error) {
      return { city: portal?.city ?? cityId, parks: [], errors: [fetched.error], durationMs: Date.now() - start };
    }
    const parks = parseParkData(fetched.rawData, portal!.city, portal!.province, portal!.portalType);
    return { city: portal!.city, parks, errors: [], durationMs: Date.now() - start };
  } catch (err) {
    return { city: portal?.city ?? cityId, parks: [], errors: [String(err)], durationMs: Date.now() - start };
  }
}

export async function ingestAllParks(): Promise<ParkIngestionResult[]> {
  return Promise.all(Object.keys(PARK_PORTALS).map(ingestParks));
}

export function searchParks(params: { city?: string; province?: string; query?: string }): ParkRecord[] {
  const results: ParkRecord[] = [];
  for (const [id, p] of Object.entries(PARK_PORTALS)) {
    if (params.city && id !== params.city) continue;
    if (params.province && p.province !== params.province) continue;
    results.push({ id: `${id}:park:config`, city: p.city, province: p.province, parkName: p.name });
  }
  if (params.query) {
    const q = params.query.toLowerCase();
    return results.filter(r => r.parkName.toLowerCase().includes(q) || r.city.toLowerCase().includes(q));
  }
  return results;
}

export { PARK_PORTALS } from './constants.js';
export type { ParkRecord, ParkIngestionResult } from './types.js';
