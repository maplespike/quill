// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from '../../utils/http.js';
import { POLICE_AGENCIES, POLICE_TIMEOUT_MS, POLICE_USER_AGENT } from './constants.js';

export interface PoliceFetchResult {
  city: string;
  agency: string;
  province: string;
  rawData: unknown;
  error?: string;
}

export async function fetchPoliceData(city: string): Promise<PoliceFetchResult> {
  const agency = POLICE_AGENCIES.find(a => a.city.toLowerCase() === city.toLowerCase());
  if (!agency) return { city, agency: city, province: '', rawData: null, error: `Unknown city: ${city}` };

  try {
    let url: string;
    if (agency.portalType === 'ckan') url = `${agency.url}/api/3/action/package_show?id=${agency.datasetId}`;
    else if (agency.portalType === 'socrata') url = `${agency.url}/resource/${agency.datasetId}.json`;
    else url = `${agency.url}/api/${agency.datasetId}`;

    const resp = await httpGet(url, { timeoutMs: POLICE_TIMEOUT_MS, headers: { 'User-Agent': POLICE_USER_AGENT } });
    if (resp.statusCode >= 400) return { city: agency.city, agency: agency.name, province: agency.province, rawData: null, error: `HTTP ${resp.statusCode}` };
    return { city: agency.city, agency: agency.name, province: agency.province, rawData: JSON.parse(resp.body) };
  } catch (err) {
    return { city: agency.city, agency: agency.name, province: agency.province, rawData: null, error: String(err) };
  }
}

export async function fetchAllPolice(): Promise<PoliceFetchResult[]> {
  return Promise.all(POLICE_AGENCIES.map(a => fetchPoliceData(a.city)));
}
