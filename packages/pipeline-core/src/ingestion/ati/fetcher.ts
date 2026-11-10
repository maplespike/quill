// SPDX-License-Identifier: AGPL-3.0-only
/**
 * ATI (Access to Information) Fetcher — Quill
 *
 * Fetches completed ATI request records from the Government of Canada's
 * open.canada.ca CKAN portal and individual department ATI pages.
 *
 * Primary source:
 *   CKAN API on open.canada.ca — search for ATI completion datasets
 *   https://open.canada.ca/data/api/3/action/package_search?q=ati
 *
 * Uses undici for HTTP (consistent with the rest of the pipeline).
 */

import { httpGet } from '../../utils/http.js';
import {
  ATI_SOURCES,
  ATI_CKAN_ORG_MAP,
  ATI_DISPOSITION_MAP,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_HEADERS,
} from './constants.js';
import type { AtiError } from './constants.js';
import type { RawAtiCkanPackage, RawAtiRecord } from './types.js';
import type { HttpResponse } from '../../utils/http.js';

import { parseCsvLine } from '../../utils/csv.js';
/* ------------------------------------------------------------------ */
/*  Error Class                                                        */
/* ------------------------------------------------------------------ */

export class AtiFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
    public readonly department?: string,
  ) {
    super(message);
    this.name = 'AtiFetchError';
  }
}

/* ------------------------------------------------------------------ */
/*  HTTP Helpers                                                       */
/* ------------------------------------------------------------------ */

/**
 * Fetch JSON from a URL.
 */
async function fetchJson<T = unknown>(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const resp: HttpResponse = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new AtiFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.json<T>();
}

/**
 * Fetch raw text from a URL.
 */
async function fetchText(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const resp: HttpResponse = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new AtiFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.body;
}

/* ------------------------------------------------------------------ */
/*  CKAN Response Types                                                */
/* ------------------------------------------------------------------ */

interface CkanPackageSearchResponse {
  success: boolean;
  result: {
    count: number;
    results: RawAtiCkanPackage[];
    facets?: Record<string, unknown>;
  };
  error?: { message?: string };
}

interface CkanPackageShowResponse {
  success: boolean;
  result: RawAtiCkanPackage;
  error?: { message?: string };
}

/* ------------------------------------------------------------------ */
/*  CKAN Search                                                        */
/* ------------------------------------------------------------------ */

/**
 * Search the open.canada.ca CKAN for ATI-related packages.
 *
 * @param query - CKAN search query (default: ATI query)
 * @param rows - Max results per page
 * @param orgFilter - Optional CKAN organization name to filter by department
 * @returns Array of matching CKAN packages
 */
export async function searchAtiCkanPackages(
  query: string = ATI_SOURCES.ATI_CKAN_QUERY,
  rows: number = 50,
  orgFilter?: string,
): Promise<RawAtiCkanPackage[]> {
  let url = `${ATI_SOURCES.CKAN.PACKAGE_SEARCH}?q=${encodeURIComponent(query)}&rows=${rows}&sort=metadata_modified desc`;

  if (orgFilter) {
    url += `&fq=organization:${encodeURIComponent(orgFilter)}`;
  }

  try {
    const resp = await fetchJson<CkanPackageSearchResponse>(url);

    if (!resp.success || !resp.result?.results) {
      if (resp.error?.message) {
        console.warn('[ATI] CKAN search error:', resp.error.message);
      }
      return [];
    }

    return resp.result.results;
  } catch (err) {
    console.warn('[ATI] CKAN search failed:', (err as Error).message);
    return [];
  }
}

/**
 * Fetch a specific CKAN package by ID.
 *
 * @param packageId - CKAN package UUID
 * @returns Raw CKAN package data
 */
export async function fetchAtiCkanPackage(
  packageId: string,
): Promise<RawAtiCkanPackage | null> {
  const url = `${ATI_SOURCES.CKAN.PACKAGE_SHOW}?id=${packageId}`;

  try {
    const resp = await fetchJson<CkanPackageShowResponse>(url);

    if (!resp.success || !resp.result) {
      return null;
    }

    return resp.result;
  } catch (err) {
    console.warn(`[ATI] CKAN package fetch failed for ${packageId}:`, (err as Error).message);
    return null;
  }
}

/**
 * Fetch ATI data from a CKAN resource URL (CSV or JSON).
 *
 * @param resourceUrl - URL of the CKAN resource
 * @returns Raw text content (CSV) or parsed object for JSON
 */
export async function fetchAtiResource(
  resourceUrl: string,
): Promise<string> {
  return fetchText(resourceUrl);
}

/* ------------------------------------------------------------------ */
/*  Department ATI Pages                                               */
/* ------------------------------------------------------------------ */

/**
 * Fetch the ATI completions page from a department website.
 * Used as a supplementary source when CKAN data is incomplete.
 *
 * @param department - Department acronym (e.g. 'PSPC', 'HC')
 * @returns HTML text of the department ATI page
 */
export async function fetchDepartmentAtiPage(
  department: string,
): Promise<string | null> {
  const deptUrls = ATI_SOURCES.DEPARTMENT_ATI as Record<string, string>;
  const url = deptUrls[department];

  if (!url) {
    return null;
  }

  try {
    return await fetchText(url);
  } catch (err) {
    console.warn(`[ATI] Department page fetch failed for ${department}:`, (err as Error).message);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Main Fetch Entry Points                                            */
/* ------------------------------------------------------------------ */

/**
 * Fetch ATI completions for a specific department.
 *
 * Strategy:
 *   1. Search CKAN for ATI packages published by this department
 *   2. Parse CSV/JSON resources from matched packages
 *   3. Fall back to department ATI page if CKAN yields nothing
 *
 * @param department - Department acronym (e.g. 'PSPC')
 * @param options - Fetch options
 * @returns Raw ATI records + source metadata
 */
export async function fetchAtiReleases(
  department: string,
  options: {
    /** Override fiscal year to search */
    fiscalYear?: string;
    /** Max records to return */
    limit?: number;
    /** CKAN organization name override (if different from default mapping) */
    ckanOrgName?: string;
  } = {},
): Promise<{
  records: RawAtiRecord[];
  source: string;
  errors: string[];
}> {
  const errors: string[] = [];
  let records: RawAtiRecord[] = [];
  let source = 'none';

  // Determine CKAN org name for this department
  const deptInfo = Object.values(ATI_CKAN_ORG_MAP).find(
    d => d.acronym === department,
  );
  const orgName = options.ckanOrgName;

  // Step 1: Search CKAN for this department's ATI datasets
  try {
    const query = options.fiscalYear
      ? `ati completed ${options.fiscalYear} access to information`
      : ATI_SOURCES.ATI_CKAN_QUERY;

    const packages = await searchAtiCkanPackages(query, 50, orgName);

    if (packages.length > 0) {
      source = 'ckan';
      records.push(...packages.map(pkg => atiCkanPackageToRaw(pkg, department)));

      // Step 1b: Try to fetch CSV resources from packages for more detail
      for (const pkg of packages) {
        for (const resource of pkg.resources ?? []) {
          if (resource.format?.toUpperCase() === 'CSV') {
            try {
              const csvText = await fetchAtiResource(resource.url);
              const csvRecords = parseAtiCsvToRaw(csvText, resource.url, department);
              records.push(...csvRecords);
            } catch (err) {
              errors.push(`CKAN CSV fetch failed for ${resource.url}: ${(err as Error).message}`);
            }
          }
        }
      }
    }
  } catch (err) {
    errors.push(`CKAN search failed for ${department}: ${(err as Error).message}`);
  }

  // Step 2: Try department ATI page as fallback
  if (records.length === 0) {
    try {
      const html = await fetchDepartmentAtiPage(department);
      if (html) {
        const htmlRecords = parseDepartmentAtiHtml(html, department);
        records.push(...htmlRecords);
        source = 'department-page';
      }
    } catch (err) {
      errors.push(`Department page parse failed for ${department}: ${(err as Error).message}`);
    }
  }

  if (options.limit && records.length > options.limit) {
    records = records.slice(0, options.limit);
  }

  return { records, source, errors };
}

/**
 * Fetch ATI completions for all tracked departments.
 *
 * @param options - Fetch options (applied per-department)
 * @returns Map of department acronym to fetch results
 */
export async function fetchAllAtiReleases(
  options: {
    departments?: string[];
    fiscalYear?: string;
    limit?: number;
  } = {},
): Promise<Record<string, {
  records: RawAtiRecord[];
  source: string;
  errors: string[];
}>> {
  const depts = options.departments ?? Object.values(ATI_CKAN_ORG_MAP).map(d => d.acronym);
  // Deduplicate
  const uniqueDepts = [...new Set(depts)];

  const results: Record<string, {
    records: RawAtiRecord[];
    source: string;
    errors: string[];
  }> = {};

  for (const dept of uniqueDepts) {
    results[dept] = await fetchAtiReleases(dept, {
      fiscalYear: options.fiscalYear,
      limit: options.limit,
    });
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  Parsing Helpers (within fetcher)                                   */
/* ------------------------------------------------------------------ */

/**
 * Convert a CKAN package to a raw ATI record.
 * CKAN packages represent ATI completion datasets, not individual
 * request records — this extracts the package-level metadata.
 */
function atiCkanPackageToRaw(
  pkg: RawAtiCkanPackage,
  department: string,
): RawAtiRecord {
  const summary = pkg.notes ?? pkg.title;
  const disposition = extractDispositionFromTitle(pkg.title);

  return {
    department,
    departmentAcronym: department,
    requestNumber: pkg.id.substring(0, 8),
    summary,
    disposition,
    dateCompleted: pkg.metadata_created,
    fiscalYear: extractFiscalYear(pkg.title) || extractFiscalYear(pkg.notes ?? '') || undefined,
    sourceUrl: `${ATI_SOURCES.CKAN.BASE}/dataset/${pkg.name}`,
    ckanPackageId: pkg.id,
    sourceSystem: 'open-canada-ckan',
  };
}

/**
 * Parse a CSV resource from a CKAN ATI package into raw records.
 * ATI completion CSVs typically have columns like:
 *   Request Number, Summary, Disposition, Pages Released, Pages Withheld, Date
 */
function parseAtiCsvToRaw(
  csvText: string,
  sourceUrl: string,
  department: string,
): RawAtiRecord[] {
  const results: RawAtiRecord[] = [];
  const lines = csvText.split('\n').filter(line => line.trim().length > 0);

  if (lines.length < 2) return results;

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const record: RawAtiRecord = {
      department,
      departmentAcronym: department,
      sourceUrl,
      sourceSystem: 'ckan-csv',
    };

    headers.forEach((header, idx) => {
      const value = values[idx] ?? '';
      const normalizedHeader = header
        .replace(/[\s-]+/g, '_')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .toLowerCase();

      // Map CSV column names to our schema
      switch (normalizedHeader) {
        case 'request_number':
        case 'requestnumber':
        case 'reference_number':
          record.requestNumber = value;
          break;
        case 'summary':
        case 'request_summary':
        case 'description':
          record.summary = value;
          break;
        case 'disposition':
        case 'disposition_en':
        case 'outcome':
          record.disposition = normalizeDisposition(value);
          break;
        case 'pages_released':
        case 'pages':
        case 'pagesdisclosed':
          record.pagesReleased = value;
          break;
        case 'pages_withheld':
        case 'pagesexempted':
          record.pagesWithheld = value;
          break;
        case 'date_completed':
        case 'completion_date':
        case 'date':
        case 'completiondate':
          record.dateCompleted = value;
          break;
        case 'fiscal_year':
        case 'fiscalyear':
          record.fiscalYear = value;
          break;
        default:
          // Store unknown fields through the catch-all
          record[normalizedHeader] = value;
          break;
      }
    });

    results.push(record);
  }

  return results;
}



/**
 * Parse a department ATI page HTML into raw records.
 * Department ATI pages use various HTML table formats.
 */
function parseDepartmentAtiHtml(
  html: string,
  department: string,
): RawAtiRecord[] {
  const results: RawAtiRecord[] = [];

  // Match table rows containing ATI completion data
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

    const requestNumber = extractCell(0);
    if (!requestNumber || requestNumber.length < 3) continue;

    results.push({
      department,
      departmentAcronym: department,
      requestNumber,
      summary: extractCell(1) || undefined,
      disposition: normalizeDisposition(extractCell(2)),
      dateCompleted: extractCell(3) || undefined,
      sourceUrl: ATI_SOURCES.DEPARTMENT_ATI[department as keyof typeof ATI_SOURCES.DEPARTMENT_ATI] ?? '',
      sourceSystem: 'department-ati-page',
    });
  }

  return results;
}

/**
 * Normalize a raw disposition string to our standard format.
 */
function normalizeDisposition(raw: string): string | undefined {
  if (!raw) return undefined;
  const lower = raw.trim().toLowerCase();

  // Try direct map first
  const mapped = ATI_DISPOSITION_MAP[lower];
  if (mapped) return mapped;

  // Partial matching
  if (lower.includes('all disclosed') || lower.includes('disclosed') && !lower.includes('part')) return 'disclosed';
  if (lower.includes('partially disclosed') || lower.includes('disclosed in part') || lower.includes('exempted in part')) return 'disclosed-part';
  if (lower.includes('exempted') || lower.includes('exempt')) return 'exempted';
  if (lower.includes('excluded') || lower.includes('exclusion')) return 'excluded';
  if (lower.includes('no record') || lower.includes('none')) return 'no-records';
  if (lower.includes('transferred')) return 'transferred';
  if (lower.includes('abandoned')) return 'abandoned';
  if (lower.includes('pending') || lower.includes('in process')) return 'pending';

  return 'unknown';
}

/**
 * Extract a disposition hint from a CKAN package title.
 * Titles often include hints like "ATI 2023-24 Completions - Disclosed in part".
 */
function extractDispositionFromTitle(title: string): string | undefined {
  return normalizeDisposition(title) ?? undefined;
}

/**
 * Extract a 4-digit year or fiscal year from text.
 */
function extractFiscalYear(text: string): string | null {
  if (!text) return null;

  // Match fiscal years like "2023-24" or "20232024"
  const fiscalPattern = /(20\d{2})[-–](20)?(\d{2})/;
  const fiscalMatch = text.match(fiscalPattern);
  if (fiscalMatch) {
    const start = fiscalMatch[1];
    const end = fiscalMatch[3];
    return `${start}-${end}`;
  }

  // Match 4-digit years
  const yearPattern = /\b(20\d{2})\b/;
  const yearMatch = text.match(yearPattern);
  if (yearMatch) {
    return yearMatch[1];
  }

  return null;
}
