// SPDX-License-Identifier: AGPL-3.0-only
/**
 * First Nations Financial Transparency Connector — Quill
 *
 * Fetches First Nations financial transparency data under the
 * First Nations Financial Transparency Act (FNFT Act):
 *   - Chief and council salaries and expenses
 *   - Community financial statements (audited)
 *
 * Sources:
 *   - FN Transparency Portal: https://fnp-ppn.aadnc-aandc.gc.ca
 *   - Open Canada CKAN for FN transparency datasets
 *
 * The FNFT Act requires all First Nations to publicly disclose
 * chief and council salaries, expenses, and audited financial statements.
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  INDIGENOUS_SOURCES,
  CIRNAC_DATASETS,
  IndigenousFetchError,
  DEFAULT_MAX_RECORDS,
  INDIGENOUS_SOURCE_NAMES,
  FN_TRANSPARENCY_CKAN_QUERY,
} from './constants.js';
import type { FnTransparencyRecord, IndigenousIngestionResult } from './types.js';

/* ------------------------------------------------------------------ */
/*  CKAN Dataset Metadata Fetch (FN Transparency)                      */
/* ------------------------------------------------------------------ */

export async function fetchFnCkanDataset(datasetId: string): Promise<{
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
      'ckan-fn-transparency',
      url,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Search FN Transparency Packages on CKAN                            */
/* ------------------------------------------------------------------ */

/**
 * Search for FN transparency related packages on open.canada.ca.
 */
export async function searchFnTransparencyPackages(
  query: string = FN_TRANSPARENCY_CKAN_QUERY,
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
      'ckan-fn-search',
      url,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Parse FN Transparency Record                                       */
/* ------------------------------------------------------------------ */

/**
 * Parse a raw FN transparency record into typed FnTransparencyRecord.
 */
export function parseFnTransparencyRecord(raw: {
  communityName: string;
  fiscalYear: string;
  positionTitle: string;
  individualName: string;
  totalCompensation: number;
  baseSalary?: number;
  taxableBenefits?: number;
  isElected?: boolean;
  sourceUrl: string;
}): FnTransparencyRecord {
  const now = new Date().toISOString();
  return {
    id: '', // computed via computeHash
    communityName: raw.communityName,
    fiscalYear: raw.fiscalYear,
    positionTitle: raw.positionTitle,
    individualName: raw.individualName,
    totalCompensation: raw.totalCompensation,
    baseSalary: raw.baseSalary ?? null,
    taxableBenefits: raw.taxableBenefits ?? null,
    isElected: raw.isElected ?? true,
    sourceUrl: raw.sourceUrl,
    ingestedAt: now,
  };
}

/**
 * Compute hash ID for an FN transparency record.
 */
export async function computeFnTransparencyId(record: Omit<FnTransparencyRecord, 'id'>): Promise<string> {
  const content = `${record.communityName}|${record.fiscalYear}|${record.positionTitle}|${record.individualName}|${record.totalCompensation}`;
  return computeHash(content, 'sha256');
}

/* ------------------------------------------------------------------ */
/*  Fetch FN Transparency Data                                         */
/* ------------------------------------------------------------------ */

/**
 * Fetch First Nations financial transparency records.
 *
 * In production:
 *   1. Fetch the CKAN dataset resources
 *   2. Download CSV/JSON resource files
 *   3. Parse rows into FnTransparencyRecord
 *   4. Also scrape FN Transparency Portal for supplement data
 */
export async function fetchFnTransparencyRecords(
  limit: number = DEFAULT_MAX_RECORDS,
): Promise<FnTransparencyRecord[]> {
  const records: FnTransparencyRecord[] = [];

  try {
    const ckanData = await fetchFnCkanDataset(CIRNAC_DATASETS.FN_TRANSPARENCY_DATA.id);

    const now = new Date().toISOString();
    const content = `fn-transparency-meta|${ckanData.id}|${ckanData.resources.length}`;
    const hash = await computeHash(content, 'sha256');

    // Create a summary record from CKAN metadata
    records.push({
      id: hash,
      communityName: ckanData.title,
      fiscalYear: new Date().getFullYear().toString(),
      positionTitle: 'Data source (CKAN)',
      individualName: 'FN Transparency Dataset',
      totalCompensation: 0,
      baseSalary: null,
      taxableBenefits: null,
      isElected: false,
      sourceUrl: `https://open.canada.ca/data/en/dataset/${CIRNAC_DATASETS.FN_TRANSPARENCY_DATA.id}`,
      ingestedAt: now,
    });

    return records.slice(0, limit);
  } catch (err) {
    throw new IndigenousFetchError(
      err instanceof Error ? err.message : String(err),
      INDIGENOUS_SOURCE_NAMES.FN_TRANSPARENCY,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  FN Portal HTML Scraper (supplement)                                */
/* ------------------------------------------------------------------ */

/**
 * Build the URL for a specific First Nation's transparency data
 * on the FN Portal.
 */
export function buildFnPortalUrl(fnpId: string, fiscalYear?: string): string {
  const base = `${INDIGENOUS_SOURCES.FN_TRANSPARENCY.BASE}/fnp/Main/SearchFNDecisions.aspx`;
  const params = new URLSearchParams();
  if (fnpId) params.set('fnpId', fnpId);
  if (fiscalYear) params.set('year', fiscalYear);
  return `${base}?${params.toString()}`;
}
