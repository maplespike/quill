// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from '../../utils/http.js';
import { PARK_PORTALS, PARK_TIMEOUT_MS, PARK_USER_AGENT } from './constants.js';

export interface ParkFetchResult {
  city: string;
  rawData: unknown;
  error?: string;
}

export async function fetchParkData(cityId: string): Promise<ParkFetchResult> {
  const portal = PARK_PORTALS[cityId];
  if (!portal) return { city: cityId, rawData: null, error: `Unknown city: ${cityId}` };

  try {
    let url: string;
    if (portal.portalType === 'ckan') url = `${portal.url}/api/3/action/package_show?id=${portal.datasetId}`;
    else if (portal.portalType === 'socrata') url = `${portal.url}/resource/${portal.datasetId}.json`;
    else url = `${portal.url}/api/${portal.datasetId}`;

    const resp = await httpGet(url, { timeoutMs: PARK_TIMEOUT_MS, headers: { 'User-Agent': PARK_USER_AGENT } });
    if (resp.statusCode >= 400) return { city: portal.city, rawData: null, error: `HTTP ${resp.statusCode}` };
    return { city: portal.city, rawData: JSON.parse(resp.body) };
  } catch (err) {
    return { city: portal.city, rawData: null, error: String(err) };
  }
}

export async function fetchAllParks(): Promise<ParkFetchResult[]> {
  return Promise.all(Object.keys(PARK_PORTALS).map(fetchParkData));
}
