/**
 * Elections Canada Third-Party Advertiser Registry Fetcher — Quill
 *
 * HTTP fetchers for Elections Canada third-party advertising data from
 * multiple sources:
 *
 *   1. Elections.ca Third Party Registry Search (HTML) — primary
 *   2. open.canada.ca CKAN packages (financial reports) — secondary
 *   3. Elections Canada CSV exports — when available
 *
 * Uses undici for HTTP (consistent with the rest of the pipeline).
 * Tries CKAN first, falls back to HTML scraping of Elections Canada.
 */

import { httpGet } from '../../utils/http.js';
import { ELECTIONS_SOURCES, ckanPackageUrl } from './constants.js';
import type { RawThirdPartyRecord, RawThirdPartySpendingRecord } from './types.js';


export class ElectionsFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly source?: string,
  ) {
    super(message);
    this.name = 'ElectionsFetchError';
  }
}


const DEFAULT_HEADERS = {
  'User-Agent': 'Quill/0.1 (civic-tech; mailto:dev@maplespike.ca)',
  Accept: 'application/json,text/csv,text/html,*/*',
} as const;

const DEFAULT_TIMEOUT = 30_000;

/**
 * Fetch raw JSON from a URL.
 */
export async function fetchJson<T = unknown>(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const resp = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS as Record<string, string> },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT,
  });

  if (resp.statusCode >= 400) {
    throw new ElectionsFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.json<T>();
}

/**
 * Fetch raw text from a URL (for CSV, HTML, or XML).
 */
export async function fetchText(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const resp = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS as Record<string, string> },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT,
  });

  if (resp.statusCode >= 400) {
    throw new ElectionsFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.body;
}


interface CKANPackageResponse {
  success: boolean;
  result: {
    id: string;
    title: string;
    notes: string | null;
    resources: Array<{
      id: string;
      name: string;
      format: string;
      url: string;
      description: string | null;
    }>;
    organization: { name: string; title: string } | null;
  };
}

interface CKANSearchResponse {
  success: boolean;
  result: {
    results: Array<{
      id: string;
      title: string;
      notes: string | null;
      resources: Array<{
        id: string;
        name: string;
        format: string;
        url: string;
        description: string | null;
      }>;
      organization: { name: string; title: string } | null;
    }>;
  };
}


/**
 * Fetch a CKAN package by ID and return its resources.
 */
export async function fetchCkanPackage(
  packageId: string,
): Promise<CKANPackageResponse['result']> {
  const url = ckanPackageUrl(packageId);
  const resp = await fetchJson<CKANPackageResponse>(url);

  if (!resp.success || !resp.result) {
    throw new ElectionsFetchError(
      `CKAN API error for package ${packageId}`,
      undefined,
      'ckan',
    );
  }

  return resp.result;
}

/**
 * Search for third-party advertising packages on open.canada.ca CKAN portal.
 */
export async function searchThirdPartyPackages(
  query: string = 'third+party+election+advertising',
  rows: number = 20,
): Promise<Array<{
  id: string;
  title: string;
  notes: string | null;
  resources: Array<{ id: string; name: string; format: string; url: string }>;
}>> {
  const url = `${ELECTIONS_SOURCES.CKAN.SEARCH}?q=${query}&rows=${rows}`;
  const resp = await fetchJson<CKANSearchResponse>(url);

  if (!resp.success) {
    return [];
  }

  return resp.result.results.map(p => ({
    id: p.id,
    title: p.title,
    notes: p.notes,
    resources: (p.resources ?? []).map(r => ({
      id: r.id,
      name: r.name,
      format: r.format,
      url: r.url,
    })),
  }));
}

/**
 * Fetch a CSV resource from a CKAN package and return raw text.
 */
export async function fetchCkanCsvResource(
  resourceUrl: string,
): Promise<string> {
  return fetchText(resourceUrl);
}


/**
 * Fetch the third-party registry index page from Elections Canada.
 * This is the primary HTML interface for third-party advertiser data.
 */
export async function fetchRegistryIndex(): Promise<{
  html: string;
  sourceUrl: string;
}> {
  const url = ELECTIONS_SOURCES.THIRD_PARTY_REGISTRY.REGISTRY_INDEX;
  const html = await fetchText(url);

  return {
    html,
    sourceUrl: url,
  };
}

/**
 * Fetch the financial reports listing page from Elections Canada.
 */
export async function fetchFinancialReportsIndex(): Promise<{
  html: string;
  sourceUrl: string;
}> {
  const url = ELECTIONS_SOURCES.THIRD_PARTY_REGISTRY.FINANCIAL_REPORTS;
  const html = await fetchText(url);

  return {
    html,
    sourceUrl: url,
  };
}


/**
 * Fetch third-party advertiser registry records from all available sources.
 *
 * Strategy:
 *   1. Try CKAN packages on open.canada.ca (primary for bulk data)
 *   2. Fall back to HTML scraping of Elections Canada registry
 */
export async function fetchThirdPartyRegistry(
  options: {
    limit?: number;
    ckanPackageIds?: string[];
  } = {},
): Promise<{
  source: string;
  records: RawThirdPartyRecord[];
  sourcesTried: string[];
  errors: string[];
}> {
  const sourcesTried: string[] = [];
  const errors: string[] = [];
  let allRecords: RawThirdPartyRecord[] = [];
  let primarySuccess = false;

  // Step 1: Try CKAN packages (preferred bulk data source)
  try {
    sourcesTried.push('ckan-search');
    const packages = await searchThirdPartyPackages(
      undefined,
      options.limit ?? 20,
    );

    if (packages.length > 0) {
      for (const pkg of packages) {
        sourcesTried.push(`ckan:${pkg.id}`);
        for (const resource of pkg.resources) {
          if (resource.format.toLowerCase() === 'csv' || resource.format.toLowerCase() === 'xlsx') {
            try {
              const csvText = await fetchCkanCsvResource(resource.url);
              // Emit as a raw record — parser will handle CSV parsing
              allRecords.push({
                registrantName: pkg.title,
                sourceUrl: resource.url,
                ckanPackageId: pkg.id,
                ckanResourceId: resource.id,
                rawCsvData: csvText,
              } as unknown as RawThirdPartyRecord);
              primarySuccess = true;
            } catch (err) {
              errors.push(`CKAN resource ${resource.id}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }
      }
    }
  } catch (err) {
    errors.push(`CKAN search: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Step 2: Try known CKAN package IDs (fallback)
  if (!primarySuccess || allRecords.length === 0) {
    const ckanIds = options.ckanPackageIds ?? [
      ELECTIONS_SOURCES.KNOWN_PACKAGES.THIRD_PARTY_ADVERTISING,
      ELECTIONS_SOURCES.KNOWN_PACKAGES.POLITICAL_FINANCING,
      ELECTIONS_SOURCES.KNOWN_PACKAGES.FINANCIAL_RETURNS,
    ];

    for (const pkgId of ckanIds) {
      try {
        sourcesTried.push(`ckan-pkg:${pkgId}`);
        const pkg = await fetchCkanPackage(pkgId);
        for (const resource of pkg.resources) {
          if (resource.format.toLowerCase() === 'csv' || resource.format.toLowerCase() === 'xlsx') {
            const csvText = await fetchCkanCsvResource(resource.url);
            allRecords.push({
              registrantName: pkg.title,
              sourceUrl: resource.url,
              ckanPackageId: pkgId,
              ckanResourceId: resource.id,
              rawCsvData: csvText,
            } as unknown as RawThirdPartyRecord);
            primarySuccess = true;
          }
        }
      } catch (err) {
        errors.push(`CKAN ${pkgId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // Step 3: Fall back to HTML scraping
  if (!primarySuccess || allRecords.length === 0) {
    try {
      sourcesTried.push('elections-ca-html');
      const registry = await fetchRegistryIndex();
      allRecords.push({
        sourceUrl: registry.sourceUrl,
        rawHtml: registry.html,
      } as unknown as RawThirdPartyRecord);
    } catch (err) {
      errors.push(`Elections Canada HTML: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    source: primarySuccess ? 'ckan' : 'elections-ca-html',
    records: allRecords,
    sourcesTried,
    errors,
  };
}

/**
 * Fetch third-party advertiser financial reports from available sources.
 *
 * This provides detailed spending breakdowns by platform, vendor,
 * and electoral district.
 */
export async function fetchFinancialReports(
  options: {
    limit?: number;
    ckanPackageIds?: string[];
  } = {},
): Promise<{
  source: string;
  records: RawThirdPartySpendingRecord[];
  sourcesTried: string[];
  errors: string[];
}> {
  const sourcesTried: string[] = [];
  const errors: string[] = [];
  let allRecords: RawThirdPartySpendingRecord[] = [];
  let primarySuccess = false;

  // Try CKAN for financial reports
  try {
    sourcesTried.push('ckan-financial');
    const packages = await searchThirdPartyPackages(
      ELECTIONS_SOURCES.CKAN.FINANCIAL_QUERY,
      options.limit ?? 20,
    );

    if (packages.length > 0) {
      for (const pkg of packages) {
        sourcesTried.push(`ckan-financial:${pkg.id}`);
        for (const resource of pkg.resources) {
          if (resource.format.toLowerCase() === 'csv') {
            try {
              const csvText = await fetchCkanCsvResource(resource.url);
              allRecords.push({
                registrantName: pkg.title,
                sourceUrl: resource.url,
                rawCsvData: csvText,
              } as unknown as RawThirdPartySpendingRecord);
              primarySuccess = true;
            } catch (err) {
              errors.push(`CKAN resource ${resource.id}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }
      }
    }
  } catch (err) {
    errors.push(`CKAN search: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Fallback: try known package IDs
  if (!primarySuccess || allRecords.length === 0) {
    const ckanIds = options.ckanPackageIds ?? [
      ELECTIONS_SOURCES.KNOWN_PACKAGES.THIRD_PARTY_ADVERTISING,
      ELECTIONS_SOURCES.KNOWN_PACKAGES.FINANCIAL_RETURNS,
    ];

    for (const pkgId of ckanIds) {
      try {
        sourcesTried.push(`ckan-pkg:${pkgId}`);
        const pkg = await fetchCkanPackage(pkgId);
        for (const resource of pkg.resources) {
          if (resource.format.toLowerCase() === 'csv') {
            const csvText = await fetchCkanCsvResource(resource.url);
            allRecords.push({
              registrantName: pkg.title,
              sourceUrl: resource.url,
              rawCsvData: csvText,
            } as unknown as RawThirdPartySpendingRecord);
            primarySuccess = true;
          }
        }
      } catch (err) {
        errors.push(`CKAN ${pkgId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // Fallback: try HTML scraping of financial reports page
  if (!primarySuccess || allRecords.length === 0) {
    try {
      sourcesTried.push('elections-ca-financial-html');
      const reportsPage = await fetchFinancialReportsIndex();
      allRecords.push({
        sourceUrl: reportsPage.sourceUrl,
        rawHtml: reportsPage.html,
      } as unknown as RawThirdPartySpendingRecord);
    } catch (err) {
      errors.push(`Elections Canada financial HTML: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    source: primarySuccess ? 'ckan' : 'elections-ca-html',
    records: allRecords,
    sourcesTried,
    errors,
  };
}
