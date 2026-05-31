// SPDX-License-Identifier: AGPL-3.0-or-later

import { computeHash } from '../../verification/hashing.js';
import { MUNICIPAL_PORTALS } from './constants.js';
import type { PortalType } from './constants.js';
import type { MunicipalRecord } from './types.js';

interface CkanPackageResult {
  result: {
    id: string;
    title: string;
    owner_org: string;
    metadata_created: string;
    metadata_modified: string;
    resources: Array<{
      id: string;
      name: string;
      url: string;
      format: string;
      last_modified: string;
    }>;
  };
}

interface SocrataRow {
  municipality?: string;
  title?: string;
  name?: string;
  href?: string;
  link?: string;
  updated_at?: string;
  created_at?: string;
}

export async function parseCkanResponse(
  raw: CkanPackageResult,
  municipalityId: string,
  dataset: string,
): Promise<MunicipalRecord[]> {
  const pkg = raw.result;
  const portal = MUNICIPAL_PORTALS[municipalityId];
  const records: MunicipalRecord[] = [];

  for (const resource of pkg.resources) {
    const id = await computeHash(`municipal:${municipalityId}:${dataset}:${resource.id}`);
    records.push({
      id,
      municipality: portal?.name ?? municipalityId,
      municipalityId,
      province: portal?.province ?? '',
      dataset,
      title: resource.name || pkg.title,
      url: resource.url,
      format: resource.format,
      lastModified: resource.last_modified || null,
      created: pkg.metadata_created || null,
      portalType: 'ckan',
    });
  }

  return records;
}

export async function parseSocrataResponse(
  data: SocrataRow[],
  municipalityId: string,
  dataset: string,
): Promise<MunicipalRecord[]> {
  const portal = MUNICIPAL_PORTALS[municipalityId];
  const records: MunicipalRecord[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const id = await computeHash(`municipal:${municipalityId}:${dataset}:${i}`);
    records.push({
      id,
      municipality: portal?.name ?? municipalityId,
      municipalityId,
      province: portal?.province ?? '',
      dataset,
      title: row.title || row.name || `Record ${i}`,
      url: row.href || row.link || '',
      format: 'json',
      lastModified: row.updated_at || null,
      created: row.created_at || null,
      portalType: 'socrata',
    });
  }

  return records;
}

interface ArcGISServiceInfo {
  name: string;
  type: string;
  description?: string;
  id?: string;
}

export async function parseArcGISResponse(
  data: ArcGISServiceInfo[],
  municipalityId: string,
  dataset: string,
): Promise<MunicipalRecord[]> {
  const portal = MUNICIPAL_PORTALS[municipalityId];
  const records: MunicipalRecord[] = [];

  for (let i = 0; i < data.length; i++) {
    const service = data[i];
    const id = await computeHash(`municipal:${municipalityId}:${dataset}:${service.name || i}`);
    records.push({
      id,
      municipality: portal?.name ?? municipalityId,
      municipalityId,
      province: portal?.province ?? '',
      dataset,
      title: service.name || `ArcGIS Service ${i}`,
      url: `${portal?.baseUrl}/arcgis/rest/services/${service.name}`,
      format: service.type || 'json',
      lastModified: null,
      created: null,
      portalType: 'arcgis',
    });
  }

  return records;
}

export function parseMunicipalData(
  raw: unknown,
  municipalityId: string,
  dataset: string,
  portalType: PortalType,
): MunicipalRecord[] | Promise<MunicipalRecord[]> {
  if (portalType === 'ckan') {
    return parseCkanResponse(raw as CkanPackageResult, municipalityId, dataset);
  }
  if (portalType === 'socrata') {
    return parseSocrataResponse(raw as SocrataRow[], municipalityId, dataset);
  }
  if (portalType === 'arcgis') {
    return parseArcGISResponse(raw as ArcGISServiceInfo[], municipalityId, dataset);
  }
  return [];
}
