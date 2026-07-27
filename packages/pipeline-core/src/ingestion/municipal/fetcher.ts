// SPDX-License-Identifier: AGPL-3.0-or-later

import { httpGet } from '../../utils/http.js';
import { MUNICIPAL_PORTALS, MUNICIPAL_TIMEOUT_MS, MUNICIPAL_USER_AGENT } from './constants.js';
import type { PortalType } from './constants.js';

/**
 * Self-healing dataset ID discovery for CKAN portals.
 *
 * Some portal registries list datasets by *friendly slugs* (`'budget'`,
 * `'permits'`) that are not valid CKAN package IDs — Toronto, Vancouver,
 * Montreal, etc. use UUID-style IDs. When `package_show?id=<slug>` returns
 * 404, we fall back to `package_search?q=<slug>&rows=1` and use the first
 * matching package's real `id`. This keeps `MUNICIPAL_PORTALS` driven by
 * human-readable names while still fetching live data correctly.
 */
async function resolveCkanPackageId(
  baseUrl: string,
  slug: string,
  timeoutMs = MUNICIPAL_TIMEOUT_MS,
): Promise<string | null> {
  const searchUrl = `${baseUrl}/api/3/action/package_search?q=${encodeURIComponent(
    slug,
  )}&rows=1`;
  try {
    const resp = await httpGet(searchUrl, {
      timeoutMs,
      headers: { 'User-Agent': MUNICIPAL_USER_AGENT },
    });
    if (resp.statusCode >= 400) return null;
    const body = JSON.parse(resp.body) as {
      result?: { results?: Array<{ id?: string; name?: string }> };
    };
    const top = body?.result?.results?.[0];
    return top?.id ?? top?.name ?? null;
  } catch {
    return null;
  }
}

export async function detectPortalType(municipalityId: string): Promise<PortalType> {
  const portal = MUNICIPAL_PORTALS[municipalityId];
  if (!portal) return 'none';

  try {
    const resp = await httpGet(`${portal.baseUrl}/api/3/action/package_list`, {
      timeoutMs: MUNICIPAL_TIMEOUT_MS,
      headers: { 'User-Agent': MUNICIPAL_USER_AGENT },
    });
    if (resp.statusCode < 400) return 'ckan';
  } catch (err) {
    console.warn(`[Municipal] CKAN probe failed for ${municipalityId}: ${(err as Error).message}`);
  }

  try {
    const resp = await httpGet(`${portal.baseUrl}/api/views.json`, {
      timeoutMs: MUNICIPAL_TIMEOUT_MS,
      headers: { 'User-Agent': MUNICIPAL_USER_AGENT },
    });
    if (resp.statusCode < 400) return 'socrata';
  } catch (err) {
    console.warn(`[Municipal] Socrata probe failed for ${municipalityId}: ${(err as Error).message}`);
  }

  try {
    // Detect ArcGIS Hub by checking the OGC API Records endpoint
    const resp = await httpGet(`${portal.baseUrl}/api/search/v1/collections/all/items?limit=1`, {
      timeoutMs: MUNICIPAL_TIMEOUT_MS,
      headers: { 'User-Agent': MUNICIPAL_USER_AGENT, 'Accept': 'application/json' },
    });
    if (resp.statusCode < 400) {
      try {
        const body = JSON.parse(resp.body);
        if (body?.type === 'FeatureCollection') return 'arcgis';
      } catch (err) {
        console.warn(`[Municipal] ArcGIS body parse failed for ${municipalityId}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    console.warn(`[Municipal] ArcGIS probe failed for ${municipalityId}: ${(err as Error).message}`);
  }

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
    // Primary: try friendly slug directly. Many CKAN portals (Toronto,
    // Vancouver, Montreal) use UUID-style IDs so this often 404s.
    const primaryUrl = `${portal.baseUrl}/api/3/action/package_show?id=${encodeURIComponent(dataset)}`;
    const primary = await httpGet(primaryUrl, {
      timeoutMs: MUNICIPAL_TIMEOUT_MS,
      headers: { 'User-Agent': MUNICIPAL_USER_AGENT },
    });
    if (primary.statusCode < 400) return JSON.parse(primary.body);

    // Self-healing fallback: discover the real package ID via search.
    if (primary.statusCode === 404) {
      const realId = await resolveCkanPackageId(portal.baseUrl, dataset);
      if (realId && realId !== dataset) {
        const fallbackUrl = `${portal.baseUrl}/api/3/action/package_show?id=${encodeURIComponent(realId)}`;
        const fallback = await httpGet(fallbackUrl, {
          timeoutMs: MUNICIPAL_TIMEOUT_MS,
          headers: { 'User-Agent': MUNICIPAL_USER_AGENT },
        });
        if (fallback.statusCode < 400) {
          // Attach the discovered real ID alongside the friendly slug so
          // downstream parsers can record what was actually fetched.
          const payload = JSON.parse(fallback.body);
          if (payload && typeof payload === 'object' && 'result' in payload) {
            (payload as Record<string, unknown>).__resolvedFrom = dataset;
          }
          return payload;
        }
      }
    }

    throw new Error(
      `HTTP ${primary.statusCode} fetching ${primaryUrl}${
        primary.statusCode === 404
          ? ' (and no matching package discovered via package_search)'
          : ''
      }`,
    );
  } else if (portal.portalType === 'socrata') {
    url = `${portal.baseUrl}/resource/${dataset}.json`;
  } else if (portal.portalType === 'arcgis') {
    // Use OGC API Records endpoint for ArcGIS Hub portals
    // Returns GeoJSON FeatureCollection with dataset metadata
    url = `${portal.baseUrl}/api/search/v1/collections/all/items?limit=100`;
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
      } catch (err) {
        console.warn(`[Municipal] Fetch failed for ${id}/${dataset}: ${(err as Error).message}`);
      }
    }
  }
  return results;
}
