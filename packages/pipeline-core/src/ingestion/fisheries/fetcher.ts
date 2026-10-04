/**
 * Fisheries Fetcher — Quill
 *
 * Fetches Canadian fisheries and oceans data from CKAN portals.
 * Handles CSV parsing and JSON resource extraction.
 *
 * Data sources:
 *   - DFO fish stocks, salmon catch, groundfish, shellfish
 *   - Aquaculture licences and production
 *   - Canadian Coast Guard incidents and search/rescue
 *   - Marine protected areas
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  CKAN_API,
  DFO_SEARCH_QUERIES,
  DFO_DATASETS,
  AQUACULTURE_QUERIES,
  AQUACULTURE_DATASETS,
  COAST_GUARD_QUERIES,
  COAST_GUARD_DATASETS,
  MPA_QUERIES,
  MPA_DATASETS,
  FISHERIES_SOURCE_NAMES,
  DEFAULT_MAX_RECORDS,
  CKAN_SEARCH_LIMIT,
  REQUEST_TIMEOUT_MS,
} from './constants.js';
import type { FisheriesRecord } from './types.js';

import { parseCsvLine } from '../../utils/csv.js';
/* ------------------------------------------------------------------ */
/*  CKAN Response Interfaces                                          */
/* ------------------------------------------------------------------ */

interface CkanSearchResult {
  success: boolean;
  result: {
    count: number;
    results: Array<{
      id: string;
      name: string;
      title: string;
      notes: string;
      metadata_created: string;
      metadata_modified: string;
      organization: { name: string; title: string } | null;
      resources: Array<{
        id: string;
        name: string;
        format: string;
        url: string;
        last_modified: string;
      }>;
    }>;
  };
}

interface CkanPackageResult {
  success: boolean;
  result: {
    id: string;
    name: string;
    title: string;
    notes: string;
    resources: Array<{
      id: string;
      name: string;
      format: string;
      url: string;
      last_modified: string;
    }>;
  };
}

/* ------------------------------------------------------------------ */
/*  CKAN Helpers                                                       */
/* ------------------------------------------------------------------ */

async function searchCkan(query: string, rows = CKAN_SEARCH_LIMIT): Promise<CkanSearchResult['result']['results']> {
  const url = `${CKAN_API.SEARCH}?q=${encodeURIComponent(query)}&rows=${rows}`;
  const resp = await httpGet(url, {
    headers: { Accept: 'application/json' },
    timeoutMs: REQUEST_TIMEOUT_MS,
  });
  if (resp.statusCode >= 400) {
    throw new Error(`CKAN search HTTP ${resp.statusCode} for: ${query}`);
  }
  const parsed = await resp.json<CkanSearchResult>();
  if (!parsed.success) throw new Error(`CKAN search error for: ${query}`);
  return parsed.result.results;
}

async function fetchCkanPackage(packageId: string): Promise<CkanPackageResult['result'] | null> {
  const url = `${CKAN_API.SHOW}?id=${packageId}`;
  try {
    const resp = await httpGet(url, {
      headers: { Accept: 'application/json' },
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
    if (resp.statusCode >= 400) return null;
    const parsed = await resp.json<CkanPackageResult>();
    if (!parsed.success) return null;
    return parsed.result;
  } catch {
    return null;
  }
}

async function downloadCkanResource(url: string): Promise<Array<Record<string, unknown>>> {
  const resp = await httpGet(url, { timeoutMs: REQUEST_TIMEOUT_MS });
  if (resp.statusCode >= 400) return [];

  const contentType = resp.headers['content-type'] ?? '';
  const isJson = contentType.includes('json') || url.endsWith('.json');

  if (isJson) {
    const jsonData = await resp.json();
    if (Array.isArray(jsonData)) return jsonData as Array<Record<string, unknown>>;
    if (typeof jsonData === 'object' && jsonData !== null) {
      const obj = jsonData as Record<string, unknown>;
      const dataArray = Object.values(obj).find(v => Array.isArray(v)) as Array<Record<string, unknown>> | undefined;
      if (dataArray) return dataArray;
    }
    return [];
  }

  return parseCsvWithHeaders(resp.body);
}

/* ------------------------------------------------------------------ */
/*  CSV Parser                                                         */


function parseCsvWithHeaders(content: string): Array<Record<string, string>> {
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(h =>
    h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  );
  const results: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.length === 0) continue;
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length && j < fields.length; j++) {
      row[headers[j]] = fields[j];
    }
    results.push(row);
  }
  return results;
}

/* ------------------------------------------------------------------ */
/*  Data Extraction Helpers                                            */
/* ------------------------------------------------------------------ */

function extractString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const val = row[key];
    if (val !== undefined && val !== null && val !== '') return String(val);
    for (const [k, v] of Object.entries(row)) {
      if (k.toLowerCase() === key.toLowerCase() && v !== undefined && v !== null && v !== '') return String(v);
    }
  }
  return '';
}

function extractYear(row: Record<string, unknown>): number {
  const val = extractString(row, ['year', 'ref_year', 'reference_year', 'fiscal_year', 'season', 'date', 'period']);
  if (!val) return new Date().getFullYear();
  const parsed = parseInt(val, 10);
  if (!isNaN(parsed) && parsed > 1900 && parsed < 2100) return parsed;
  const matches = val.match(/\b(19|20)\d{2}\b/);
  if (matches) return parseInt(matches[0], 10);
  return new Date().getFullYear();
}

function extractNumeric(row: Record<string, unknown>, ...keySets: string[][]): number {
  for (const keys of keySets) {
    for (const key of keys) {
      const val = row[key];
      if (val !== undefined && val !== null && val !== '') {
        const parsed = typeof val === 'number' ? val : parseFloat(String(val).replace(/[$,]/g, ''));
        if (!isNaN(parsed)) return parsed;
      }
      for (const [k, v] of Object.entries(row)) {
        if (k.toLowerCase() === key.toLowerCase() && v !== undefined && v !== null && v !== '') {
          const parsed = typeof v === 'number' ? v : parseFloat(String(v).replace(/[$,]/g, ''));
          if (!isNaN(parsed)) return parsed;
        }
      }
    }
  }
  return 0;
}

/* ------------------------------------------------------------------ */
/*  Fetch from Dataset Helper                                          */
/* ------------------------------------------------------------------ */

async function fetchFromDataset(
  datasetId: string,
  sourceName: string,
  maxRecords: number,
): Promise<FisheriesRecord[]> {
  const records: FisheriesRecord[] = [];
  const now = new Date().toISOString();

  const pkg = await fetchCkanPackage(datasetId);
  if (!pkg) return [];

  const resource = pkg.resources.find(r =>
    r.format?.toLowerCase() === 'csv' ||
    r.format?.toLowerCase() === 'json' ||
    r.url.endsWith('.csv') ||
    r.url.endsWith('.json')
  );
  if (!resource) return [];

  const rows = await downloadCkanResource(resource.url);

  for (const row of rows) {
    if (records.length >= maxRecords) break;
    const year = extractYear(row);
    const value = extractNumeric(row, ['value', 'catch', 'landings', 'production', 'volume', 'amount']);
    const category = extractString(row, ['category', 'type', 'fishery_type', 'sector']) || sourceName;
    const subCategory = extractString(row, ['sub_category', 'subcategory', 'gear_type', 'method']) || '';
    const description = extractString(row, ['description', 'notes', 'title', 'name']) || pkg.title;
    const region = extractString(row, ['region', 'province', 'area', 'location', 'zone', 'fishing_area']) || 'Canada';
    const species = extractString(row, ['species', 'species_name', 'species_en', 'common_name', 'stock']) || '';
    const unit = extractString(row, ['unit', 'units', 'uom', 'measure']) || 'kg';

    const hash = await computeHash(
      JSON.stringify({ datasetId, sourceName, year, category, value, region, species }),
      'sha256',
    );

    records.push({
      id: hash, year, category, subCategory, value, unit,
      description, region, species,
      sourceUrl: resource.url, sourceName, ingestedAt: now,
    });
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Search CKAN + Parse Generic Rows                                   */
/* ------------------------------------------------------------------ */

async function searchAndFetch(
  query: string,
  datasets: Record<string, { id: string; title: string; description: string }>,
  sourceName: string,
  maxRecords: number,
): Promise<FisheriesRecord[]> {
  const records: FisheriesRecord[] = [];
  const now = new Date().toISOString();

  try {
    const packages = await searchCkan(query, CKAN_SEARCH_LIMIT);
    for (const pkg of packages.slice(0, 5)) {
      if (records.length >= maxRecords) break;
      const csvResource = pkg.resources.find(r =>
        r.format?.toLowerCase() === 'csv' || r.url.endsWith('.csv')
      );
      if (!csvResource) continue;

      try {
        const rows = await downloadCkanResource(csvResource.url);
        for (const row of rows) {
          if (records.length >= maxRecords) break;
          const hash = await computeHash(
            JSON.stringify({ source: sourceName, package: pkg.id, row }),
            'sha256',
          );
          records.push({
            id: hash,
            year: extractYear(row),
            category: sourceName,
            subCategory: extractString(row, ['type', 'gear', 'fishery']) || '',
            value: extractNumeric(row, ['value', 'catch', 'landings', 'production', 'volume']),
            unit: extractString(row, ['unit', 'uom']) || 'kg',
            description: extractString(row, ['description', 'title', 'notes', 'species']) || pkg.title,
            region: extractString(row, ['region', 'province', 'area', 'zone']) || 'Canada',
            species: extractString(row, ['species', 'species_name', 'common_name', 'stock']) || '',
            sourceUrl: csvResource.url,
            sourceName,
            ingestedAt: now,
          });
        }
      } catch {
        continue;
      }
    }
  } catch {
    for (const dataset of Object.values(datasets)) {
      if (records.length >= maxRecords) break;
      const fetched = await fetchFromDataset(dataset.id, sourceName, maxRecords - records.length);
      records.push(...fetched);
    }
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Source-Specific Fetch Functions                                    */
/* ------------------------------------------------------------------ */

export async function fetchFishStocks(maxRecords = DEFAULT_MAX_RECORDS): Promise<FisheriesRecord[]> {
  return searchAndFetch(DFO_SEARCH_QUERIES.FISH_STOCKS, DFO_DATASETS, FISHERIES_SOURCE_NAMES.DFO_FISH_STOCKS, maxRecords);
}

export async function fetchSalmonData(maxRecords = DEFAULT_MAX_RECORDS): Promise<FisheriesRecord[]> {
  return searchAndFetch(DFO_SEARCH_QUERIES.SALMON, DFO_DATASETS, FISHERIES_SOURCE_NAMES.DFO_SALMON, maxRecords);
}

export async function fetchGroundfishData(maxRecords = DEFAULT_MAX_RECORDS): Promise<FisheriesRecord[]> {
  return searchAndFetch(DFO_SEARCH_QUERIES.GROUNDFISH, DFO_DATASETS, FISHERIES_SOURCE_NAMES.DFO_GROUNDFISH, maxRecords);
}

export async function fetchShellfishData(maxRecords = DEFAULT_MAX_RECORDS): Promise<FisheriesRecord[]> {
  return searchAndFetch(DFO_SEARCH_QUERIES.SHELLFISH, DFO_DATASETS, FISHERIES_SOURCE_NAMES.DFO_SHELLFISH, maxRecords);
}

export async function fetchAquacultureData(maxRecords = DEFAULT_MAX_RECORDS): Promise<FisheriesRecord[]> {
  return searchAndFetch(AQUACULTURE_QUERIES.LICENCES, AQUACULTURE_DATASETS, FISHERIES_SOURCE_NAMES.AQUACULTURE, maxRecords);
}

export async function fetchCoastGuardData(maxRecords = DEFAULT_MAX_RECORDS): Promise<FisheriesRecord[]> {
  return searchAndFetch(COAST_GUARD_QUERIES.INCIDENTS, COAST_GUARD_DATASETS, FISHERIES_SOURCE_NAMES.COAST_GUARD, maxRecords);
}

export async function fetchMarineProtectedAreas(maxRecords = DEFAULT_MAX_RECORDS): Promise<FisheriesRecord[]> {
  return searchAndFetch(MPA_QUERIES.MARINE_PROTECTED, MPA_DATASETS, FISHERIES_SOURCE_NAMES.MARINE_PROTECTED_AREAS, maxRecords);
}

/* ------------------------------------------------------------------ */
/*  Combined Fetch Function                                            */
/* ------------------------------------------------------------------ */

export async function fetchAllFisheries(
  maxRecordsPerSource = DEFAULT_MAX_RECORDS,
): Promise<Record<string, FisheriesRecord[]>> {
  const results: Record<string, FisheriesRecord[]> = {};

  const runners = [
    fetchFishStocks(maxRecordsPerSource).then(r => { results[FISHERIES_SOURCE_NAMES.DFO_FISH_STOCKS] = r; }),
    fetchSalmonData(maxRecordsPerSource).then(r => { results[FISHERIES_SOURCE_NAMES.DFO_SALMON] = r; }),
    fetchGroundfishData(maxRecordsPerSource).then(r => { results[FISHERIES_SOURCE_NAMES.DFO_GROUNDFISH] = r; }),
    fetchShellfishData(maxRecordsPerSource).then(r => { results[FISHERIES_SOURCE_NAMES.DFO_SHELLFISH] = r; }),
    fetchAquacultureData(maxRecordsPerSource).then(r => { results[FISHERIES_SOURCE_NAMES.AQUACULTURE] = r; }),
    fetchCoastGuardData(maxRecordsPerSource).then(r => { results[FISHERIES_SOURCE_NAMES.COAST_GUARD] = r; }),
    fetchMarineProtectedAreas(maxRecordsPerSource).then(r => { results[FISHERIES_SOURCE_NAMES.MARINE_PROTECTED_AREAS] = r; }),
  ];

  await Promise.allSettled(runners);
  return results;
}
