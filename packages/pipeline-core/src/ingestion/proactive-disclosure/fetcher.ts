/**
 * Proactive Disclosure Fetcher — Quill
 *
 * HTTP fetchers for federal government proactive disclosure data via
 * the open.canada.ca CKAN aggregate search API.
 *
 * Strategy:
 *   1. Query the CKAN Solr aggregate search (search.open.canada.ca)
 *      with configurable query terms and filters
 *   2. Paginate through results (up to MAX_PAGE_SIZE per page)
 *   3. Optionally fetch individual CKAN package details
 *
 * Uses undici (via shared http utility) for cross-platform HTTP.
 */

import { httpGet } from '../../utils/http.js';
import {
  CKAN_SOLR_SEARCH_URL,
  CKAN_API_BASE,
  DEFAULT_SEARCH_QUERY,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  CKAN_HEADERS,
  PDError,
} from './constants.js';
import type {
  RawCKANProactiveDisclosureDoc,
  CKANSearchResponse,
  ProactiveDisclosureSearchOptions,
} from './types.js';


/**
 * Fetch proactive disclosure records from the CKAN Solr aggregate search.
 *
 * @param options - Search parameters (query, pagination, filters)
 * @returns Array of raw CKAN document records
 */
export async function fetchProactiveDisclosure(
  options: ProactiveDisclosureSearchOptions = {},
): Promise<{
  total: number;
  records: RawCKANProactiveDisclosureDoc[];
  sourceUrl: string;
}> {
  const query = options.query ?? DEFAULT_SEARCH_QUERY;
  const rows = Math.min(options.rows ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const start = options.start ?? 0;

  // Build search URL with all applicable parameters
  const params = new URLSearchParams();
  params.set('q', query);
  params.set('rows', String(rows));
  params.set('start', String(start));
  params.set('wt', 'json');

  // Add filter queries
  const fqParams: string[] = [];

  // Default: restrict to Government of Canada datasets
  fqParams.push('owner_org:gc');

  // Add department filters
  if (options.departments && options.departments.length > 0) {
    const deptFq = options.departments.map((d) =>
      `owner_org:"${d}"`,
    ).join(' OR ');
    fqParams.push(`(${deptFq})`);
  }

  // Add fiscal year filter
  if (options.fiscalYear) {
    fqParams.push(`fiscal_year:"${options.fiscalYear}"`);
  }

  // Add date range filters
  if (options.dateFrom) {
    fqParams.push(`award_date:[${options.dateFrom}T00:00:00Z TO *]`);
  }
  if (options.dateTo) {
    fqParams.push(`award_date:[* TO ${options.dateTo}T23:59:59Z]`);
  }

  // Add minimum value filter
  if (options.minValue !== undefined) {
    fqParams.push(`contract_value:[${options.minValue} TO *]`);
  }

  // Add specific package ID filter
  if (options.packageId) {
    fqParams.push(`package_id:"${options.packageId}"`);
  }

  // Apply all filter queries
  for (const fq of fqParams) {
    params.append('fq', fq);
  }

  // Add sort
  if (options.sort) {
    params.set('sort', options.sort);
  }

  const searchUrl = `${CKAN_SOLR_SEARCH_URL}?${params.toString()}`;

  try {
    const resp = await httpGet(searchUrl, {
      headers: CKAN_HEADERS,
      timeoutMs: 60_000,
    });

    if (resp.statusCode >= 400) {
      throw new PDError(
        `CKAN Solr search returned HTTP ${resp.statusCode}`,
        'CKAN_HTTP_ERROR',
        searchUrl,
        resp.statusCode,
      );
    }

    const data: CKANSearchResponse = JSON.parse(resp.body);

    if (!data.response || !Array.isArray(data.response.docs)) {
      return { total: 0, records: [], sourceUrl: searchUrl };
    }

    return {
      total: data.response.numFound ?? data.response.docs.length,
      records: data.response.docs,
      sourceUrl: searchUrl,
    };
  } catch (err) {
    if (err instanceof PDError) throw err;
    throw new PDError(
      `Failed to fetch proactive disclosure data: ${err instanceof Error ? err.message : String(err)}`,
      'FETCH_ERROR',
      searchUrl,
    );
  }
}


/**
 * Paginate through ALL proactive disclosure results, fetching
 * across multiple pages up to maxResults.
 *
 * @param options - Search parameters (without start — auto-paginated)
 * @param maxResults - Maximum total results to fetch (default, -1 = all)
 * @returns Combined array of raw CKAN documents
 */
export async function fetchAllProactiveDisclosure(
  options: Omit<ProactiveDisclosureSearchOptions, 'start'> = {},
  maxResults: number = 10_000,
): Promise<{
  total: number;
  records: RawCKANProactiveDisclosureDoc[];
  pagesFetched: number;
  sourceUrls: string[];
}> {
  const allRecords: RawCKANProactiveDisclosureDoc[] = [];
  const sourceUrls: string[] = [];
  let currentStart = 0;
  let pagesFetched = 0;
  let totalAvailable = 0;

  const rows = Math.min(options.rows ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

  while (true) {
    const result = await fetchProactiveDisclosure({
      ...options,
      start: currentStart,
      rows,
    });

    if (pagesFetched === 0) {
      totalAvailable = result.total;
    }

    allRecords.push(...result.records);
    sourceUrls.push(result.sourceUrl);
    pagesFetched++;

    // Check termination conditions
    if (result.records.length === 0) break;
    if (maxResults > 0 && allRecords.length >= maxResults) {
      // Trim to max
      allRecords.splice(maxResults);
      break;
    }
    if (allRecords.length >= totalAvailable) break;

    currentStart += result.records.length;
  }

  return {
    total: totalAvailable,
    records: allRecords,
    pagesFetched,
    sourceUrls,
  };
}


/**
 * Fetch details of a specific CKAN package by ID from the CKAN API.
 * Returns the package metadata including all resources.
 */
export async function fetchCKANPackageDetail(
  packageId: string,
): Promise<Record<string, unknown> | null> {
  const url = `${CKAN_API_BASE}/package_show?id=${encodeURIComponent(packageId)}`;

  try {
    const resp = await httpGet(url, {
      headers: CKAN_HEADERS,
      timeoutMs: 30_000,
    });

    if (resp.statusCode >= 400) return null;

    const data = JSON.parse(resp.body);
    return data?.result ?? null;
  } catch {
    return null;
  }
}


/**
 * Fetch the list of known proactive disclosure CKAN packages for a
 * specific department. This searches the CKAN package search API.
 *
 * @param departmentOwnerOrg - The owner_org value for the department
 * @returns Array of package metadata objects
 */
export async function fetchDepartmentProactiveDisclosurePackages(
  departmentOwnerOrg: string,
): Promise<Array<{ id: string; title: string; resources: unknown[] }>> {
  const searchUrl = `${CKAN_API_BASE}/package_search?q=proactive+disclosure+contracts&fq=owner_org:${encodeURIComponent(departmentOwnerOrg)}&rows=50`;

  try {
    const resp = await httpGet(searchUrl, {
      headers: CKAN_HEADERS,
      timeoutMs: 30_000,
    });

    if (resp.statusCode >= 400) return [];

    const data = JSON.parse(resp.body);
    const results = data?.result?.results ?? [];
    return results.map((pkg: Record<string, unknown>) => ({
      id: String(pkg.id ?? ''),
      title: String(pkg.title ?? ''),
      resources: (pkg.resources as unknown[]) ?? [],
    }));
  } catch {
    return [];
  }
}


/**
 * Fetch proactive disclosure records filtered by a specific department.
 * Uses the department acronym to look up the owner_org and query the
 * CKAN Solr search.
 *
 * @param departmentAcronym - Department acronym (e.g. "PSPC", "DND")
 * @param options - Additional search options
 */
export async function fetchByDepartment(
  departmentAcronym: string,
  options: Omit<ProactiveDisclosureSearchOptions, 'departments'> = {},
): Promise<{
  total: number;
  records: RawCKANProactiveDisclosureDoc[];
  sourceUrl: string;
}> {
  // Build a query that includes the department name/acronym
  const query = `${DEFAULT_SEARCH_QUERY} ${departmentAcronym}`;

  return fetchProactiveDisclosure({
    ...options,
    query,
  });
}


/**
 * Fetch the raw resource data from a CKAN resource download URL.
 * Some departments publish proactive disclosure as CSV/JSON resources
 * within CKAN packages rather than indexed Solr documents.
 *
 * @param resourceUrl - The download URL for the resource
 */
export async function fetchResourceData(
  resourceUrl: string,
): Promise<string> {
  try {
    const resp = await httpGet(resourceUrl, {
      headers: CKAN_HEADERS,
      timeoutMs: 60_000,
    });

    if (resp.statusCode >= 400) {
      throw new PDError(
        `Resource fetch returned HTTP ${resp.statusCode}`,
        'RESOURCE_HTTP_ERROR',
        resourceUrl,
        resp.statusCode,
      );
    }

    return resp.body;
  } catch (err) {
    if (err instanceof PDError) throw err;
    throw new PDError(
      `Failed to fetch resource: ${err instanceof Error ? err.message : String(err)}`,
      'RESOURCE_FETCH_ERROR',
      resourceUrl,
    );
  }
}
