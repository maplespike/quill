// SPDX-License-Identifier: AGPL-3.0-only
import type { ParkRecord } from './types.js';

function extractSocrataParks(raw: unknown, city: string, province: string): ParkRecord[] {
  const rows = raw as any[];
  if (!Array.isArray(rows)) return [];
  return rows.map((r: any, i: number) => ({
    id: `${city}:park:${i}`,
    city, province,
    parkName: r.park_name || r.name || r.park || `Park ${i}`,
    parkType: r.park_type || r.type || '',
    address: r.address || r.location || '',
    amenities: r.amenities ? (Array.isArray(r.amenities) ? r.amenities : [r.amenities]) : [],
    sizeHa: parseFloat(r.size_ha || r.area_ha || r.hectares) || undefined,
    lat: parseFloat(r.latitude || r.lat) || undefined,
    lon: parseFloat(r.longitude || r.lon || r.lng) || undefined,
    url: r.url || r.website || '',
  }));
}

function extractCkanParks(raw: unknown, city: string, province: string): ParkRecord[] {
  const pkg = (raw as any)?.result;
  if (!pkg || !Array.isArray(pkg.resources)) return [];
  return pkg.resources.map((r: any, i: number) => ({
    id: `${city}:park:${i}`,
    city, province,
    parkName: r.name || r.title || `Resource ${i}`,
    url: r.url || '',
  }));
}

export function parseParkData(raw: unknown, city: string, province: string, portalType: string): ParkRecord[] {
  if (portalType === 'socrata') return extractSocrataParks(raw, city, province);
  if (portalType === 'ckan') return extractCkanParks(raw, city, province);
  if (portalType === 'arcgis') {
    const features = (raw as any)?.features;
    if (!Array.isArray(features)) return [];
    return features.map((f: any, i: number) => ({
      id: `${city}:park:${i}`, city, province,
      parkName: f.properties?.title || `Feature ${i}`,
      parkType: f.properties?.type || '',
      address: '', url: f.properties?.url || '',
    }));
  }
  return [];
}
