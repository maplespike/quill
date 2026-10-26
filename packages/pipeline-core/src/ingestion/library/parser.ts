// SPDX-License-Identifier: AGPL-3.0-only

import type { LibraryRecord } from './types.js';

export function parseCkanLibraryResponse(raw: unknown, city: string, library: string, province: string): LibraryRecord[] {
  const pkg = (raw as any)?.result;
  if (!pkg || !Array.isArray(pkg.resources)) return [];

  return pkg.resources.map((r: any, i: number) => ({
    id: `${city}:lib:${i}`,
    city,
    province,
    library,
    branchName: r.name || r.title || `Branch ${i}`,
    url: r.url || '',
    address: '',
    phone: '',
    hours: '',
    services: [],
    lat: undefined,
    lon: undefined,
  }));
}

export function parseSocrataLibraryResponse(raw: unknown, city: string, library: string, province: string): LibraryRecord[] {
  const rows = raw as any[];
  if (!Array.isArray(rows)) return [];

  return rows.map((r: any, i: number) => ({
    id: `${city}:lib:${i}`,
    city,
    province,
    library,
    branchName: r.branch_name || r.name || r.title || r.branch || `Branch ${i}`,
    address: r.address || r.location || '',
    phone: r.phone || '',
    hours: r.hours || '',
    services: r.services ? (Array.isArray(r.services) ? r.services : [r.services]) : [],
    lat: parseFloat(r.latitude || r.lat) || undefined,
    lon: parseFloat(r.longitude || r.lon || r.lng) || undefined,
    url: r.url || r.website || '',
  }));
}

export function parseLibraryData(raw: unknown, city: string, library: string, province: string, portalType: 'ckan' | 'socrata' | 'arcgis' | 'custom' | 'none'): LibraryRecord[] {
  if (portalType === 'ckan') return parseCkanLibraryResponse(raw, city, library, province);
  if (portalType === 'socrata') return parseSocrataLibraryResponse(raw, city, library, province);
  if (portalType === 'arcgis') {
    const features = (raw as any)?.features;
    if (!Array.isArray(features)) return [];
    return features.map((f: any, i: number) => ({
      id: `${city}:lib:${i}`, city, province, library,
      branchName: f.properties?.title || `Feature ${i}`,
      url: f.properties?.url || '',
      address: '', phone: '', hours: '', services: [],
    }));
  }
  return [];
}
