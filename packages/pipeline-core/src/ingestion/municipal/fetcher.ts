// SPDX-License-Identifier: AGPL-3.0-or-later

import { httpGet } from '../../utils/http.js';
import { MUNICIPAL_PORTALS, MUNICIPAL_TIMEOUT_MS, MUNICIPAL_USER_AGENT } from './constants.js';
import type { PortalType } from './constants.js';

export async function detectPortalType(municipalityId: string): Promise<PortalType> {
  const portal = MUNICIPAL_PORTALS[municipalityId];
  if (!portal) return 'none';

  try {
    const resp = await httpGet(`${portal.baseUrl}/api/3/action/package_list`, {
      timeoutMs: MUNICIPAL_TIMEOUT_MS,
      headers: { 'User-Agent': MUNICIPAL_USER_AGENT },
    });
    if (resp.statusCode < 400) return 'ckan';
  } catch {}

  try {
    const resp = await httpGet(`${portal.baseUrl}/api/views.json`, {
      timeoutMs: MUNICIPAL_TIMEOUT_MS,
      headers: { 'User-Agent': MUNICIPAL_USER_AGENT },
    });
    if (resp.statusCode < 400) return 'socrata';
  } catch {}

  try {
    // Detect ArcGIS Hub by checking for ArcGIS REST API
    const resp = await httpGet(`${portal.baseUrl}/arcgis/rest/services`, {
      timeoutMs: MUNICIPAL_TIMEOUT_MS,
      headers: { 'User-Agent': MUNICIPAL_USER_AGENT },
    });
    if (resp.statusCode < 400 && resp.body.includes('ArcGIS REST')) return 'arcgis';
  } catch {}

  return 'custom';
}

export async function fetchMunicipalDataset(
  municipalityId: string,
  dataset: string,
): Promise<unknown> {
  const portal = MUNICIPAL_PORTALS[municipalityId];
  if (!portal) throw new Error(`Unknown municipality: ${municipalityId}`);

  let url: string;
  if (portal.portalType === 'ckan') {
    url = `${portal.baseUrl}/api/3/action/package_show?id=${dataset}`;
  } else if (portal.portalType === 'socrata') {
    url = `${portal.baseUrl}/resource/${dataset}.json`;
  } else if (portal.portalType === 'arcgis') {
    url = `${portal.baseUrl}/arcgis/rest/services/${dataset}?f=pjson`;
  } else if (portal.portalType === 'custom') {
    url = `${portal.baseUrl}/api/${dataset}`;
  } else {
    throw new Error(`Unsupported portal type: ${portal.portalType}`);
  }

  const resp = await httpGet(url, {
    timeoutMs: MUNICIPAL_TIMEOUT_MS,
    headers: { 'User-Agent': MUNICIPAL_USER_AGENT },
  });

  if (resp.statusCode >= 400) {
    throw new Error(`HTTP ${resp.statusCode} fetching ${url}`);
  }

  return JSON.parse(resp.body);
}

export async function fetchAllMunicipalities(): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];
  for (const [id, portal] of Object.entries(MUNICIPAL_PORTALS)) {
    for (const dataset of portal.datasets) {
      try {
        const data = await fetchMunicipalDataset(id, dataset);
        results.push({ municipalityId: id, dataset, data });
      } catch {}
    }
  }
  return results;
}
