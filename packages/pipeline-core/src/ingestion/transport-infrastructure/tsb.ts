// SPDX-License-Identifier: AGPL-3.0-only
/**
 * TSB Connector — Quill
 *
 * Fetches Transportation Safety Board occurrence data from CKAN
 * and the TSB website.
 *
 * Data sources:
 *   - CKAN package_search for TSB occurrence datasets
 *   - TSB occurrence database at tsb.gc.ca
 *
 * Covers: aviation crashes, train derailments, marine incidents,
 * pipeline occurrences.
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  TRANSPORT_SOURCES,
  TSB_DATASETS,
  TransportInfrastructureFetchError,
  DEFAULT_MAX_RECORDS,
  CKAN_SEARCH_LIMIT,
  TRANSPORT_SOURCE_NAMES,
} from './constants.js';
import type { TsbOccurrence, TransportInfrastructureIngestionResult } from './types.js';

import { parseCsvLine } from '../../utils/csv.js';
/* ------------------------------------------------------------------ */
/*  CKAN Search for TSB Datasets                                      */
/* ------------------------------------------------------------------ */

interface CkanPackageSearchResult {
  success: boolean;
  result: {
    count: number;
    results: Array<{
      id: string;
      title: string;
      notes: string;
      resources: Array<{
        id: string;
        name: string;
        format: string;
        url: string;
        last_modified: string;
      }>;
      organization: { name: string; title: string };
    }>;
  };
}

interface CkanPackageShowResult {
  success: boolean;
  result: {
    id: string;
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

/**
 * Search CKAN for TSB occurrence packages.
 */
export async function searchCkanTsbDatasets(
  query = 'transportation safety board occurrence',
  limit = CKAN_SEARCH_LIMIT,
): Promise<CkanPackageSearchResult['result']['results']> {
  const url = `${TRANSPORT_SOURCES.CKAN.SEARCH}?q=${encodeURIComponent(query)}&rows=${limit}`;

  try {
    const resp = await httpGet(url, { headers: { Accept: 'application/json' }, timeoutMs: 20_000 });
    if (resp.statusCode >= 400) throw new Error(`CKAN HTTP ${resp.statusCode}`);

    const parsed = await resp.json<CkanPackageSearchResult>();
    if (!parsed.success) throw new Error('CKAN API error');

    return parsed.result.results;
  } catch (err) {
    throw new TransportInfrastructureFetchError(
      err instanceof Error ? err.message : String(err),
      'ckan-tsb-search',
      url,
    );
  }
}

/**
 * Fetch a CKAN package by ID to discover available resources.
 */
export async function fetchCkanPackage(datasetId: string): Promise<CkanPackageShowResult['result'] | null> {
  const url = `${TRANSPORT_SOURCES.CKAN.SHOW}?id=${datasetId}`;

  try {
    const resp = await httpGet(url, { headers: { Accept: 'application/json' }, timeoutMs: 20_000 });
    if (resp.statusCode >= 400) return null;

    const parsed = await resp.json<CkanPackageShowResult>();
    if (!parsed.success) return null;

    return parsed.result;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Parse TSB Occurrence from CKAN Resource Data                      */
/* ------------------------------------------------------------------ */

/**
 * Parse TSB occurrence records from a raw data array.
 * CKAN TSB resources may contain CSV rows, JSON records,
 * or tabular data depending on the resource format.
 *
 * This handles the common CSV export format with these columns:
 *   occurrence_number, mode, category, status, date, location,
 *   province, latitude, longitude, fatalities, injuries,
 *   make, model, registration, operator, event_types, narrative
 */
function parseTsbOccurrenceRow(
  row: Record<string, unknown>,
  sourceUrl: string,
  ckanDatasetId: string,
): TsbOccurrence | null {
  const occNum = (row.occurrence_number ?? row['Occurrence Number'] ?? row.OCCURRENCE_NUMBER ?? '') as string;
  if (!occNum) return null;

  const modeStr = ((row.mode ?? row['Mode'] ?? row.MODE ?? '') as string).toLowerCase();

  let mode: TsbOccurrence['mode'] = 'aviation';
  if (modeStr.includes('rail') || modeStr.includes('train')) mode = 'rail';
  else if (modeStr.includes('marine') || modeStr.includes('ship') || modeStr.includes('vessel')) mode = 'marine';
  else if (modeStr.includes('pipeline')) mode = 'pipeline';

  return {
    id: `tsb-${occNum}-${ckanDatasetId}`,
    occurrenceNumber: occNum,
    mode,
    category: ((row.category ?? row['Category'] ?? row.CATEGORY ?? '') as string) || '',
    status: ((row.status ?? row['Status'] ?? row.STATUS ?? '') as string) || '',
    occurrenceDate: ((row.occurrence_date ?? row['Date'] ?? row['Occurrence Date']
      ?? row.OCCURRENCE_DATE ?? '') as string) || null,
    location: ((row.location ?? row['Location'] ?? row.LOCATION ?? '') as string) || null,
    province: ((row.province ?? row['Province'] ?? row.PROVINCE ?? '') as string) || null,
    latitude: parseFloat((row.latitude ?? row['Latitude'] ?? row.LATITUDE ?? '') as string) || null,
    longitude: parseFloat((row.longitude ?? row['Longitude'] ?? row.LONGITUDE ?? '') as string) || null,
    fatalities: parseInt((row.fatalities ?? row['Fatalities'] ?? row.FATALITIES ?? '0') as string, 10) || null,
    injuries: parseInt((row.injuries ?? row['Injuries'] ?? row.INJURIES ?? '0') as string, 10) || null,
    make: ((row.make ?? row['Make'] ?? row.MAKE ?? '') as string) || null,
    model: ((row.model ?? row['Model'] ?? row.MODEL ?? '') as string) || null,
    registration: ((row.registration ?? row['Registration'] ?? row.REGISTRATION ?? '') as string) || null,
    operator: ((row.operator ?? row['Operator'] ?? row.OPERATOR ?? '') as string) || null,
    eventTypes: ((row.event_types ?? row['Event Types'] ?? row['EventTypes']
      ?? row.EVENT_TYPES ?? '') as string) || null,
    narrative: ((row.narrative ?? row['Narrative'] ?? row['Description']
      ?? row.NARRATIVE ?? '') as string) || null,
    sourceUrl,
    ckanDatasetId,
    ingestedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/*  CSV Parsing Helper                                                 */
/* ------------------------------------------------------------------ */



/**
 * Parse CSV text into rows with headers.
 */
function parseCsvWithHeaders(content: string): Array<Record<string, string>> {
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
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
/*  Fetch TSB Occurrences from CKAN Resource URLs                      */
/* ------------------------------------------------------------------ */

/**
 * Fetch TSB occurrence data by querying CKAN and downloading
 * the first CSV/JSON resource found.
 */
export async function fetchTsbOccurrences(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<TsbOccurrence[]> {
  const allRecords: TsbOccurrence[] = [];
  const datasetIds = Object.values(TSB_DATASETS).map(d => d.id);

  for (const datasetId of datasetIds) {
    if (allRecords.length >= maxRecords) break;

    try {
      const pkg = await fetchCkanPackage(datasetId);
      if (!pkg) continue;

      // Find first CSV or JSON resource
      const csvResource = pkg.resources.find(r =>
        r.format?.toLowerCase() === 'csv' || r.format?.toLowerCase() === 'json',
      );
      if (!csvResource) continue;

      const resp = await httpGet(csvResource.url, { timeoutMs: 30_000 });
      if (resp.statusCode >= 400) continue;

      const contentType = resp.headers['content-type'] ?? '';
      const isJson = csvResource.format?.toLowerCase() === 'json'
        || contentType.includes('json');

      let rows: Array<Record<string, unknown>> = [];

      if (isJson) {
        const jsonData = await resp.json();
        // Handle both array and {data: [...]} formats
        if (Array.isArray(jsonData)) {
          rows = jsonData as Array<Record<string, unknown>>;
        } else if (typeof jsonData === 'object' && jsonData !== null) {
          const obj = jsonData as Record<string, unknown>;
          const dataArray = Object.values(obj).find(v => Array.isArray(v)) as Array<Record<string, unknown>> | undefined;
          if (dataArray) rows = dataArray;
        }
      } else {
        const csvRows = parseCsvWithHeaders(resp.body);
        rows = csvRows as unknown as Array<Record<string, unknown>>;
      }

      for (const row of rows) {
        if (allRecords.length >= maxRecords) break;
        const record = parseTsbOccurrenceRow(row, csvResource.url, datasetId);
        if (record) {
          record.id = `tsb-${datasetId.slice(0, 8)}-${record.occurrenceNumber}`;
          allRecords.push(record);
        }
      }
    } catch {
      // Skip datasets that fail — try the next one
      continue;
    }
  }

  // Compute hashes for unique IDs
  const hashed: TsbOccurrence[] = [];
  for (const r of allRecords) {
    const hash = await computeHash(JSON.stringify({
      occ: r.occurrenceNumber,
      mode: r.mode,
      date: r.occurrenceDate,
      location: r.location,
    }), 'sha256');
    hashed.push({ ...r, id: hash });
  }

  return hashed;
}

/* ------------------------------------------------------------------ */
/*  Fetch TSB Occurrence Detail Page (HTML)                            */
/* ------------------------------------------------------------------ */

/**
 * Fetch detail about a specific occurrence from the TSB website.
 * Returns the HTML as text for parsing.
 */
export async function fetchTsbOccurrenceDetail(
  occurrenceNumber: string,
): Promise<string | null> {
  const url = TRANSPORT_SOURCES.TSB.OCCURRENCE_DETAIL(occurrenceNumber);

  try {
    const resp = await httpGet(url, { timeoutMs: 15_000 });
    if (resp.statusCode >= 400) return null;
    return resp.body;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Search TSB Occurrences                                             */
/* ------------------------------------------------------------------ */

/**
 * Search across fetched TSB occurrence records for a term.
 * Note: This searches in-memory data; production should use database search.
 */
export async function searchTsbOccurrences(
  query: string,
  maxResults = 10,
  existingRecords?: TsbOccurrence[],
): Promise<TsbOccurrence[]> {
  const q = query.toLowerCase();
  const records = existingRecords ?? await fetchTsbOccurrences(maxResults);

  return records.filter(r =>
    r.occurrenceNumber.toLowerCase().includes(q) ||
    r.location?.toLowerCase().includes(q) ||
    r.province?.toLowerCase().includes(q) ||
    r.operator?.toLowerCase().includes(q) ||
    r.narrative?.toLowerCase().includes(q) ||
    r.eventTypes?.toLowerCase().includes(q) ||
    r.make?.toLowerCase().includes(q) ||
    r.model?.toLowerCase().includes(q),
  ).slice(0, maxResults);
}

/* ------------------------------------------------------------------ */
/*  Summary Stats                                                      */
/* ------------------------------------------------------------------ */

/**
 * Compute summary statistics for a set of TSB occurrences.
 */
export function computeTsbStats(
  occurrences: TsbOccurrence[],
): {
  total: number;
  byMode: Record<string, number>;
  byCategory: Record<string, number>;
  byProvince: Record<string, number>;
  totalFatalities: number;
  totalInjuries: number;
} {
  const total = occurrences.length;
  const byMode: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byProvince: Record<string, number> = {};

  let totalFatalities = 0;
  let totalInjuries = 0;

  for (const o of occurrences) {
    byMode[o.mode] = (byMode[o.mode] ?? 0) + 1;
    byCategory[o.category] = (byCategory[o.category] ?? 0) + 1;
    if (o.province) byProvince[o.province] = (byProvince[o.province] ?? 0) + 1;
    totalFatalities += o.fatalities ?? 0;
    totalInjuries += o.injuries ?? 0;
  }

  return { total, byMode, byCategory, byProvince, totalFatalities, totalInjuries };
}
