/**
 * Isc Fetcher — Quill
 *
 * HTTP fetch logic for Housing Programs data via CKAN API.
 */

import { httpGet } from '../../../utils/http.js';
import { ISC_PACKAGES, CKAN_BASE } from './constants.js';

async function fetchCkanPackage(packageId: string): Promise<any> {
  const url = `${CKAN_BASE}/api/3/action/package_show?id=${packageId}`;
  const resp = await httpGet(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'MapleSpike/0.2 (+https://maplespike.lan)' },
    timeoutMs: 15000,
  });

  if (resp.statusCode >= 400) {
    throw new Error(`CKAN error (${packageId}): ${resp.statusCode}`);
  }

  const data: any = await resp.json();
  if (!data.success || !data.result) {
    throw new Error(`CKAN fetch failed: ${packageId}`);
  }

  return data.result;
}

function findCsvResource(pkg: any): any {
  if (!pkg.resources || !Array.isArray(pkg.resources)) return null;
  const csvResource = pkg.resources.find((r: any) =>
    r.format?.toLowerCase() === 'csv' ||
    r.mimetype?.toLowerCase() === 'text/csv' ||
    r.url?.toLowerCase().endsWith('.csv')
  );
  return csvResource || pkg.resources[0];
}

export async function fetchIscCsv(packageId: string): Promise<string> {
  const pkg = await fetchCkanPackage(packageId);
  const resource = findCsvResource(pkg);

  if (!resource || !resource.url) {
    throw new Error(`No valid resource found for package: ${packageId}`);
  }

  const resp = await httpGet(resource.url, {
    headers: { Accept: 'text/csv', 'User-Agent': 'MapleSpike/0.2 (+https://maplespike.lan)' },
    timeoutMs: 30000,
  });

  if (resp.statusCode >= 400) {
    throw new Error(`CSV fetch failed (${resource.url}): ${resp.statusCode}`);
  }

  return resp.body;
}
