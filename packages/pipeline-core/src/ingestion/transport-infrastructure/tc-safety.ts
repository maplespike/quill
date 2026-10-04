/**
 * Transport Canada Safety Connector — Quill
 *
 * Fetches Transport Canada safety data:
 *   - Vehicle safety recalls
 *   - Violations and penalties
 *   - Audits and compliance actions
 *   - Fines and enforcement
 *
 * Primary data sources:
 *   - CKAN package_search for Transport Canada recall datasets
 *   - CKAN package_show for dataset resource discovery
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  TRANSPORT_SOURCES,
  TC_SAFETY_DATASETS,
  TransportInfrastructureFetchError,
  DEFAULT_MAX_RECORDS,
  CKAN_SEARCH_LIMIT,
  TRANSPORT_SOURCE_NAMES,
} from './constants.js';
import type { TcRecall, TcViolationAudit, TransportInfrastructureIngestionResult } from './types.js';

import { parseCsvLine } from '../../utils/csv.js';
/* ------------------------------------------------------------------ */
/*  CKAN Search for Transport Canada Safety Datasets                  */
/* ------------------------------------------------------------------ */

interface CkanSearchResult {
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
    }>;
  };
}

interface CkanPackageResult {
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
 * Search CKAN for Transport Canada safety datasets.
 */
export async function searchCkanTcDatasets(
  query = 'transport canada recalls safety',
  limit = CKAN_SEARCH_LIMIT,
): Promise<CkanSearchResult['result']['results']> {
  const url = `${TRANSPORT_SOURCES.CKAN.SEARCH}?q=${encodeURIComponent(query)}&rows=${limit}`;

  try {
    const resp = await httpGet(url, { headers: { Accept: 'application/json' }, timeoutMs: 20_000 });
    if (resp.statusCode >= 400) throw new Error(`CKAN HTTP ${resp.statusCode}`);

    const parsed = await resp.json<CkanSearchResult>();
    if (!parsed.success) throw new Error('CKAN API error');

    return parsed.result.results;
  } catch (err) {
    throw new TransportInfrastructureFetchError(
      err instanceof Error ? err.message : String(err),
      'ckan-tc-search',
      url,
    );
  }
}

/**
 * Fetch a CKAN package by ID.
 */
export async function fetchTcCkanPackage(datasetId: string): Promise<CkanPackageResult['result'] | null> {
  const url = `${TRANSPORT_SOURCES.CKAN.SHOW}?id=${datasetId}`;

  try {
    const resp = await httpGet(url, { headers: { Accept: 'application/json' }, timeoutMs: 20_000 });
    if (resp.statusCode >= 400) return null;

    const parsed = await resp.json<CkanPackageResult>();
    if (!parsed.success) return null;

    return parsed.result;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  CSV Parsing Helper                                                 */


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
/*  Vehicle Safety Recalls                                             */
/* ------------------------------------------------------------------ */

/**
 * Parse a vehicle recall record from CKAN resource data.
 */
function parseRecallRow(
  row: Record<string, unknown>,
  sourceUrl: string,
  ckanDatasetId: string,
): TcRecall | null {
  const recallNum = (row.recall_number ?? row['Recall Number'] ?? row.RECALL_NUMBER
    ?? row['Recall No'] ?? '') as string;
  if (!recallNum && !row.make && !row['Make']) return null;

  return {
    id: `tc-recall-${recallNum || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`,
    recallNumber: recallNum || null,
    make: ((row.make ?? row['Make'] ?? row.MAKE ?? '') as string) || null,
    model: ((row.model ?? row['Model'] ?? row.MODEL ?? '') as string) || null,
    yearRange: ((row.year_range ?? row['Year Range'] ?? row.YEAR_RANGE
      ?? row['Model Year'] ?? '') as string) || null,
    unitsAffected: parseInt((row.units_affected ?? row['Units Affected'] ?? row.UNITS_AFFECTED
      ?? row['Number of Vehicles'] ?? '0') as string, 10) || null,
    component: ((row.component ?? row['Component'] ?? row.COMPONENT
      ?? row['System'] ?? '') as string) || null,
    hazard: ((row.hazard ?? row['Hazard'] ?? row.HAZARD
      ?? row['Risk'] ?? row['Description'] ?? '') as string) || null,
    correctiveAction: ((row.corrective_action ?? row['Corrective Action'] ?? row.CORRECTIVE_ACTION
      ?? '') as string) || null,
    recallDate: ((row.recall_date ?? row['Recall Date'] ?? row.RECALL_DATE
      ?? row['Date'] ?? '') as string) || null,
    sourceUrl,
    ckanDatasetId,
    ingestedAt: new Date().toISOString(),
  };
}

/**
 * Fetch vehicle safety recalls from CKAN datasets.
 */
export async function fetchTcVehicleRecalls(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<TcRecall[]> {
  const allRecords: TcRecall[] = [];
  const datasetIds = Object.values(TC_SAFETY_DATASETS).map(d => d.id);

  for (const datasetId of datasetIds) {
    if (allRecords.length >= maxRecords) break;

    try {
      const pkg = await fetchTcCkanPackage(datasetId);
      if (!pkg) continue;

      const csvResource = pkg.resources.find(r => r.format?.toLowerCase() === 'csv'
        || r.format?.toLowerCase() === 'json'
        || r.format?.toLowerCase() === 'xlsx');
      if (!csvResource) continue;

      const resp = await httpGet(csvResource.url, { timeoutMs: 30_000 });
      if (resp.statusCode >= 400) continue;

      const contentType = resp.headers['content-type'] ?? '';
      const isJson = csvResource.format?.toLowerCase() === 'json' || contentType.includes('json');

      let rows: Array<Record<string, unknown>> = [];

      if (isJson) {
        const jsonData = await resp.json();
        if (Array.isArray(jsonData)) {
          rows = jsonData as Array<Record<string, unknown>>;
        } else if (typeof jsonData === 'object' && jsonData !== null) {
          const obj = jsonData as Record<string, unknown>;
          const dataArray = Object.values(obj).find(v => Array.isArray(v));
          if (dataArray) rows = dataArray as Array<Record<string, unknown>>;
        }
      } else {
        const csvRows = parseCsvWithHeaders(resp.body);
        rows = csvRows as unknown as Array<Record<string, unknown>>;
      }

      for (const row of rows) {
        if (allRecords.length >= maxRecords) break;
        const record = parseRecallRow(row, csvResource.url, datasetId);
        if (record) allRecords.push(record);
      }
    } catch {
      continue;
    }
  }

  // Compute hashes for unique IDs
  const hashed: TcRecall[] = [];
  for (const r of allRecords) {
    const hash = await computeHash(JSON.stringify({
      recall: r.recallNumber,
      make: r.make,
      model: r.model,
      date: r.recallDate,
    }), 'sha256');
    hashed.push({ ...r, id: hash });
  }

  return hashed;
}

/* ------------------------------------------------------------------ */
/*  TC Violations, Audits, and Fines                                   */
/* ------------------------------------------------------------------ */

/**
 * Parse a TC violation/audit record.
 */
function parseViolationRow(
  row: Record<string, unknown>,
  sourceUrl: string,
): TcViolationAudit | null {
  const type = ((row.type ?? row['Type'] ?? row.TYPE ?? row['Action Type']
    ?? '') as string);
  if (!type) return null;

  return {
    id: `tc-violation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    organization: ((row.organization ?? row['Organization'] ?? row.ORGANIZATION
      ?? row['Company'] ?? row['Name'] ?? '') as string) || null,
    actionDate: ((row.action_date ?? row['Action Date'] ?? row.ACTION_DATE
      ?? row['Date'] ?? row['Date of Action'] ?? '') as string) || null,
    description: ((row.description ?? row['Description'] ?? row.DESCRIPTION
      ?? row['Reason'] ?? row['Violation'] ?? '') as string) || null,
    penaltyAmount: parseFloat((row.penalty_amount ?? row['Penalty Amount'] ?? row.PENALTY_AMOUNT
      ?? row['Fine'] ?? row['Amount'] ?? '0') as string) || null,
    sourceUrl,
    ingestedAt: new Date().toISOString(),
  };
}

/**
 * Fetch TC violation, audit, and fine data from CKAN.
 * Searches for enforcement and compliance datasets.
 */
export async function fetchTcViolationsAudits(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<TcViolationAudit[]> {
  const allRecords: TcViolationAudit[] = [];

  // Search CKAN for enforcement/compliance datasets
  const queries = [
    'transport canada enforcement violations',
    'transport canada compliance audits',
    'transport canada fines penalties',
    'transport canada regulatory enforcement',
  ];

  for (const query of queries) {
    if (allRecords.length >= maxRecords) break;

    try {
      const datasets = await searchCkanTcDatasets(query, CKAN_SEARCH_LIMIT);

      for (const ds of datasets) {
        if (allRecords.length >= maxRecords) break;

        const csvResource = ds.resources.find(r =>
          r.format?.toLowerCase() === 'csv' || r.format?.toLowerCase() === 'json',
        );
        if (!csvResource) continue;

        try {
          const resp = await httpGet(csvResource.url, { timeoutMs: 30_000 });
          if (resp.statusCode >= 400) continue;

          const contentType = resp.headers['content-type'] ?? '';
          const isJson = csvResource.format?.toLowerCase() === 'json' || contentType.includes('json');

          let rows: Array<Record<string, unknown>> = [];

          if (isJson) {
            const jsonData = await resp.json();
            if (Array.isArray(jsonData)) {
              rows = jsonData as Array<Record<string, unknown>>;
            } else if (typeof jsonData === 'object' && jsonData !== null) {
              const obj = jsonData as Record<string, unknown>;
              const dataArray = Object.values(obj).find(v => Array.isArray(v));
              if (dataArray) rows = dataArray as Array<Record<string, unknown>>;
            }
          } else {
            const csvRows = parseCsvWithHeaders(resp.body);
            rows = csvRows as unknown as Array<Record<string, unknown>>;
          }

          for (const row of rows) {
            if (allRecords.length >= maxRecords) break;
            const record = parseViolationRow(row, csvResource.url);
            if (record) allRecords.push(record);
          }
        } catch {
          continue;
        }
      }
    } catch {
      continue;
    }
  }

  // Compute hashes for unique IDs
  const hashed: TcViolationAudit[] = [];
  for (const r of allRecords) {
    const hash = await computeHash(JSON.stringify({
      type: r.type,
      org: r.organization,
      date: r.actionDate,
      amount: r.penaltyAmount,
    }), 'sha256');
    hashed.push({ ...r, id: hash });
  }

  return hashed;
}

/* ------------------------------------------------------------------ */
/*  Search TC Safety Data                                              */
/* ------------------------------------------------------------------ */

/**
 * Search across TC recall data for a term.
 */
export async function searchTcRecalls(
  query: string,
  maxResults = 10,
  existingRecords?: TcRecall[],
): Promise<TcRecall[]> {
  const q = query.toLowerCase();
  const records = existingRecords ?? await fetchTcVehicleRecalls(maxResults);

  return records.filter(r =>
    r.make?.toLowerCase().includes(q) ||
    r.model?.toLowerCase().includes(q) ||
    r.component?.toLowerCase().includes(q) ||
    r.hazard?.toLowerCase().includes(q) ||
    r.recallNumber?.toLowerCase().includes(q),
  ).slice(0, maxResults);
}
