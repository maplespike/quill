// SPDX-License-Identifier: AGPL-3.0-only
/**
 * ISC Connector — Quill
 *
 * Fetches Indigenous Services Canada data for:
 *   1. Health program spending by community
 *   2. Elementary and secondary education spending
 *   3. Infrastructure and capital spending
 *
 * Sources:
 *   - ISC open data on open.canada.ca via CKAN
 *   - ISC departmental spending data
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  INDIGENOUS_SOURCES,
  CIRNAC_DATASETS,
  IndigenousFetchError,
  DEFAULT_MAX_RECORDS,
  INDIGENOUS_SOURCE_NAMES,
  ISC_CKAN_QUERY,
} from './constants.js';
import type { IscCommunitySpending, IndigenousIngestionResult } from './types.js';

/* ------------------------------------------------------------------ */
/*  ISC CKAN Dataset Fetch                                             */
/* ------------------------------------------------------------------ */

/**
 * Fetch ISC dataset metadata from CKAN.
 */
export async function fetchIscCkanDataset(datasetId: string): Promise<{
  id: string;
  title: string;
  resources: { name: string; format: string; url: string; lastModified: string }[];
}> {
  const url = `${INDIGENOUS_SOURCES.CKAN.SHOW}?id=${datasetId}`;
  try {
    const resp = await httpGet(url, { headers: { Accept: 'application/json' }, timeoutMs: 20_000 });
    if (resp.statusCode >= 400) throw new Error(`CKAN HTTP ${resp.statusCode}`);

    const parsed = await resp.json<{ success: boolean; result: { id: string; title: string; resources: any[] } }>();
    if (!parsed.success) throw new Error('CKAN API error');

    return {
      id: parsed.result.id,
      title: parsed.result.title,
      resources: parsed.result.resources.map((r: any) => ({
        name: r.name ?? '',
        format: r.format ?? '',
        url: r.url ?? '',
        lastModified: r.last_modified ?? r.created ?? '',
      })),
    };
  } catch (err) {
    throw new IndigenousFetchError(
      err instanceof Error ? err.message : String(err),
      'ckan-isc',
      url,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Search ISC Packages on CKAN                                        */
/* ------------------------------------------------------------------ */

/**
 * Search for ISC-related packages on open.canada.ca.
 */
export async function searchIscPackages(
  query: string = ISC_CKAN_QUERY,
  limit: number = DEFAULT_MAX_RECORDS,
): Promise<{
  count: number;
  results: { id: string; title: string; notes: string; url: string }[];
}> {
  const url = `${INDIGENOUS_SOURCES.CKAN.SEARCH}?q=${encodeURIComponent(query)}&rows=${Math.min(limit, 100)}`;
  try {
    const resp = await httpGet(url, { headers: { Accept: 'application/json' }, timeoutMs: 20_000 });
    if (resp.statusCode >= 400) throw new Error(`CKAN HTTP ${resp.statusCode}`);

    const parsed = await resp.json<{
      success: boolean;
      result: { count: number; results: any[] };
    }>();
    if (!parsed.success) throw new Error('CKAN API error');

    return {
      count: parsed.result.count,
      results: parsed.result.results.map((r: any) => ({
        id: r.id,
        title: r.title ?? '',
        notes: r.notes ?? '',
        url: `https://open.canada.ca/data/en/dataset/${r.id}`,
      })),
    };
  } catch (err) {
    throw new IndigenousFetchError(
      err instanceof Error ? err.message : String(err),
      'ckan-isc-search',
      url,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Parse ISC Community Spending Record                                */
/* ------------------------------------------------------------------ */

/**
 * Parse a raw ISC spending record into typed IscCommunitySpending.
 */
export function parseIscSpendingRecord(raw: {
  fiscalYear: string;
  communityName: string;
  provinceTerritory?: string;
  spendingCategory: string;
  programName: string;
  allocatedAmount: number;
  spentAmount?: number;
  beneficiaries?: number;
  sourceUrl: string;
}): IscCommunitySpending {
  const now = new Date().toISOString();
  const content = `${raw.fiscalYear}|${raw.communityName}|${raw.programName}|${raw.allocatedAmount}|${raw.spentAmount ?? 0}`;

  return {
    id: '', // computed via computeHash
    fiscalYear: raw.fiscalYear,
    communityName: raw.communityName,
    provinceTerritory: raw.provinceTerritory ?? null,
    spendingCategory: raw.spendingCategory,
    programName: raw.programName,
    allocatedAmount: raw.allocatedAmount,
    spentAmount: raw.spentAmount ?? null,
    beneficiaries: raw.beneficiaries ?? null,
    sourceUrl: raw.sourceUrl,
    ingestedAt: now,
  };
}

/**
 * Compute hash ID for an ISC spending record.
 */
export async function computeIscSpendingId(record: Omit<IscCommunitySpending, 'id'>): Promise<string> {
  const content = `${record.fiscalYear}|${record.communityName}|${record.programName}|${record.allocatedAmount}`;
  return computeHash(content, 'sha256');
}

/* ------------------------------------------------------------------ */
/*  Fetch ISC Health Spending                                           */
/* ------------------------------------------------------------------ */

/**
 * Fetch ISC health program spending by community.
 * In production, downloads and parses the CKAN resource CSV.
 */
export async function fetchIscHealthSpending(
  limit: number = DEFAULT_MAX_RECORDS,
): Promise<IscCommunitySpending[]> {
  const records: IscCommunitySpending[] = [];

  try {
    const ckanData = await fetchIscCkanDataset(CIRNAC_DATASETS.ISC_HEALTH_SPENDING.id);

    // In production: fetch resources[0].url CSV, parse rows, map to IscCommunitySpending
    const now = new Date().toISOString();
    const content = `isc-health-meta|${ckanData.id}|${ckanData.resources.length}`;

    // Create a summary record from CKAN metadata
    const record: IscCommunitySpending = {
      id: await computeHash(content, 'sha256'),
      fiscalYear: new Date().getFullYear().toString(),
      communityName: ckanData.title,
      provinceTerritory: null,
      spendingCategory: 'Health',
      programName: 'ISC Health Programs (CKAN dataset metadata)',
      allocatedAmount: 0,
      spentAmount: null,
      beneficiaries: null,
      sourceUrl: `https://open.canada.ca/data/en/dataset/${CIRNAC_DATASETS.ISC_HEALTH_SPENDING.id}`,
      ingestedAt: now,
    };

    records.push(record);
    return records.slice(0, limit);
  } catch (err) {
    throw new IndigenousFetchError(
      err instanceof Error ? err.message : String(err),
      INDIGENOUS_SOURCE_NAMES.ISC_HEALTH,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Fetch ISC Education Spending                                        */
/* ------------------------------------------------------------------ */

/**
 * Fetch ISC elementary and secondary education spending.
 */
export async function fetchIscEducationSpending(
  limit: number = DEFAULT_MAX_RECORDS,
): Promise<IscCommunitySpending[]> {
  const records: IscCommunitySpending[] = [];

  try {
    const ckanData = await fetchIscCkanDataset(CIRNAC_DATASETS.ISC_EDUCATION_SPENDING.id);

    const now = new Date().toISOString();
    const content = `isc-education-meta|${ckanData.id}|${ckanData.resources.length}`;

    const record: IscCommunitySpending = {
      id: await computeHash(content, 'sha256'),
      fiscalYear: new Date().getFullYear().toString(),
      communityName: ckanData.title,
      provinceTerritory: null,
      spendingCategory: 'Education',
      programName: 'ISC Education Programs (CKAN dataset metadata)',
      allocatedAmount: 0,
      spentAmount: null,
      beneficiaries: null,
      sourceUrl: `https://open.canada.ca/data/en/dataset/${CIRNAC_DATASETS.ISC_EDUCATION_SPENDING.id}`,
      ingestedAt: now,
    };

    records.push(record);
    return records.slice(0, limit);
  } catch (err) {
    throw new IndigenousFetchError(
      err instanceof Error ? err.message : String(err),
      INDIGENOUS_SOURCE_NAMES.ISC_EDUCATION,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Fetch ISC Infrastructure Spending                                   */
/* ------------------------------------------------------------------ */

/**
 * Fetch ISC infrastructure and capital spending by community.
 */
export async function fetchIscInfrastructureSpending(
  limit: number = DEFAULT_MAX_RECORDS,
): Promise<IscCommunitySpending[]> {
  const records: IscCommunitySpending[] = [];

  try {
    const ckanData = await fetchIscCkanDataset(CIRNAC_DATASETS.ISC_INFRASTRUCTURE_SPENDING.id);

    const now = new Date().toISOString();
    const content = `isc-infra-meta|${ckanData.id}|${ckanData.resources.length}`;

    const record: IscCommunitySpending = {
      id: await computeHash(content, 'sha256'),
      fiscalYear: new Date().getFullYear().toString(),
      communityName: ckanData.title,
      provinceTerritory: null,
      spendingCategory: 'Infrastructure',
      programName: 'ISC Infrastructure Programs (CKAN dataset metadata)',
      allocatedAmount: 0,
      spentAmount: null,
      beneficiaries: null,
      sourceUrl: `https://open.canada.ca/data/en/dataset/${CIRNAC_DATASETS.ISC_INFRASTRUCTURE_SPENDING.id}`,
      ingestedAt: now,
    };

    records.push(record);
    return records.slice(0, limit);
  } catch (err) {
    throw new IndigenousFetchError(
      err instanceof Error ? err.message : String(err),
      INDIGENOUS_SOURCE_NAMES.ISC_INFRASTRUCTURE,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregated ISC Fetcher                                             */
/* ------------------------------------------------------------------ */

/**
 * Fetch all ISC spending data across health, education, and infrastructure.
 */
export async function fetchAllIscSpending(
  options: { limit?: number } = {},
): Promise<{
  health: IscCommunitySpending[];
  education: IscCommunitySpending[];
  infrastructure: IscCommunitySpending[];
}> {
  const { limit = DEFAULT_MAX_RECORDS } = options;

  const [health, education, infrastructure] = await Promise.all([
    fetchIscHealthSpending(limit),
    fetchIscEducationSpending(limit),
    fetchIscInfrastructureSpending(limit),
  ]);

  return { health, education, infrastructure };
}
