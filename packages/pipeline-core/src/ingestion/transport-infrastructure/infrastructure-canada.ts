// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Infrastructure Canada Connector — Quill
 *
 * Fetches Infrastructure Canada project funding data:
 *   - Investing in Canada infrastructure program projects
 *   - National Trade Corridors Fund (NTCF) projects
 *   - Canada Infrastructure Bank (CIIB) projects (wraps ciib.ts)
 *
 * Primary data sources:
 *   - CKAN package_search for Infrastructure Canada funding datasets
 *   - CKAN package_show for resource discovery
 *   - Infrastructure Canada website
 *   - CIIB connector (ciib.ts) for Canada Infrastructure Bank data
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  TRANSPORT_SOURCES,
  INFRASTRUCTURE_CANADA_DATASETS,
  TransportInfrastructureFetchError,
  DEFAULT_MAX_RECORDS,
  CKAN_SEARCH_LIMIT,
  TRANSPORT_SOURCE_NAMES,
} from './constants.js';
import type { InfrastructureFunding, NtcfProject, CiibProject, TransportInfrastructureIngestionResult } from './types.js';
import { fetchCiibProjects } from './ciib.js';

import { parseCsvLine } from '../../utils/csv.js';
/* ------------------------------------------------------------------ */
/*  CKAN Search for Infrastructure Canada Datasets                    */
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
 * Search CKAN for Infrastructure Canada funding datasets.
 */
export async function searchInfrastructureCkanDatasets(
  query = 'infrastructure canada investing',
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
      'ckan-infrastructure-search',
      url,
    );
  }
}

/**
 * Fetch a CKAN package by ID to discover available resources.
 */
export async function fetchInfrastructureCkanPackage(datasetId: string): Promise<CkanPackageResult['result'] | null> {
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
/*  Parse Infrastructure Funding Record                                */
/* ------------------------------------------------------------------ */

/**
 * Parse an Infrastructure Canada funding record from CKAN resource data.
 */
function parseInfrastructureFundingRow(
  row: Record<string, unknown>,
  sourceUrl: string,
  ckanDatasetId: string,
): InfrastructureFunding | null {
  const projectName = (row.project_name ?? row['Project Name'] ?? row.PROJECT_NAME
    ?? row['Project Title'] ?? row['Project'] ?? '') as string;
  if (!projectName) return null;

  return {
    id: `infra-funding-${projectName.slice(0, 40).replace(/[^a-z0-9]/gi, '_')}-${Date.now()}`,
    projectName,
    recipient: ((row.recipient ?? row['Recipient'] ?? row.RECIPIENT
      ?? row['Recipient Name'] ?? row['Organization'] ?? '') as string) || null,
    province: ((row.province ?? row['Province'] ?? row.PROVINCE
      ?? row['Province/Territory'] ?? '') as string) || null,
    riding: ((row.riding ?? row['Riding'] ?? row.RIDING
      ?? row['Electoral District'] ?? row['Federal Riding'] ?? '') as string) || null,
    party: ((row.party ?? row['Party'] ?? row.PARTY
      ?? row['MP Party'] ?? '') as string) || null,
    program: ((row.program ?? row['Program'] ?? row.PROGRAM
      ?? row['Funding Program'] ?? row['Program Name'] ?? '') as string) || null,
    federalContribution: parseFloat((row.federal_contribution ?? row['Federal Contribution'] ?? row.FEDERAL_CONTRIBUTION
      ?? row['Federal Funding'] ?? row['Amount'] ?? row['Federal Amount'] ?? '0') as string) || null,
    totalProjectValue: parseFloat((row.total_project_value ?? row['Total Project Value'] ?? row.TOTAL_PROJECT_VALUE
      ?? row['Total Value'] ?? '0') as string) || null,
    announcementDate: ((row.announcement_date ?? row['Announcement Date'] ?? row.ANNOUNCEMENT_DATE
      ?? row['Date'] ?? row['Announced'] ?? '') as string) || null,
    status: ((row.status ?? row['Status'] ?? row.STATUS
      ?? row['Project Status'] ?? '') as string) || null,
    description: ((row.description ?? row['Description'] ?? row.DESCRIPTION
      ?? row['Summary'] ?? row['Notes'] ?? '') as string) || null,
    sourceUrl,
    ckanDatasetId,
    ingestedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/*  Fetch Infrastructure Canada Projects (Investing in Canada)        */
/* ------------------------------------------------------------------ */

/**
 * Fetch Infrastructure Canada project funding data from CKAN datasets.
 * Covers the Investing in Canada Infrastructure Program (ICIP) and
 * related federal infrastructure grant programs.
 */
export async function fetchInfrastructureProjects(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<InfrastructureFunding[]> {
  const allRecords: InfrastructureFunding[] = [];
  const knownDatasetIds = Object.values(INFRASTRUCTURE_CANADA_DATASETS).map(d => d.id);

  // First try known dataset IDs
  for (const datasetId of knownDatasetIds) {
    if (allRecords.length >= maxRecords) break;

    try {
      const pkg = await fetchInfrastructureCkanPackage(datasetId);
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
        const record = parseInfrastructureFundingRow(row, csvResource.url, datasetId);
        if (record) allRecords.push(record);
      }
    } catch {
      continue;
    }
  }

  // If we haven't hit maxRecords, search CKAN for more datasets
  if (allRecords.length < maxRecords) {
    const queries = [
      'infrastructure canada investing in canada program projects',
      'infrastructure canada grant contribution project',
      'infrastructure canada bilateral agreement funding',
      'infrastructure canada communities fund',
    ];

    for (const query of queries) {
      if (allRecords.length >= maxRecords) break;

      try {
        const datasets = await searchInfrastructureCkanDatasets(query, CKAN_SEARCH_LIMIT);

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
              const record = parseInfrastructureFundingRow(row, csvResource.url, ds.id);
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
  }

  // Compute hashes for unique IDs
  const hashed: InfrastructureFunding[] = [];
  for (const r of allRecords) {
    const hash = await computeHash(JSON.stringify({
      project: r.projectName,
      recipient: r.recipient,
      amount: r.federalContribution,
      date: r.announcementDate,
      program: r.program,
    }), 'sha256');
    hashed.push({ ...r, id: hash });
  }

  return hashed;
}

/* ------------------------------------------------------------------ */
/*  Fetch National Trade Corridors Fund (NTCF) Projects               */
/* ------------------------------------------------------------------ */

/**
 * Parse an NTCF project record from CKAN resource data.
 */
function parseNtcfProjectRow(
  row: Record<string, unknown>,
  sourceUrl: string,
): NtcfProject | null {
  const projectName = (row.project_name ?? row['Project Name'] ?? row.PROJECT_NAME
    ?? row['Project Title'] ?? row['Project'] ?? '') as string;
  if (!projectName) return null;

  return {
    id: `ntcf-${projectName.slice(0, 40).replace(/[^a-z0-9]/gi, '_')}-${Date.now()}`,
    projectName,
    recipient: ((row.recipient ?? row['Recipient'] ?? row.RECIPIENT
      ?? row['Applicant'] ?? row['Organization'] ?? '') as string) || null,
    province: ((row.province ?? row['Province'] ?? row.PROVINCE
      ?? row['Province/Territory'] ?? '') as string) || null,
    transportMode: ((row.transport_mode ?? row['Transport Mode'] ?? row.TRANSPORT_MODE
      ?? row['Mode'] ?? row['Transportation Mode'] ?? '') as string) || null,
    ntcfContribution: parseFloat((row.ntcf_contribution ?? row['NTCF Contribution'] ?? row.NTCF_CONTRIBUTION
      ?? row['Federal Contribution'] ?? row['Amount'] ?? '0') as string) || null,
    totalProjectValue: parseFloat((row.total_project_value ?? row['Total Project Value'] ?? row.TOTAL_PROJECT_VALUE
      ?? row['Total Value'] ?? '0') as string) || null,
    announcementDate: ((row.announcement_date ?? row['Announcement Date'] ?? row.ANNOUNCEMENT_DATE
      ?? row['Date'] ?? row['Announced'] ?? '') as string) || null,
    status: ((row.status ?? row['Status'] ?? row.STATUS
      ?? row['Project Status'] ?? '') as string) || null,
    rationale: ((row.rationale ?? row['Rationale'] ?? row.RATIONALE
      ?? row['Justification'] ?? row['Business Case'] ?? '') as string) || null,
    description: ((row.description ?? row['Description'] ?? row.DESCRIPTION
      ?? row['Summary'] ?? row['Notes'] ?? '') as string) || null,
    sourceUrl,
    ingestedAt: new Date().toISOString(),
  };
}

/**
 * Fetch NTCF project data from CKAN datasets.
 * Searches for National Trade Corridors Fund related datasets.
 */
export async function fetchNationalTradeCorridors(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<NtcfProject[]> {
  const allRecords: NtcfProject[] = [];

  const queries = [
    'national trade corridors fund projects',
    'ntcf trade transportation infrastructure',
    'national trade corridors fund contribution',
    'infrastructure canada trade corridors',
  ];

  for (const query of queries) {
    if (allRecords.length >= maxRecords) break;

    try {
      const datasets = await searchInfrastructureCkanDatasets(query, CKAN_SEARCH_LIMIT);

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
            const record = parseNtcfProjectRow(row, csvResource.url);
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
  const hashed: NtcfProject[] = [];
  for (const r of allRecords) {
    const hash = await computeHash(JSON.stringify({
      project: r.projectName,
      recipient: r.recipient,
      amount: r.ntcfContribution,
      date: r.announcementDate,
    }), 'sha256');
    hashed.push({ ...r, id: hash });
  }

  return hashed;
}

/* ------------------------------------------------------------------ */
/*  Fetch Canada Infrastructure Bank Projects (wraps ciib.ts)         */
/* ------------------------------------------------------------------ */

/**
 * Fetch CIIB projects using the existing ciib.ts connector.
 */
export async function fetchCanadaInfrastructureBank(
  maxRecords = DEFAULT_MAX_RECORDS,
): Promise<CiibProject[]> {
  return fetchCiibProjects(maxRecords);
}

/* ------------------------------------------------------------------ */
/*  Search Infrastructure Canada Data                                  */
/* ------------------------------------------------------------------ */

/**
 * Search across Infrastructure Canada funding records for a term.
 */
export async function searchInfrastructureFunding(
  query: string,
  maxResults = 10,
  existingRecords?: InfrastructureFunding[],
): Promise<InfrastructureFunding[]> {
  const q = query.toLowerCase();
  const records = existingRecords ?? await fetchInfrastructureProjects(maxResults);

  return records.filter(r =>
    r.projectName.toLowerCase().includes(q) ||
    r.recipient?.toLowerCase().includes(q) ||
    r.province?.toLowerCase().includes(q) ||
    r.riding?.toLowerCase().includes(q) ||
    r.party?.toLowerCase().includes(q) ||
    r.program?.toLowerCase().includes(q) ||
    r.description?.toLowerCase().includes(q),
  ).slice(0, maxResults);
}

/**
 * Search across NTCF project records for a term.
 */
export async function searchNtcfProjects(
  query: string,
  maxResults = 10,
  existingRecords?: NtcfProject[],
): Promise<NtcfProject[]> {
  const q = query.toLowerCase();
  const records = existingRecords ?? await fetchNationalTradeCorridors(maxResults);

  return records.filter(p =>
    p.projectName.toLowerCase().includes(q) ||
    p.recipient?.toLowerCase().includes(q) ||
    p.province?.toLowerCase().includes(q) ||
    p.transportMode?.toLowerCase().includes(q) ||
    p.rationale?.toLowerCase().includes(q) ||
    p.description?.toLowerCase().includes(q),
  ).slice(0, maxResults);
}

/* ------------------------------------------------------------------ */
/*  Summary Stats                                                      */
/* ------------------------------------------------------------------ */

/**
 * Compute summary statistics for Infrastructure Canada funding.
 */
export function computeInfrastructureStats(
  records: InfrastructureFunding[],
): {
  total: number;
  totalFederalContributions: number;
  totalProjectValue: number;
  byProgram: Record<string, number>;
  byProvince: Record<string, number>;
  byParty: Record<string, number>;
} {
  let totalFederalContributions = 0;
  let totalProjectValue = 0;
  const byProgram: Record<string, number> = {};
  const byProvince: Record<string, number> = {};
  const byParty: Record<string, number> = {};

  for (const r of records) {
    if (r.federalContribution) totalFederalContributions += r.federalContribution;
    if (r.totalProjectValue) totalProjectValue += r.totalProjectValue;
    if (r.program) byProgram[r.program] = (byProgram[r.program] ?? 0) + 1;
    if (r.province) byProvince[r.province] = (byProvince[r.province] ?? 0) + 1;
    if (r.party) byParty[r.party] = (byParty[r.party] ?? 0) + 1;
  }

  return {
    total: records.length,
    totalFederalContributions,
    totalProjectValue,
    byProgram,
    byProvince,
    byParty,
  };
}
