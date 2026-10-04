/**
 * Provincial Lobbying Fetcher — Quill
 *
 * HTTP fetchers for provincial lobbying registry data.
 * Primary target: Ontario Lobbyists Registry (Integrity Commissioner of Ontario).
 *
 * Data sources (in order of preference):
 *   1. Ontario Data Catalogue (CKAN) — search for lobbying CSV dumps
 *   2. Ontario Lobbyists Registry search (HTML parse)
 *   3. Monthly communication reports (if available)
 *   4. Direct API calls (if Ontario exposes an API)
 *
 * Uses undici for HTTP (consistent with the rest of the pipeline).
 */

import { httpGet } from '../../utils/http.js';
import {
  ONTARIO_LOBBYING,
  ONTARIO_CKAN,
  DEFAULT_FETCH_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
} from './constants.js';
import type { RawOntarioRecord } from './types.js';


export class ProvincialLobbyingFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
    public readonly province?: string,
  ) {
    super(message);
    this.name = 'ProvincialLobbyingFetchError';
  }
}


const DEFAULT_HEADERS = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'application/json,text/csv,text/html,*/*',
} as const;

/**
 * Fetch JSON from a URL.
 */
export async function fetchJson<T = unknown>(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const resp = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS as Record<string, string> },
    timeoutMs: options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new ProvincialLobbyingFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.json<T>();
}

/**
 * Fetch text (HTML, CSV) from a URL.
 */
export async function fetchText(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const resp = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS as Record<string, string> },
    timeoutMs: options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new ProvincialLobbyingFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.body;
}


/**
 * Response shape from Ontario CKAN package_search.
 */
interface OntarioCkanSearchResponse {
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
    count: number;
  };
}

interface OntarioCkanPackageResponse {
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

/**
 * Search the Ontario Data Catalogue for lobbying-related datasets.
 */
export async function searchOntarioCkanDatasets(
  query: string = ONTARIO_CKAN.LOBBYING_CKAN_QUERY,
  rows: number = 20,
): Promise<Array<{
  id: string;
  title: string;
  resources: Array<{ name: string; format: string; url: string; description: string | null }>;
}>> {
  const url = `${ONTARIO_CKAN.PACKAGE_SEARCH}?q=${encodeURIComponent(query)}&rows=${rows}`;

  try {
    const resp = await fetchJson<OntarioCkanSearchResponse>(url);

    if (!resp.success || !resp.result?.results) {
      return [];
    }

    return resp.result.results.map((pkg) => ({
      id: pkg.id,
      title: pkg.title,
      resources: (pkg.resources ?? []).map((r) => ({
        name: r.name,
        format: r.format,
        url: r.url,
        description: r.description,
      })),
    }));
  } catch (err) {
    console.warn('[ProvincialLobbying] Ontario CKAN search failed:', (err as Error).message);
    return [];
  }
}

/**
 * Fetch a specific CKAN package by ID from Ontario Data Catalogue.
 */
export async function fetchOntarioCkanPackage(
  packageId: string,
): Promise<{
  id: string;
  title: string;
  notes: string | null;
  resources: Array<{ id: string; name: string; format: string; url: string; description: string | null }>;
}> {
  const url = `${ONTARIO_CKAN.PACKAGE_SHOW}?id=${packageId}`;
  const resp = await fetchJson<OntarioCkanPackageResponse>(url);

  if (!resp.success || !resp.result) {
    throw new ProvincialLobbyingFetchError(
      `CKAN API error for package ${packageId}`,
      undefined,
      url,
      'ON',
    );
  }

  return resp.result;
}

/**
 * Fetch a CSV resource from Ontario CKAN and return raw text.
 */
export async function fetchOntarioCkanCsv(
  resourceUrl: string,
): Promise<string> {
  return fetchText(resourceUrl);
}


/**
 * Search the Ontario Lobbyists Registry by keyword.
 * Parses HTML search results to extract basic registration info.
 *
 * The Ontario registry search is at:
 *   https://lobbyist.oico.on.ca/lobbyistregistry/search
 */
export async function searchOntarioRegistry(
  query: string,
): Promise<Partial<RawOntarioRecord>[]> {
  const searchUrl = `${ONTARIO_LOBBYING.SEARCH}?q=${encodeURIComponent(query)}`;

  try {
    const html = await fetchText(searchUrl);
    return parseOntarioSearchHtml(html, searchUrl);
  } catch (err) {
    console.warn('[ProvincialLobbying] Ontario registry search failed:', (err as Error).message);
    return [];
  }
}

/**
 * Parse Ontario Lobbyists Registry HTML search results.
 *
 * The Ontario registry shows results in a table format with columns:
 *   - Registration Number
 *   - Lobbyist Name / Business Name
 *   - Client Name
 *   - Subject Matter
 *   - Status
 *   - Registration Date
 */
function parseOntarioSearchHtml(
  html: string,
  sourceUrl: string,
): Partial<RawOntarioRecord>[] {
  const results: Partial<RawOntarioRecord>[] = [];

  // Match table rows in the search results
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const cells = rowMatch[1].match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
    if (!cells || cells.length < 3) continue;

    const extractCell = (idx: number): string => {
      const cell = cells[idx];
      if (!cell) return '';
      return cell.replace(/<[^>]+>/g, '').trim();
    };

    // First cell typically has registration number (with link)
    const regLinkMatch = cells[0]?.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
    const registrationNumber = regLinkMatch
      ? regLinkMatch[1].replace(/<[^>]+>/g, '').trim()
      : extractCell(0);

    if (!registrationNumber) continue;

    results.push({
      registrationNumber,
      lobbyistName: extractCell(1) || undefined,
      clientName: extractCell(2) || undefined,
      subjectMatters: extractCell(3) ? [extractCell(3)] : [],
      sourceUrl: sourceUrl,
    });
  }

  return results;
}


/**
 * Fetch the list of monthly communication reports from the Ontario registry.
 *
 * Like the federal registry, Ontario may publish monthly CSV reports
 * listing who met with whom. This function checks for available reports.
 */
export async function fetchOntarioMonthlyReports(): Promise<Array<{
  year: number;
  month: number;
  csvUrl: string;
}>> {
  const reports: Array<{ year: number; month: number; csvUrl: string }> = [];

  try {
    const html = await fetchText(ONTARIO_LOBBYING.MONTHLY_REPORTS);

    // Parse links to monthly CSV/PDF files
    const linkPattern = /<a\s[^>]*href="([^"]*lobbying[^"]*report[^"]*(?:csv|pdf))"[^>]*>([\s\S]*?)<\/a>/gi;
    let linkMatch: RegExpExecArray | null;

    while ((linkMatch = linkPattern.exec(html)) !== null) {
      const href = linkMatch[1];
      const text = linkMatch[2].replace(/<[^>]+>/g, '').trim();

      const yearMatch = text.match(/(\d{4})/) || href.match(/(\d{4})/);
      const monthNames = /(January|February|March|April|May|June|July|August|September|October|November|December)/i;
      const monthMatch = text.match(monthNames);
      const monthMap: Record<string, number> = {
        january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
        july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
      };

      if (yearMatch) {
        reports.push({
          year: parseInt(yearMatch[1], 10),
          month: monthMatch ? (monthMap[monthMatch[0].toLowerCase()] ?? 0) : 0,
          csvUrl: href.startsWith('http') ? href : `${ONTARIO_LOBBYING.BASE.replace(/\/$/, '')}/${href.replace(/^\//, '')}`,
        });
      }
    }
  } catch (err) {
    console.warn('[ProvincialLobbying] Ontario monthly reports fetch failed:', (err as Error).message);
  }

  return reports;
}


/**
 * Fetch lobbying records from Ontario sources.
 * Tries sources in order:
 *   1. CKAN CSV dump (if available)
 *   2. HTML search (fallback)
 */
export async function fetchOntarioLobbying(
  options: {
    /** Search query for filtering (optional) */
    query?: string;
    /** Number of records to return */
    limit?: number;
  } = {},
): Promise<{
  records: RawOntarioRecord[];
  source: string;
  errors: string[];
}> {
  const errors: string[] = [];
  let records: RawOntarioRecord[] = [];
  let source = 'none';

  // Step 1: Try CKAN datasets
  try {
    const datasets = await searchOntarioCkanDatasets();
    if (datasets.length > 0) {
      source = 'ckan';

      // Try to fetch CSV resources from found datasets
      for (const dataset of datasets) {
        for (const resource of dataset.resources) {
          if (resource.format?.toUpperCase() === 'CSV') {
            try {
              const csvText = await fetchOntarioCkanCsv(resource.url);
              // Parse CSV into raw records (basic line-by-line)
              const lines = csvText.split('\n').filter(line => line.trim().length > 0);
              if (lines.length > 1) {
                const headers = lines[0].split(',').map(h => h.trim());
                for (let i = 1; i < lines.length; i++) {
                  const values = lines[i].split(',').map(v => v.trim());
                  const record: RawOntarioRecord = {};
                  headers.forEach((header, idx) => {
                    const key = header.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '_');
                    record[key] = values[idx] || undefined;
                  });
                  record.sourceUrl = resource.url;
                  records.push(record);
                }
              }
            } catch (err) {
              errors.push(`CKAN CSV fetch failed for ${resource.url}: ${(err as Error).message}`);
            }
          }
        }
      }
    }
  } catch (err) {
    errors.push(`CKAN search failed: ${(err as Error).message}`);
  }

  // Step 2: Try HTML search if CKAN yielded no results
  if (records.length === 0 && options.query) {
    try {
      const searchResults = await searchOntarioRegistry(options.query);
      records = searchResults as RawOntarioRecord[];
      source = 'html-search';
    } catch (err) {
      errors.push(`HTML search failed: ${(err as Error).message}`);
    }
  }

  // Step 3: Try monthly reports as additional source
  try {
    const reports = await fetchOntarioMonthlyReports();
    if (reports.length > 0) {
      // Monthly reports are supplementary — log availability
      // Actual CSV parsing would happen when implementing incremental ingestion
    }
  } catch {
    // Non-fatal
  }

  if (options.limit && records.length > options.limit) {
    records = records.slice(0, options.limit);
  }

  return { records, source, errors };
}
