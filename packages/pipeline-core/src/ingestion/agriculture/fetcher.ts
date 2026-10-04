/**
 * Agriculture Fetcher — Quill
 *
 * Fetches Canadian agriculture data from CKAN portals and agency websites.
 * Handles CSV parsing and JSON resource extraction from CKAN packages.
 *
 * Data sources:
 *   - Agriculture & Agri-Food Canada (AAFC): crops, livestock, farm income
 *   - Canadian Dairy Commission / Poultry: dairy, poultry, quota data
 *   - CFIA: food recalls, imported food inspections
 *   - Canadian Grain Commission: grain exports, production, quality
 *   - Farm Credit Canada: annual reports (HTML)
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  CKAN_API,
  AAFC_SEARCH_QUERIES,
  AAFC_DATASETS,
  DAIRY_POULTRY_QUERIES,
  DAIRY_POULTRY_DATASETS,
  CFIA_QUERIES,
  CFIA_DATASETS,
  GRAIN_QUERIES,
  GRAIN_DATASETS,
  FCC,
  AGRICULTURE_SOURCE_NAMES,
  DEFAULT_MAX_RECORDS,
  CKAN_SEARCH_LIMIT,
  REQUEST_TIMEOUT_MS,
} from './constants.js';
import type { AgricultureRecord } from './types.js';

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

/**
 * Search CKAN for packages matching a query.
 * Returns the raw results array from the CKAN response.
 */
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
  if (!parsed.success) {
    throw new Error(`CKAN search error for: ${query}`);
  }
  return parsed.result.results;
}

/**
 * Fetch a CKAN package by its ID to discover available resources.
 */
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

/**
 * Download a resource (CSV or JSON) from a CKAN resource URL and parse it
 * into an array of Record<string, unknown> rows.
 */
async function downloadCkanResource(url: string): Promise<Array<Record<string, unknown>>> {
  const resp = await httpGet(url, { timeoutMs: REQUEST_TIMEOUT_MS });
  if (resp.statusCode >= 400) return [];

  const contentType = resp.headers['content-type'] ?? '';
  const isJson = contentType.includes('json') || url.endsWith('.json');

  if (isJson) {
    const jsonData = await resp.json();
    if (Array.isArray(jsonData)) {
      return jsonData as Array<Record<string, unknown>>;
    }
    if (typeof jsonData === 'object' && jsonData !== null) {
      const obj = jsonData as Record<string, unknown>;
      const dataArray = Object.values(obj).find(v => Array.isArray(v)) as Array<Record<string, unknown>> | undefined;
      if (dataArray) return dataArray;
    }
    return [];
  }

  // Treat as CSV
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
/*  Fetch Data from a CKAN Package Dataset                             */
/* ------------------------------------------------------------------ */

/**
 * Generic function to fetch data from a known CKAN dataset.
 * Looks up the dataset by ID, finds CSV/JSON resources, downloads
 * the first one, and parses rows.
 */
async function fetchFromDataset(
  datasetId: string,
  sourceName: string,
  maxRecords: number,
): Promise<AgricultureRecord[]> {
  const records: AgricultureRecord[] = [];
  const now = new Date().toISOString();

  const pkg = await fetchCkanPackage(datasetId);
  if (!pkg) return [];

  // Find first CSV or JSON resource
  const resource = pkg.resources.find(r =>
    r.format?.toLowerCase() === 'csv' ||
    r.format?.toLowerCase() === 'json' ||
    r.format?.toLowerCase() === 'xlsx' ||
    r.url.endsWith('.csv') ||
    r.url.endsWith('.json')
  );
  if (!resource) return [];

  const rows = await downloadCkanResource(resource.url);
  if (rows.length === 0) return [];

  for (const row of rows) {
    if (records.length >= maxRecords) break;

    const year = extractYear(row);
    const value = extractNumeric(row, ['value']);
    const category = extractString(row, ['category', 'type', 'commodity_type', 'class', 'sector']) || sourceName;
    const subCategory = extractString(row, ['sub_category', 'subcategory', 'sub_type', 'subtype', 'variable']) || '';
    const description = extractString(row, ['description', 'notes', 'title', 'name', 'commodity', 'product']) || '';
    const region = extractString(row, ['region', 'province', 'geo', 'location', 'area']) || 'Canada';
    const commodity = extractString(row, ['commodity', 'commodity_name', 'product', 'crop', 'livestock_type', 'species']) || '';
    const unit = extractString(row, ['unit', 'units', 'uom', 'measure']) || '';

    const hash = await computeHash(
      JSON.stringify({ datasetId, sourceName, year, category, value, region, commodity }),
      'sha256',
    );

    records.push({
      id: hash,
      year,
      category,
      subCategory,
      value,
      unit,
      description,
      region,
      commodity,
      sourceUrl: resource.url,
      sourceName,
      ingestedAt: now,
    });
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Data Extraction Helpers                                            */
/* ------------------------------------------------------------------ */

function extractString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const val = row[key];
    if (val !== undefined && val !== null && val !== '') {
      return String(val);
    }
    // Try case-insensitive
    for (const [k, v] of Object.entries(row)) {
      if (k.toLowerCase() === key.toLowerCase() && v !== undefined && v !== null && v !== '') {
        return String(v);
      }
    }
  }
  return '';
}

function extractYear(row: Record<string, unknown>): number {
  const now = new Date().getFullYear();
  const val = extractString(row, ['year', 'ref_year', 'reference_year', 'fiscal_year', 'crop_year', 'date', 'period']);
  if (!val) return now;
  const parsed = parseInt(val, 10);
  if (!isNaN(parsed) && parsed > 1900 && parsed < 2100) return parsed;
  // Try extracting year from date string
  const matches = val.match(/\b(19|20)\d{2}\b/);
  if (matches) return parseInt(matches[0], 10);
  return now;
}

function extractNumeric(row: Record<string, unknown>, ...keySets: string[][]): number {
  for (const keys of keySets) {
    for (const key of keys) {
      const val = row[key];
      if (val !== undefined && val !== null && val !== '') {
        const parsed = typeof val === 'number' ? val : parseFloat(String(val).replace(/[$,]/g, ''));
        if (!isNaN(parsed)) return parsed;
      }
      // Try case-insensitive
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
/*  Source-Specific Fetch Functions                                    */
/* ------------------------------------------------------------------ */

/**
 * Fetch AAFC crops and livestock data.
 */
export async function fetchAafcData(maxRecords = DEFAULT_MAX_RECORDS): Promise<AgricultureRecord[]> {
  const records: AgricultureRecord[] = [];
  const now = new Date().toISOString();

  // Query CKAN for AAFC datasets
  try {
    const packages = await searchCkan(AAFC_SEARCH_QUERIES.CROPS_LIVESTOCK, CKAN_SEARCH_LIMIT);
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
            JSON.stringify({ source: 'aafc', package: pkg.id, row }),
            'sha256',
          );
          records.push({
            id: hash,
            year: extractYear(row),
            category: 'crops-livestock',
            subCategory: extractString(row, ['commodity_group', 'sector']) || '',
            value: extractNumeric(row, ['value', 'production', 'yield', 'area', 'quantity', 'amount']),
            unit: extractString(row, ['unit', 'uom']) || '',
            description: extractString(row, ['description', 'commodity', 'title', 'notes']) || pkg.title,
            region: extractString(row, ['province', 'region', 'geo']) || 'Canada',
            commodity: extractString(row, ['commodity', 'crop', 'livestock_type']) || '',
            sourceUrl: csvResource.url,
            sourceName: AGRICULTURE_SOURCE_NAMES.AAFC_CROPS,
            ingestedAt: now,
          });
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Fallback: try known dataset IDs
    for (const dataset of Object.values(AAFC_DATASETS)) {
      if (records.length >= maxRecords) break;
      const fetched = await fetchFromDataset(dataset.id, AGRICULTURE_SOURCE_NAMES.AAFC_CROPS, maxRecords - records.length);
      records.push(...fetched);
    }
  }

  return records;
}

/**
 * Fetch dairy and poultry data.
 */
export async function fetchDairyPoultryData(maxRecords = DEFAULT_MAX_RECORDS): Promise<AgricultureRecord[]> {
  const records: AgricultureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const packages = await searchCkan(DAIRY_POULTRY_QUERIES.DAIRY, CKAN_SEARCH_LIMIT);
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
            JSON.stringify({ source: 'dairy-poultry', package: pkg.id, row }),
            'sha256',
          );
          records.push({
            id: hash,
            year: extractYear(row),
            category: 'dairy-poultry',
            subCategory: extractString(row, ['type', 'product_type', 'commodity']) || '',
            value: extractNumeric(row, ['value', 'production', 'shipments', 'quota', 'volume']),
            unit: extractString(row, ['unit', 'uom']) || '',
            description: extractString(row, ['description', 'title', 'notes']) || pkg.title,
            region: extractString(row, ['province', 'region']) || 'Canada',
            commodity: extractString(row, ['commodity', 'product']) || '',
            sourceUrl: csvResource.url,
            sourceName: AGRICULTURE_SOURCE_NAMES.DAIRY_POULTRY,
            ingestedAt: now,
          });
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Fallback to known datasets
    for (const dataset of Object.values(DAIRY_POULTRY_DATASETS)) {
      if (records.length >= maxRecords) break;
      const fetched = await fetchFromDataset(dataset.id, AGRICULTURE_SOURCE_NAMES.DAIRY_POULTRY, maxRecords - records.length);
      records.push(...fetched);
    }
  }

  return records;
}

/**
 * Fetch CFIA food recall and import data.
 */
export async function fetchCfiaData(maxRecords = DEFAULT_MAX_RECORDS): Promise<AgricultureRecord[]> {
  const records: AgricultureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const packages = await searchCkan(CFIA_QUERIES.FOOD_RECALLS, CKAN_SEARCH_LIMIT);
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
            JSON.stringify({ source: 'cfia', package: pkg.id, row }),
            'sha256',
          );
          records.push({
            id: hash,
            year: extractYear(row),
            category: 'food-safety',
            subCategory: extractString(row, ['recall_type', 'reason', 'hazard', 'classification']) || 'recall',
            value: extractNumeric(row, ['value', 'amount', 'quantity']),
            unit: extractString(row, ['unit', 'size', 'package_size']) || '',
            description: extractString(row, ['description', 'product', 'brand', 'title', 'notes']) || pkg.title,
            region: extractString(row, ['province', 'region', 'distribution']) || 'Canada',
            commodity: extractString(row, ['commodity', 'food_type', 'category_en']) || '',
            sourceUrl: csvResource.url,
            sourceName: AGRICULTURE_SOURCE_NAMES.CFIA_RECALLS,
            ingestedAt: now,
          });
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Fallback to known datasets
    for (const dataset of Object.values(CFIA_DATASETS)) {
      if (records.length >= maxRecords) break;
      const fetched = await fetchFromDataset(dataset.id, AGRICULTURE_SOURCE_NAMES.CFIA_RECALLS, maxRecords - records.length);
      records.push(...fetched);
    }
  }

  return records;
}

/**
 * Fetch Canadian Grain Commission export/production data.
 */
export async function fetchGrainData(maxRecords = DEFAULT_MAX_RECORDS): Promise<AgricultureRecord[]> {
  const records: AgricultureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const packages = await searchCkan(GRAIN_QUERIES.EXPORTS, CKAN_SEARCH_LIMIT);
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
            JSON.stringify({ source: 'grain', package: pkg.id, row }),
            'sha256',
          );
          records.push({
            id: hash,
            year: extractYear(row),
            category: 'grains',
            subCategory: extractString(row, ['type', 'class', 'grade']) || '',
            value: extractNumeric(row, ['value', 'volume', 'production', 'exports', 'shipments']),
            unit: extractString(row, ['unit', 'uom']) || 'tonnes',
            description: extractString(row, ['description', 'title', 'notes']) || pkg.title,
            region: extractString(row, ['province', 'region', 'destination', 'origin']) || 'Canada',
            commodity: extractString(row, ['commodity', 'grain_type', 'grain']) || '',
            sourceUrl: csvResource.url,
            sourceName: AGRICULTURE_SOURCE_NAMES.GRAIN_EXPORTS,
            ingestedAt: now,
          });
        }
      } catch {
        continue;
      }
    }
  } catch {
    for (const dataset of Object.values(GRAIN_DATASETS)) {
      if (records.length >= maxRecords) break;
      const fetched = await fetchFromDataset(dataset.id, AGRICULTURE_SOURCE_NAMES.GRAIN_EXPORTS, maxRecords - records.length);
      records.push(...fetched);
    }
  }

  return records;
}

/**
 * Fetch Farm Credit Canada annual report data (HTML).
 * Extracts financial highlights from FCC annual reports page.
 */
export async function fetchFarmCreditCanadaData(maxRecords = DEFAULT_MAX_RECORDS): Promise<AgricultureRecord[]> {
  const records: AgricultureRecord[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(FCC.ANNUAL_REPORTS, { timeoutMs: REQUEST_TIMEOUT_MS });
    if (resp.statusCode >= 400) return [];

    const html = resp.body;
    const yearMatches = html.matchAll(/20\d{2}/g);
    const seenYears = new Set<number>();
    const currentYear = new Date().getFullYear();

    for (const match of yearMatches) {
      if (records.length >= maxRecords) break;
      const year = parseInt(match[0], 10);
      if (year < 2000 || year > currentYear || seenYears.has(year)) continue;
      seenYears.add(year);

      // Extract financial highlights from the page for each year
      const hash = await computeHash(`fcc-annual-report-${year}`, 'sha256');
      records.push({
        id: hash,
        year,
        category: 'farm-credit',
        subCategory: 'annual-report',
        value: 0,
        unit: '',
        description: `Farm Credit Canada Annual Report ${year}`,
        region: 'Canada',
        commodity: '',
        sourceUrl: FCC.ANNUAL_REPORTS,
        sourceName: AGRICULTURE_SOURCE_NAMES.FARM_CREDIT_CANADA,
        ingestedAt: now,
      });
    }
  } catch {
    // Return whatever we have
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Combined Fetch Function                                            */
/* ------------------------------------------------------------------ */

/**
 * Fetch all agriculture data from all sources.
 * Returns a map keyed by source name.
 */
export async function fetchAllAgriculture(
  maxRecordsPerSource = DEFAULT_MAX_RECORDS,
): Promise<Record<string, AgricultureRecord[]>> {
  const results: Record<string, AgricultureRecord[]> = {};

  const runners = [
    fetchAafcData(maxRecordsPerSource).then(r => { results[AGRICULTURE_SOURCE_NAMES.AAFC_CROPS] = r; }),
    fetchDairyPoultryData(maxRecordsPerSource).then(r => { results[AGRICULTURE_SOURCE_NAMES.DAIRY_POULTRY] = r; }),
    fetchCfiaData(maxRecordsPerSource).then(r => { results[AGRICULTURE_SOURCE_NAMES.CFIA_RECALLS] = r; }),
    fetchGrainData(maxRecordsPerSource).then(r => { results[AGRICULTURE_SOURCE_NAMES.GRAIN_EXPORTS] = r; }),
    fetchFarmCreditCanadaData(maxRecordsPerSource).then(r => { results[AGRICULTURE_SOURCE_NAMES.FARM_CREDIT_CANADA] = r; }),
  ];

  await Promise.allSettled(runners);

  return results;
}
