// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import type { GeospatialRecord, GeospatialIngestionResult } from './types.js';
import { GEOSPATIAL_UA, GEOSPATIAL_TIMEOUT_MS, MAX_GEOSPATIAL_RECORDS, CKAN_BASE, GEOSPATIAL_QUERIES } from './constants.js';

async function fetchJson(url: string): Promise<any> {
  try {
    const resp = await httpGet(url, { headers: { 'User-Agent': GEOSPATIAL_UA }, timeoutMs: GEOSPATIAL_TIMEOUT_MS });
    return resp.statusCode >= 400 ? null : await resp.json();
  } catch { return null; }
}

export async function ingestAllGeospatial(): Promise<GeospatialIngestionResult> {
  const start = Date.now(); const records: GeospatialRecord[] = []; const errors: string[] = [];
  const now = new Date().toISOString();

  // Search CKAN for geospatial datasets across multiple categories
  for (const query of GEOSPATIAL_QUERIES) {
    if (records.length >= MAX_GEOSPATIAL_RECORDS) break;
    try {
      const data = await fetchJson(`${CKAN_BASE}/package_search?q=${encodeURIComponent(query)}&rows=30`);
      if (!data?.result?.results) continue;
      for (const pkg of data.result.results) {
        if (records.length >= MAX_GEOSPATIAL_RECORDS) break;
        const title = pkg.title || pkg.name || '';
        if (!title) continue;
        const format = pkg.resources?.[0]?.format || 'unknown';
        records.push({
          id: await computeHash(`geo-${pkg.id}`, 'sha256'),
          title, description: (pkg.notes || '').substring(0, 300),
          url: `https://open.canada.ca/data/en/dataset/${pkg.id}`,
          format, region: 'Canada', category: query,
          hash: await computeHash(`geo-${pkg.id}-${query}`, 'sha256'), ingestedAt: now,
        });
      }
    } catch (e) { errors.push(`${query}: ${e instanceof Error ? e.message : 'unknown'}`); }
  }

  return {
    records, sourcesAttempted: GEOSPATIAL_QUERIES.length,
    sourcesSucceeded: records.length > 0 ? GEOSPATIAL_QUERIES.length : 0,
    errors, durationMs: Date.now() - start,
  };
}
