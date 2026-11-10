// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import type { RegionalRecord, RegionalIngestionResult, RegionalAuthorityConfig } from './types.js';
import { REGIONAL_AUTHORITIES, REGIONAL_FETCH_TIMEOUT_MS, REGIONAL_USER_AGENT } from './constants.js';

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const resp = await httpGet(url, {
      headers: { 'User-Agent': REGIONAL_USER_AGENT, Accept: 'application/json' },
      timeoutMs: REGIONAL_FETCH_TIMEOUT_MS,
    });
    return resp.statusCode >= 400 ? null : (await resp.json() as T);
  } catch { return null; }
}

/** Fetch datasets via CKAN package_list */
async function fetchCkanData(config: RegionalAuthorityConfig): Promise<RegionalRecord[]> {
  const records: RegionalRecord[] = [];
  const now = new Date().toISOString();
  const pkgList = await fetchJson<{ result?: string[] }>(`${config.ckanBase}/package_list`);
  if (!pkgList?.result) return records;

  const packages = pkgList.result.slice(0, 30);
  for (const pkgId of packages) {
    const pkg = await fetchJson<{ result?: { title: string; notes?: string; resources: Array<{ url: string; format: string; name?: string }> } }>(
      `${config.ckanBase}/package_show?id=${pkgId}`
    );
    if (!pkg?.result?.resources) continue;
    for (const res of pkg.result.resources.slice(0, 10)) {
      records.push({
        authority: config.code,
        name: config.name,
        title: res.name ?? pkg.result.title,
        description: pkg.result.notes ?? '',
        url: res.url,
        format: res.format,
        hash: await computeHash(`${config.code}:${res.url}`, 'sha256'),
        ingestedAt: now,
      });
    }
  }
  return records;
}

/** Fetch datasets via ArcGIS Hub search endpoint */
async function fetchArcgisHubData(config: RegionalAuthorityConfig): Promise<RegionalRecord[]> {
  const records: RegionalRecord[] = [];
  const now = new Date().toISOString();
  const search = await fetchJson<{ results?: Array<{ id: string; name: string; url?: string; type?: string }> }>(
    `${config.arcgisHubBase}/api/search/definition/?limit=30`
  );
  if (!search?.results) return records;

  for (const item of search.results) {
    records.push({
      authority: config.code,
      name: config.name,
      title: item.name,
      description: '',
      url: item.url ?? `${config.arcgisHubBase}/datasets/${item.id}`,
      format: item.type ?? 'ArcGIS',
      hash: await computeHash(`${config.code}:${item.id}`, 'sha256'),
      ingestedAt: now,
    });
  }
  return records;
}

/** Fetch all regional authority datasets */
export async function fetchAllRegional(): Promise<RegionalIngestionResult> {
  const start = Date.now();
  const allRecords: RegionalRecord[] = [];
  const errors: string[] = [];
  let succeeded = 0;

  const results = await Promise.allSettled(
    REGIONAL_AUTHORITIES.map(async (config) => {
      switch (config.portalType) {
        case 'ckan':
          return { code: config.code, records: await fetchCkanData(config) };
        case 'arcgis-hub':
          return { code: config.code, records: await fetchArcgisHubData(config) };
        default:
          return { code: config.code, records: [] };
      }
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled') {
      allRecords.push(...r.value.records);
      if (r.value.records.length > 0) succeeded++;
    } else {
      errors.push(r.reason?.message ?? 'unknown');
    }
  }

  return { records: allRecords, sourcesAttempted: REGIONAL_AUTHORITIES.length, sourcesSucceeded: succeeded, errors, durationMs: Date.now() - start };
}

/** Search across regional authority records */
export function searchRegional(
  records: RegionalRecord[],
  query: string,
  authority?: string,
): RegionalRecord[] {
  const q = query.toLowerCase();
  return records.filter(r =>
    (!authority || r.authority === authority) &&
    (r.title.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q))
  );
}
