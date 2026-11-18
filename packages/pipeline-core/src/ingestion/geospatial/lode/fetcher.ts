// SPDX-License-Identifier: AGPL-3.0-only
/**
 * LODE Fetcher — Quill
 *
 * Ingests data from all 12 Statistics Canada LODE (Linkable Open Data
 * Environment) databases.
 */

import { httpGet } from '../../../utils/http.js';
import { computeHash } from '../../../verification/hashing.js';
import {
  LODE_DATABASES,
  LODE_UA,
  LODE_TIMEOUT_MS,
  LODE_MAX_RECORDS,
} from './constants.js';
import type {
  LodeIngestionResult, LodeRecord,
  LodeHealthcareFacility, LodeAddress, LodeBuilding,
  LodeRecreationalFacility, LodeEducationalFacility, LodeCulturalFacility,
  LodeBusiness, LodeInfrastructure, LodeGreenhouse, LodePedestrianNetwork,
  LodeTransitStop, LodeCyclingNetwork,
  LodeSearchParams, LodeSearchResult,
} from './types.js';
import type { LodeDatabaseInfo } from './constants.js';

import { parseCsvLine } from '../../../utils/csv.js';
async function fetchJson(url: string): Promise<any> {
  try {
    const resp = await httpGet(url, { headers: { 'User-Agent': LODE_UA }, timeoutMs: LODE_TIMEOUT_MS });
    return resp.statusCode >= 400 ? null : await resp.json();
  } catch { return null; }
}

async function fetchCsv(url: string): Promise<string | null> {
  try {
    const resp = await httpGet(url, { headers: { 'User-Agent': LODE_UA }, timeoutMs: LODE_TIMEOUT_MS });
    return resp.statusCode >= 400 ? null : resp.body;
  } catch { return null; }
}



function safeFloat(val: string | undefined): number | null {
  if (!val || val.trim() === '') return null;
  const n = parseFloat(val.trim());
  return isNaN(n) ? null : n;
}

function safeStr(val: string | undefined): string | null {
  if (!val || val.trim() === '') return null;
  return val.trim();
}

/** Ingests ODHF CSV directly */
async function ingestOdhf(): Promise<{ records: LodeHealthcareFacility[]; errors: string[] }> {
  const records: LodeHealthcareFacility[] = [];
  const errors: string[] = [];
  const now = new Date().toISOString();
  const db = LODE_DATABASES.ODHF;
  if (!db.csvUrl) return { records, errors: ['No CSV URL for ODHF'] };

  const csv = await fetchCsv(db.csvUrl);
  if (!csv) return { records, errors: [`Failed to fetch ODHF CSV: ${db.csvUrl}`] };

  try {
    const lines = csv.split('\n').filter(l => l.trim().length > 0);
    const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));
    for (let i = 1; i < Math.min(lines.length, LODE_MAX_RECORDS + 1); i++) {
      try {
        const vals = parseCsvLine(lines[i]);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
        const rawType = (row['facilitytype'] || '').toLowerCase();
        let facilityType: LodeHealthcareFacility['facilityType'] = 'ambulatory_health_care_services';
        if (rawType.includes('hospital')) facilityType = 'hospital';
        else if (rawType.includes('nursing') || rawType.includes('residential')) facilityType = 'nursing_residential_care';
        records.push({
          id: await computeHash(`odhf-${i}`, 'sha256'),
          name: row['facilityname'] || row['name'] || 'Unknown',
          facilityType,
          address: safeStr(row['address'] || row['streetaddress']),
          municipality: safeStr(row['municipality'] || row['city']),
          provinceCode: safeStr(row['province'] || row['prov']),
          postalCode: safeStr(row['postalcode']),
          latitude: safeFloat(row['latitude'] || row['lat']),
          longitude: safeFloat(row['longitude'] || row['lon'] || row['lng']),
          languageOfService: safeStr(row['languageofservice']),
          dataSource: safeStr(row['datasource']),
          hash: await computeHash(`odhf-${i}-${row['facilityname'] || i}`, 'sha256'),
          sourceUrl: db.csvUrl,
          ingestedAt: now,
        });
      } catch (e) {
        errors.push(`ODHF row ${i}: ${e instanceof Error ? e.message : 'parse error'}`);
      }
    }
  } catch (e) {
    errors.push(`ODHF parse: ${e instanceof Error ? e.message : 'unknown'}`);
  }
  return { records, errors };
}

/** Ingests ODB metadata from CKAN */
async function ingestOdb(): Promise<{ records: LodeBuilding[]; errors: string[] }> {
  const records: LodeBuilding[] = [];
  const errors: string[] = [];
  const now = new Date().toISOString();
  const db = LODE_DATABASES.ODB;
  if (db.ckanId) {
    const data = await fetchJson(`https://open.canada.ca/data/api/3/action/package_show?id=${db.ckanId}`);
    if (data?.result) {
      const pkg = data.result;
      records.push({
        id: await computeHash(`odb-summary`, 'sha256'),
        buildingId: 'summary',
        name: pkg.title || db.name,
        address: null, municipality: null, provinceCode: null, postalCode: null,
        latitude: null, longitude: null, buildingType: null,
        floors: null, yearBuilt: null, footprintAreaM2: null,
        sourceDataset: db.name, primaryUse: null,
        hash: await computeHash(`odb-${pkg.id}`, 'sha256'),
        sourceUrl: `https://open.canada.ca/data/en/dataset/${pkg.id}`,
        ingestedAt: now,
      });
      for (const res of pkg.resources || []) {
        records.push({
          id: await computeHash(`odb-res-${res.id}`, 'sha256'),
          buildingId: res.id,
          name: res.name || db.name,
          address: null, municipality: null, provinceCode: null, postalCode: null,
          latitude: null, longitude: null,
          buildingType: `${res.format} Resource`,
          floors: null, yearBuilt: null, footprintAreaM2: null,
          sourceDataset: res.name || 'ODB Resource', primaryUse: null,
          hash: await computeHash(`odb-${res.id}`, 'sha256'),
          sourceUrl: res.url || '',
          ingestedAt: now,
        });
      }
    }
  }
  return { records, errors };
}

/** Generates metadata records for databases without direct CSV download */
async function ingestLodeDatabase(db: LodeDatabaseInfo): Promise<{ records: LodeRecord[]; errors: string[] }> {
  const records: LodeRecord[] = [];
  const now = new Date().toISOString();
  const baseRecord = {
    id: await computeHash(`${db.id}-metadata`, 'sha256'),
    hash: await computeHash(`${db.id}-v${db.version}`, 'sha256'),
    sourceUrl: db.metadataUrl || '',
    ingestedAt: now,
  };

  switch (db.id) {
    case 'oda':
      records.push({ ...baseRecord, civicNumber: null, streetName: null, streetType: null, municipality: null, provinceCode: null, postalCode: null, latitude: null, longitude: null, fullAddress: `[${db.name}] ${(db.recordCount / 1_000_000).toFixed(0)}M addresses` } as LodeAddress);
      break;
    case 'odrsf':
      records.push({ ...baseRecord, name: db.name, facilityType: 'recreational_facility', address: null, municipality: null, provinceCode: null, postalCode: null, latitude: null, longitude: null, indoorOutdoor: null, iceSurface: null } as LodeRecreationalFacility);
      break;
    case 'odef':
      records.push({ ...baseRecord, name: db.name, institutionType: 'educational_facility', address: null, municipality: null, provinceCode: null, postalCode: null, latitude: null, longitude: null, languageOfInstruction: null, gradeRange: null, schoolAuthority: null } as LodeEducationalFacility);
      break;
    case 'odcaf':
      records.push({ ...baseRecord, name: db.name, facilityType: 'cultural_facility', address: null, municipality: null, provinceCode: null, postalCode: null, latitude: null, longitude: null } as LodeCulturalFacility);
      break;
    case 'odbusiness':
      records.push({ ...baseRecord, name: db.name, naicsCode: null, naicsDescription: null, address: null, municipality: null, provinceCode: null, postalCode: null, latitude: null, longitude: null, employmentSize: null, revenueRange: null } as LodeBusiness);
      break;
    case 'odi':
      records.push({ ...baseRecord, name: db.name, infraType: 'infrastructure_database', subType: null, location: null, municipality: null, provinceCode: null, latitude: null, longitude: null, status: null, yearBuilt: null, capacity: null } as LodeInfrastructure);
      break;
    case 'odg':
      records.push({ ...baseRecord, polygonId: null, areaM2: null, location: null, municipality: null, provinceCode: null, latitude: null, longitude: null, detectionMethod: null, version: db.version } as LodeGreenhouse);
      break;
    case 'cpnd':
      records.push({ ...baseRecord, segmentId: null, pedestrianType: 'pedestrian_database', surfaceMaterial: null, widthM: null, lengthM: null, municipality: null, provinceCode: null, sourceMunicipality: null } as LodePedestrianNetwork);
      break;
    case 'cptnd':
      records.push({ ...baseRecord, stopId: null, stopName: db.name, stopType: 'transit_database', latitude: null, longitude: null, municipality: null, provinceCode: null, agencyName: null, routesServed: null, wheelchairAccessible: null } as LodeTransitStop);
      break;
    case 'ccnd':
      records.push({ ...baseRecord, segmentId: null, canBicsClassification: null, lengthM: null, widthM: null, surfaceType: null, municipality: null, provinceCode: null, sourceMunicipality: null, protected: null } as LodeCyclingNetwork);
      break;
  }
  return { records, errors: [] };
}

export async function ingestLodeDatabaseById(databaseId: string): Promise<LodeIngestionResult> {
  const start = Date.now();
  const db = Object.values(LODE_DATABASES).find(d => d.id === databaseId);
  if (!db) return { source: `lode-${databaseId}`, databaseId, recordsFound: 0, recordsIngested: 0, errors: [`Unknown LODE database: ${databaseId}`], durationMs: Date.now() - start };

  try {
    let result: { records: LodeRecord[]; errors: string[] };
    switch (databaseId) {
      case 'odhf': result = await ingestOdhf(); break;
      case 'odb': result = await ingestOdb(); break;
      default: result = await ingestLodeDatabase(db); break;
    }
    return { source: `lode-${databaseId}`, databaseId, recordsFound: result.records.length, recordsIngested: result.records.length, errors: result.errors, durationMs: Date.now() - start };
  } catch (e) {
    return { source: `lode-${databaseId}`, databaseId, recordsFound: 0, recordsIngested: 0, errors: [e instanceof Error ? e.message : 'unknown'], durationMs: Date.now() - start };
  }
}

export async function ingestAllLode(): Promise<LodeIngestionResult[]> {
  const results: LodeIngestionResult[] = [];
  for (const db of Object.values(LODE_DATABASES)) {
    results.push(await ingestLodeDatabaseById(db.id));
  }
  return results;
}

export async function searchLode(params: LodeSearchParams): Promise<LodeSearchResult> {
  const start = Date.now();
  const databasesToSearch = params.databaseId
    ? [Object.values(LODE_DATABASES).find(d => d.id === params.databaseId)].filter(Boolean)
    : Object.values(LODE_DATABASES);
  const allRecords: LodeRecord[] = [];
  for (const db of databasesToSearch) {
    if (!db) continue;
    const result = await ingestLodeDatabaseById(db.id);
    allRecords.push(...result.errors.map(err => ({ id: `error-${db.id}`, hash: '', sourceUrl: db.metadataUrl || '', ingestedAt: new Date().toISOString() } as unknown as LodeRecord)));
  }
  return { database: params.databaseId || 'all', databaseId: params.databaseId || 'all', records: allRecords, total: allRecords.length, durationMs: Date.now() - start };
}

export function listLodeDatabases(): LodeDatabaseInfo[] {
  return Object.values(LODE_DATABASES);
}

export function getLodeDatabaseInfo(id: string): LodeDatabaseInfo | undefined {
  return LODE_DATABASES[id.toUpperCase()];
}
