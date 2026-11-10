// SPDX-License-Identifier: AGPL-3.0-only
/**
 * CTA Connector — Quill
 *
 * Fetches Canadian Transportation Agency ruling and decision data.
 *
 * The CTA is the federal tribunal that resolves disputes involving
 * air, rail, and marine transportation. It handles:
 *   - Air travel complaints (flight delays, cancellations, lost baggage)
 *   - Accessibility complaints (barriers for persons with disabilities)
 *   - Regulatory decisions (licensing, determinations, approvals)
 *   - Railway noise and vibration complaints
 *
 * Primary data sources:
 *   - CKAN package_search for CTA ruling datasets
 *   - CKAN package_show for dataset resource discovery
 *   - CTA website rulings portal
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  TRANSPORT_SOURCES,
  CTA_DATASETS,
  TransportInfrastructureFetchError,
  DEFAULT_MAX_RECORDS,
  CKAN_SEARCH_LIMIT,
  TRANSPORT_SOURCE_NAMES,
} from './constants.js';
import type { CtaRuling, TransportInfrastructureIngestionResult } from './types.js';

import { parseCsvLine } from '../../utils/csv.js';
/* ------------------------------------------------------------------ */
/*  CKAN Search for CTA Datasets                                      */
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
 * Search CKAN for CTA ruling datasets.
 */
export async function searchCtaCkanDatasets(
  query = 'canadian transportation agency rulings',
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
      'ckan-cta-search',
      url,
    );
  }
}

/**
 * Fetch a CKAN package by ID to discover available resources.
 */
export async function fetchCtaCkanPackage(datasetId: string): Promise<CkanPackageResult['result'] | null> {
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
/*  Parse CTA Ruling Record                                            */
/* ------------------------------------------------------------------ */

/**
 * Parse a CTA ruling record from CKAN resource data.
 */
function parseCtaRulingRow(
  row: Record<string, unknown>,
  sourceUrl: string,
  ckanDatasetId: string,
): CtaRuling | null {
  const rulingNum = (row.ruling_number ?? row['Ruling Number'] ?? row.RULING_NUMBER
    ?? row['Decision No'] ?? row['File Number'] ?? '') as string;
  if (!rulingNum && !(row.title ?? row['Title'] ?? '')) return null;

  return {
    id: `cta-ruling-${rulingNum || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`,
    rulingNumber: rulingNum || null,
    title: ((row.title ?? row['Title'] ?? row.TITLE ?? '') as string) || null,
    caseType: ((row.case_type ?? row['Case Type'] ?? row.CASE_TYPE
      ?? row['Type'] ?? row['Category'] ?? '') as string) || null,
    complainant: ((row.complainant ?? row['Complainant'] ?? row.COMPLAINANT
      ?? row['Applicant'] ?? row['Passenger'] ?? '') as string) || null,
    respondent: ((row.respondent ?? row['Respondent'] ?? row.RESPONDENT
      ?? row['Airline'] ?? row['Carrier'] ?? '') as string) || null,
    decisionDate: ((row.decision_date ?? row['Decision Date'] ?? row.DECISION_DATE
      ?? row['Date'] ?? row['Ruling Date'] ?? '') as string) || null,
    outcome: ((row.outcome ?? row['Outcome'] ?? row.OUTCOME
      ?? row['Decision'] ?? row['Result'] ?? '') as string) || null,
    summary: ((row.summary ?? row['Summary'] ?? row.SUMMARY
      ?? row['Description'] ?? row['Notes'] ?? '') as string) || null,
    sourceUrl,
    ckanDatasetId,
    ingestedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/*  Fetch CTA Rulings (Airline Rulings + Accessibility Complaints)     */
/* ------------------------------------------------------------------ */

/**
 * Fetch CTA rulings from known CKAN datasets.
 * Iterates through CTA_DATASETS (airline rulings, accessibility complaints)
 * and downloads CSV/JSON resources.
 */
export async function fetchCtaRulings(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<CtaRuling[]> {
  const allRecords: CtaRuling[] = [];
  const datasetIds = Object.values(CTA_DATASETS).map(d => d.id);

  for (const datasetId of datasetIds) {
    if (allRecords.length >= maxRecords) break;

    try {
      const pkg = await fetchCtaCkanPackage(datasetId);
      if (!pkg) continue;

      const csvResource = pkg.resources.find(r =>
        r.format?.toLowerCase() === 'csv' || r.format?.toLowerCase() === 'json',
      );
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
        const record = parseCtaRulingRow(row, csvResource.url, datasetId);
        if (record) allRecords.push(record);
      }
    } catch {
      continue;
    }
  }

  // Compute hashes for unique IDs
  const hashed: CtaRuling[] = [];
  for (const r of allRecords) {
    const hash = await computeHash(JSON.stringify({
      ruling: r.rulingNumber,
      title: r.title,
      date: r.decisionDate,
      complainant: r.complainant,
      respondent: r.respondent,
    }), 'sha256');
    hashed.push({ ...r, id: hash });
  }

  return hashed;
}

/* ------------------------------------------------------------------ */
/*  Fetch CTA Decisions (Regulatory)                                   */
/* ------------------------------------------------------------------ */

/**
 * Fetch CTA regulatory decisions.
 * Searches CKAN for CTA decision and determination datasets
 * beyond standard rulings (licensing, railway noise, etc.).
 */
export async function fetchCtaDecisions(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<CtaRuling[]> {
  const allRecords: CtaRuling[] = [];

  const queries = [
    'canadian transportation agency decisions determinations',
    'canadian transportation agency licensing',
    'canadian transportation agency railway noise',
    'canadian transportation agency accessibility decisions',
  ];

  for (const query of queries) {
    if (allRecords.length >= maxRecords) break;

    try {
      const datasets = await searchCtaCkanDatasets(query, CKAN_SEARCH_LIMIT);

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
            const record = parseCtaRulingRow(row, csvResource.url, ds.id);
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
  const hashed: CtaRuling[] = [];
  for (const r of allRecords) {
    const hash = await computeHash(JSON.stringify({
      ruling: r.rulingNumber,
      title: r.title,
      date: r.decisionDate,
      caseType: r.caseType,
    }), 'sha256');
    hashed.push({ ...r, id: hash });
  }

  return hashed;
}

/* ------------------------------------------------------------------ */
/*  Search CTA Data                                                    */
/* ------------------------------------------------------------------ */

/**
 * Search across CTA ruling records for a term.
 */
export async function searchCtaData(
  query: string,
  maxResults = 10,
  existingRecords?: CtaRuling[],
): Promise<CtaRuling[]> {
  const q = query.toLowerCase();
  const records = existingRecords ?? await fetchCtaRulings(maxResults);

  return records.filter(r =>
    r.title?.toLowerCase().includes(q) ||
    r.rulingNumber?.toLowerCase().includes(q) ||
    r.caseType?.toLowerCase().includes(q) ||
    r.complainant?.toLowerCase().includes(q) ||
    r.respondent?.toLowerCase().includes(q) ||
    r.outcome?.toLowerCase().includes(q) ||
    r.summary?.toLowerCase().includes(q),
  ).slice(0, maxResults);
}

/* ------------------------------------------------------------------ */
/*  Summary Stats                                                      */
/* ------------------------------------------------------------------ */

/**
 * Compute summary statistics for CTA rulings.
 */
export function computeCtaStats(
  rulings: CtaRuling[],
): {
  total: number;
  byCaseType: Record<string, number>;
  byOutcome: Record<string, number>;
  byRespondent: Record<string, number>;
} {
  const total = rulings.length;
  const byCaseType: Record<string, number> = {};
  const byOutcome: Record<string, number> = {};
  const byRespondent: Record<string, number> = {};

  for (const r of rulings) {
    if (r.caseType) byCaseType[r.caseType] = (byCaseType[r.caseType] ?? 0) + 1;
    if (r.outcome) byOutcome[r.outcome] = (byOutcome[r.outcome] ?? 0) + 1;
    if (r.respondent) byRespondent[r.respondent] = (byRespondent[r.respondent] ?? 0) + 1;
  }

  return { total, byCaseType, byOutcome, byRespondent };
}
