// SPDX-License-Identifier: AGPL-3.0-only

import { httpGet } from '../../utils/http.js';
import { LIBRARY_PORTALS, LIBRARY_TIMEOUT_MS, LIBRARY_USER_AGENT } from './constants.js';
import type { LibraryPortalType } from './constants.js';

export interface LibraryFetchResult {
  city: string;
  library: string;
  rawData: unknown;
  error?: string;
}

export async function fetchLibraryData(cityId: string): Promise<LibraryFetchResult> {
  const portal = LIBRARY_PORTALS[cityId];
  if (!portal) return { city: cityId, library: cityId, rawData: null, error: `Unknown library: ${cityId}` };

  try {
    let url: string;
    if (portal.portalType === 'ckan') {
      url = `${portal.url}/api/3/action/package_show?id=${portal.datasetId}`;
    } else if (portal.portalType === 'socrata') {
      url = `${portal.url}/resource/${portal.datasetId}.json`;
    } else if (portal.portalType === 'arcgis') {
      url = `${portal.url}/arcgis/rest/services/${portal.datasetId}?f=pjson`;
    } else {
      url = `${portal.url}/api/${portal.datasetId}`;
    }

    const resp = await httpGet(url, {
      timeoutMs: LIBRARY_TIMEOUT_MS,
      headers: { 'User-Agent': LIBRARY_USER_AGENT },
    });

    if (resp.statusCode >= 400) {
      return { city: portal.city, library: portal.name, rawData: null, error: `HTTP ${resp.statusCode}` };
    }

    return { city: portal.city, library: portal.name, rawData: JSON.parse(resp.body) };
  } catch (err) {
    return { city: portal.city, library: portal.name, rawData: null, error: String(err) };
  }
}

export async function fetchAllLibraries(): Promise<LibraryFetchResult[]> {
  const results: LibraryFetchResult[] = [];
  for (const cityId of Object.keys(LIBRARY_PORTALS)) {
    results.push(await fetchLibraryData(cityId));
  }
  return results;
}

export function detectLibraryPortalType(portalType: string): LibraryPortalType {
  const valid = ['ckan', 'socrata', 'arcgis', 'custom', 'none'] as LibraryPortalType[];
  return valid.includes(portalType as LibraryPortalType) ? portalType as LibraryPortalType : 'custom';
}
