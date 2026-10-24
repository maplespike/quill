// SPDX-License-Identifier: AGPL-3.0-only

import { fetchLibraryData, fetchAllLibraries } from './fetcher.js';
import { parseLibraryData } from './parser.js';
import { LIBRARY_PORTALS } from './constants.js';
import type { LibraryRecord, LibraryIngestionResult } from './types.js';

export async function ingestLibrary(cityId: string): Promise<LibraryIngestionResult> {
  const start = Date.now();
  const portal = LIBRARY_PORTALS[cityId];

  try {
    const fetched = await fetchLibraryData(cityId);
    if (fetched.error) {
      return {
        city: portal?.city ?? cityId, library: portal?.name ?? cityId,
        province: portal?.province ?? '', branches: [],
        errors: [fetched.error], durationMs: Date.now() - start,
      };
    }
    const branches = parseLibraryData(fetched.rawData, portal!.city, portal!.name, portal!.province, portal!.portalType);
    return {
      city: portal!.city, library: portal!.name,
      province: portal!.province, branches,
      errors: [], durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      city: portal?.city ?? cityId, library: portal?.name ?? cityId,
      province: portal?.province ?? '', branches: [],
      errors: [String(err)], durationMs: Date.now() - start,
    };
  }
}

export async function ingestAllLibraries(): Promise<LibraryIngestionResult[]> {
  const results: LibraryIngestionResult[] = [];
  for (const cityId of Object.keys(LIBRARY_PORTALS)) {
    results.push(await ingestLibrary(cityId));
  }
  return results;
}

export function searchLibraries(params: { city?: string; province?: string; query?: string }): LibraryRecord[] {
  const records: LibraryRecord[] = [];
  for (const [cityId, portal] of Object.entries(LIBRARY_PORTALS)) {
    if (params.city && cityId !== params.city) continue;
    if (params.province && portal.province !== params.province) continue;
    records.push({
      id: `${cityId}:lib:config`,
      city: portal.city,
      province: portal.province,
      library: portal.name,
      branchName: portal.name,
      url: portal.url,
      address: '',
    });
  }
  if (params.query) {
    const q = params.query.toLowerCase();
    return records.filter(r => r.library.toLowerCase().includes(q) || r.city.toLowerCase().includes(q));
  }
  return records;
}

export { LIBRARY_PORTALS } from './constants.js';
export { fetchLibraryData, fetchAllLibraries } from './fetcher.js';
export type { LibraryRecord, LibraryIngestionResult } from './types.js';
