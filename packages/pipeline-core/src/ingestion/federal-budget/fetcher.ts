// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Federal Budget Fetcher — Quill
 *
 * HTTP fetchers for Canadian federal budget data, public accounts,
 * fiscal monitor reports, and departmental plans.
 *
 * Sources:
 *   - budget.canada.ca — Federal budget documents (HTML + PDF)
 *   - open.canada.ca CKAN — Structured budget datasets, public accounts CSV
 *   - fin.gc.ca — Fiscal Monitor monthly data
 *   - canada.ca/departmental-plans — Departmental Plans and Results Reports
 *
 * The main entry point is fetchBudgetData(year) which dispatches to
 * source-specific fetchers.
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  BUDGET_SOURCES,
  BUDGET_CKAN_PACKAGE_IDS,
  DEFAULT_HEADERS,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RECORDS,
  BudgetError,
  FEDERAL_DEPARTMENTS,
} from './constants.js';
import type {
  BudgetRecord,
  BudgetRecordType,
  BudgetCategory,
  BudgetIngestionOptions,
  CKANPackageResponse,
  CKANResource,
  CKANPackage,
  RawPublicAccountsRow,
  RawFiscalMonitorRow,
  RawDepartmentalPlanRow,
} from './types.js';

/* ------------------------------------------------------------------ */
/*  Helper: Normalize fiscal year string                               */
/* ------------------------------------------------------------------ */

/**
 * Normalize a fiscal year string to "YYYY-YY" format.
 * Accepts: "2024", "2024-25", "2024-2025", "24-25"
 * Returns: "2024-25"
 */
export function normalizeFiscalYear(year: string): string {
  const trimmed = year.trim();
  // Already in YYYY-YY format
  if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
  // YYYY-YYYY format
  const match4 = trimmed.match(/^(\d{4})-(\d{4})$/);
  if (match4) return `${match4[1]}-${match4[2].slice(2)}`;
  // Single YYYY
  if (/^\d{4}$/.test(trimmed)) {
    const y = parseInt(trimmed, 10);
    return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
  }
  // YY-YY format
  const match2 = trimmed.match(/^(\d{2})-(\d{2})$/);
  if (match2) {
    const prefix = parseInt(match2[1], 10) >= 80 ? '19' : '20';
    return `${prefix}${match2[1]}-${match2[2]}`;
  }
  return trimmed;
}

/**
 * Extract a 4-digit fiscal year from text.
 */
export function extractFourDigitYear(text: string): string | null {
  const match = text.match(/\b(20\d{2})\b/);
  return match ? match[1] : null;
}

/* ------------------------------------------------------------------ */
/*  CKAN Search & Data Fetching                                        */
/* ------------------------------------------------------------------ */

/**
 * Search for datasets on open.canada.ca CKAN.
 *
 * @param query - CKAN search query string
 * @param maxResults - Maximum results to return (default: 50)
 * @returns Array of CKAN packages
 */
export async function searchCKAN(
  query: string,
  maxResults: number = 50,
): Promise<CKANPackage[]> {
  const url = `${BUDGET_SOURCES.CKAN.SEARCH}?q=${encodeURIComponent(query)}&rows=${maxResults}`;

  const resp = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS, Accept: 'application/json' },
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new BudgetError(
      `CKAN search returned HTTP ${resp.statusCode}`,
      'CKAN_SEARCH_ERROR',
      undefined,
      url,
      resp.statusCode,
    );
  }

  const data = await resp.json<CKANPackageResponse>();
  return data?.result?.results ?? [];
}

/**
 * Fetch CKAN package details (including resources) by package ID.
 *
 * @param packageId - CKAN package UUID
 * @returns CKAN package with resources
 */
export async function fetchCKANPackage(
  packageId: string,
): Promise<CKANPackage | null> {
  const url = `${BUDGET_SOURCES.CKAN.PACKAGE_SHOW}?id=${encodeURIComponent(packageId)}`;

  try {
    const resp = await httpGet(url, {
      headers: { ...DEFAULT_HEADERS, Accept: 'application/json' },
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode >= 400) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await resp.json<any>();
    return data?.result ?? null;
  } catch (err) {
    console.warn(`[Budget Fetcher] CKAN package fetch failed for ${packageId}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Fetch a CKAN resource (file) by URL.
 *
 * @param url - Resource URL (CSV, JSON, etc.)
 * @returns Raw text content of the resource
 */
export async function fetchCKANResource(url: string): Promise<string> {
  const resp = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS, Accept: 'text/csv,application/json,*/*' },
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new BudgetError(
      `CKAN resource returned HTTP ${resp.statusCode}`,
      'CKAN_RESOURCE_ERROR',
      undefined,
      url,
      resp.statusCode,
    );
  }

  return resp.body;
}

/* ------------------------------------------------------------------ */
/*  Budget Canada — Fetch Federal Budget Documents                     */
/* ------------------------------------------------------------------ */

/**
 * Fetch federal budget documents for a given year.
 * Searches CKAN for budget datasets and returns budget records.
 *
 * @param year - Fiscal year (e.g. "2024", "2024-25")
 * @param options - Fetch options
 * @returns Array of BudgetRecord
 */
export async function fetchBudgetData(
  year: string,
  options: {
    maxRecords?: number;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<BudgetRecord[]> {
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  const now = new Date().toISOString();
  const records: BudgetRecord[] = [];
  const log = options.onProgress ?? (() => {});
  const fiscalYear = normalizeFiscalYear(year);

  log(`[Budget Fetcher] Fetching budget data for ${fiscalYear}...`);

  // Try CKAN first — look up budget package for the year
  const yearShort = year.replace(/[^0-9]/g, '').slice(0, 4);
  const packageIdKey = `BUDGET_${yearShort}` as keyof typeof BUDGET_CKAN_PACKAGE_IDS;
  const packageId = BUDGET_CKAN_PACKAGE_IDS[packageIdKey];

  if (packageId) {
    log(`[Budget Fetcher] Found CKAN package ID for ${fiscalYear}: ${packageId}`);
    const pkg = await fetchCKANPackage(packageId);

    if (pkg) {
      for (const resource of pkg.resources.slice(0, maxRecords)) {
        try {
          const hashContent = `budget|${fiscalYear}|${resource.name}|${resource.url}`;
          const id = await computeHash(hashContent, 'sha256');

          records.push({
            id,
            fiscalYear,
            recordType: 'budget',
            department: pkg.organization?.title ?? null,
            departmentAcronym: pkg.organization?.name ?? null,
            category: 'unallocated',
            amount: null,
            currency: 'CAD',
            description: resource.name || null,
            title: resource.name || null,
            publishedDate: resource.created || null,
            fiscalQuarter: null,
            sourceUrl: resource.url,
            sourceSystem: 'ckan-budget',
            ckanPackageId: pkg.id,
            ckanResourceId: resource.id,
            language: resource.name?.toLowerCase().includes('fr') ? 'fr' : 'en',
            ingestedAt: now,
          });
        } catch (err) {
          console.warn(`[Budget Fetcher] Skipping resource "${resource.name}": ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  } else {
    log(`[Budget Fetcher] No CKAN package for ${fiscalYear}, using budget.canada.ca...`);
  }

  // Also try to fetch the budget plan page for additional records
  try {
    const budgetUrl = `${BUDGET_SOURCES.BUDGET_CANADA.BUDGET_PLAN}`;
    const resp = await httpGet(budgetUrl, {
      headers: { ...DEFAULT_HEADERS, Accept: 'text/html,*/*' },
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode < 400) {
      // Extract budget document links from the HTML
      const links = extractDocumentLinks(resp.body, budgetUrl);
      for (const link of links.slice(0, maxRecords)) {
        const hashContent = `budget-listing|${link.url}|${link.text}`;
        const id = await computeHash(hashContent, 'sha256');

        records.push({
          id,
          fiscalYear,
          recordType: 'budget',
          department: 'Department of Finance Canada',
          departmentAcronym: 'FIN',
          category: 'unallocated',
          amount: null,
          currency: 'CAD',
          description: link.text || null,
          title: link.text || null,
          publishedDate: null,
          fiscalQuarter: null,
          sourceUrl: link.url,
          sourceSystem: 'budget-canada-listing',
          ckanPackageId: null,
          ckanResourceId: null,
          language: link.url.toLowerCase().includes('fra') ? 'fr' : 'en',
          ingestedAt: now,
        });
      }
    }
  } catch (err) {
    log(`[Budget Fetcher] Budget listing page fetch: ${err instanceof Error ? err.message : String(err)}`);
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Public Accounts of Canada — Fetch CSV Data                         */
/* ------------------------------------------------------------------ */

/**
 * Fetch Public Accounts of Canada data.
 * Public Accounts are published annually by the Receiver General.
 *
 * @param year - Fiscal year (e.g. "2024", "2024-25")
 * @param options - Fetch options
 * @returns Array of BudgetRecord
 */
export async function fetchPublicAccounts(
  year: string,
  options: {
    maxRecords?: number;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<BudgetRecord[]> {
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  const now = new Date().toISOString();
  const records: BudgetRecord[] = [];
  const log = options.onProgress ?? (() => {});
  const fiscalYear = normalizeFiscalYear(year);

  log(`[Budget Fetcher] Fetching Public Accounts for ${fiscalYear}...`);

  // Try CKAN for Public Accounts CSV data
  const yearShort = year.replace(/[^0-9]/g, '').slice(0, 4);
  const paPackageKey = `PUBLIC_ACCOUNTS_${yearShort}` as keyof typeof BUDGET_CKAN_PACKAGE_IDS;
  const packageId = BUDGET_CKAN_PACKAGE_IDS[paPackageKey];

  if (packageId) {
    log(`[Budget Fetcher] Found Public Accounts CKAN package: ${packageId}`);
    const pkg = await fetchCKANPackage(packageId);

    if (pkg) {
      for (const resource of pkg.resources.slice(0, maxRecords)) {
        try {
          const hashContent = `public-accounts|${fiscalYear}|${resource.name}|${resource.url}`;
          const id = await computeHash(hashContent, 'sha256');

          let category: BudgetCategory = 'unallocated';
          const nameLower = (resource.name ?? '').toLowerCase();
          if (/revenue|tax/i.test(nameLower)) category = 'revenue';
          else if (/expense|program|spending/i.test(nameLower)) category = 'expense';
          else if (/debt|borrow/i.test(nameLower)) category = 'debt';
          else if (/deficit|surplus|balance/i.test(nameLower)) category = 'deficit';
          else if (/transfer/i.test(nameLower)) category = 'transfer';

          records.push({
            id,
            fiscalYear,
            recordType: 'public_accounts',
            department: pkg.organization?.title ?? null,
            departmentAcronym: pkg.organization?.name ?? null,
            category,
            amount: null,
            currency: 'CAD',
            description: resource.name || null,
            title: resource.name || null,
            publishedDate: resource.created || null,
            fiscalQuarter: null,
            sourceUrl: resource.url,
            sourceSystem: 'ckan-public-accounts',
            ckanPackageId: pkg.id,
            ckanResourceId: resource.id,
            language: nameLower.includes('fr') ? 'fr' : 'en',
            ingestedAt: now,
          });
        } catch (err) {
          console.warn(`[Budget Fetcher] Skipping PA resource "${resource.name}": ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  } else {
    log(`[Budget Fetcher] No CKAN package for PA ${fiscalYear}, fetching from TPSGC...`);
  }

  // Fallback: try direct URL from TPSGC
  try {
    const paUrl = BUDGET_SOURCES.PUBLIC_ACCOUNTS.CSV_DATA;
    const resp = await httpGet(paUrl, {
      headers: { ...DEFAULT_HEADERS, Accept: 'text/html,*/*' },
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode < 400) {
      const links = extractDocumentLinks(resp.body, paUrl);
      for (const link of links.slice(0, maxRecords)) {
        const hashContent = `pa-tpsgc|${link.url}|${link.text}`;
        const id = await computeHash(hashContent, 'sha256');

        records.push({
          id,
          fiscalYear,
          recordType: 'public_accounts',
          department: null,
          departmentAcronym: null,
          category: 'unallocated',
          amount: null,
          currency: 'CAD',
          description: link.text || null,
          title: link.text || null,
          publishedDate: null,
          fiscalQuarter: null,
          sourceUrl: link.url,
          sourceSystem: 'tpsgc-public-accounts',
          ckanPackageId: null,
          ckanResourceId: null,
          language: link.url.toLowerCase().includes('fra') ? 'fr' : 'en',
          ingestedAt: now,
        });
      }
    }
  } catch (err) {
    log(`[Budget Fetcher] TPSGC PA listing: ${err instanceof Error ? err.message : String(err)}`);
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Fiscal Monitor — Monthly Fiscal Data                               */
/* ------------------------------------------------------------------ */

/**
 * Fetch Fiscal Monitor data — monthly updates on Canada's fiscal situation
 * published by the Department of Finance Canada.
 *
 * @param options - Fetch options
 * @returns Array of BudgetRecord
 */
export async function fetchFiscalMonitor(
  options: {
    year?: string;
    maxRecords?: number;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<BudgetRecord[]> {
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  const now = new Date().toISOString();
  const records: BudgetRecord[] = [];
  const log = options.onProgress ?? (() => {});
  const year = options.year ?? new Date().getFullYear().toString();

  log(`[Budget Fetcher] Fetching Fiscal Monitor data for ${year}...`);

  // Try CKAN for Fiscal Monitor data tables
  const packageId = BUDGET_CKAN_PACKAGE_IDS.FISCAL_MONITOR_DATA;

  if (packageId) {
    const pkg = await fetchCKANPackage(packageId);
    if (pkg) {
      for (const resource of pkg.resources.slice(0, maxRecords)) {
        try {
          const hashContent = `fiscal-monitor|${resource.name}|${resource.url}`;
          const id = await computeHash(hashContent, 'sha256');

          const nameLower = (resource.name ?? '').toLowerCase();
          let category: BudgetCategory = 'unallocated';
          if (/revenue|tax/i.test(nameLower)) category = 'revenue';
          else if (/expense|spending/i.test(nameLower)) category = 'expense';
          else if (/deficit|surplus|balance/i.test(nameLower)) category = 'deficit';
          else if (/debt/i.test(nameLower)) category = 'debt';

          records.push({
            id,
            fiscalYear: year,
            recordType: 'fiscal_monitor',
            department: 'Department of Finance Canada',
            departmentAcronym: 'FIN',
            category,
            amount: null,
            currency: 'CAD',
            description: resource.name || null,
            title: resource.name || null,
            publishedDate: resource.created || null,
            fiscalQuarter: null,
            sourceUrl: resource.url,
            sourceSystem: 'ckan-fiscal-monitor',
            ckanPackageId: pkg.id,
            ckanResourceId: resource.id,
            language: nameLower.includes('fr') ? 'fr' : 'en',
            ingestedAt: now,
          });
        } catch (err) {
          console.warn(`[Budget Fetcher] Skipping FM resource "${resource.name}": ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }

  // Also try the Finance Canada FM page
  try {
    const fmUrl = BUDGET_SOURCES.FISCAL_MONITOR.BASE;
    const resp = await httpGet(fmUrl, {
      headers: { ...DEFAULT_HEADERS, Accept: 'text/html,*/*' },
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (resp.statusCode < 400) {
      const links = extractDocumentLinks(resp.body, fmUrl);
      for (const link of links.slice(0, maxRecords)) {
        const hashContent = `fm-fin|${link.url}|${link.text}`;
        const id = await computeHash(hashContent, 'sha256');

        records.push({
          id,
          fiscalYear: year,
          recordType: 'fiscal_monitor',
          department: 'Department of Finance Canada',
          departmentAcronym: 'FIN',
          category: 'unallocated',
          amount: null,
          currency: 'CAD',
          description: link.text || null,
          title: link.text || null,
          publishedDate: null,
          fiscalQuarter: null,
          sourceUrl: link.url,
          sourceSystem: 'fin-fiscal-monitor',
          ckanPackageId: null,
          ckanResourceId: null,
          language: link.url.toLowerCase().includes('fra') ? 'fr' : 'en',
          ingestedAt: now,
        });
      }
    }
  } catch (err) {
    log(`[Budget Fetcher] FM page: ${err instanceof Error ? err.message : String(err)}`);
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Departmental Plans & Results Reports                               */
/* ------------------------------------------------------------------ */

/**
 * Fetch Departmental Plans and Results Reports for federal departments.
 *
 * @param options - Fetch options
 * @returns Array of BudgetRecord
 */
export async function fetchDepartmentalPlans(
  options: {
    year?: string;
    department?: string;
    maxRecords?: number;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<BudgetRecord[]> {
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  const now = new Date().toISOString();
  const records: BudgetRecord[] = [];
  const log = options.onProgress ?? (() => {});
  const year = options.year ?? new Date().getFullYear().toString();
  const fiscalYear = normalizeFiscalYear(year);

  log(`[Budget Fetcher] Fetching Departmental Plans for ${fiscalYear}...`);

  // Try CKAN for Departmental Plans
  const packageId = BUDGET_CKAN_PACKAGE_IDS.DEPARTMENTAL_PLANS;

  if (packageId) {
    const pkg = await fetchCKANPackage(packageId);
    if (pkg) {
      for (const resource of pkg.resources.slice(0, maxRecords)) {
        // Filter by department if specified
        if (options.department && !(resource.name ?? '').toLowerCase().includes(options.department.toLowerCase())) {
          continue;
        }

        try {
          const hashContent = `dept-plan|${fiscalYear}|${resource.name}|${resource.url}`;
          const id = await computeHash(hashContent, 'sha256');

          // Try to determine which department from the resource name
          let departmentName: string | null = null;
          let departmentAcr: string | null = null;
          const nameLower = (resource.name ?? '').toLowerCase();
          for (const dept of FEDERAL_DEPARTMENTS) {
            if (nameLower.includes(dept.acronym.toLowerCase()) || nameLower.includes(dept.name.toLowerCase().split(' ')[0].toLowerCase())) {
              departmentName = dept.name;
              departmentAcr = dept.acronym;
              break;
            }
          }

          records.push({
            id,
            fiscalYear,
            recordType: 'departmental_plan',
            department: departmentName ?? pkg.organization?.title ?? null,
            departmentAcronym: departmentAcr ?? pkg.organization?.name ?? null,
            category: 'unallocated',
            amount: null,
            currency: 'CAD',
            description: resource.name || null,
            title: resource.name || null,
            publishedDate: resource.created || null,
            fiscalQuarter: null,
            sourceUrl: resource.url,
            sourceSystem: 'ckan-departmental-plans',
            ckanPackageId: pkg.id,
            ckanResourceId: resource.id,
            language: nameLower.includes('fr') ? 'fr' : 'en',
            ingestedAt: now,
          });
        } catch (err) {
          console.warn(`[Budget Fetcher] Skipping DP resource "${resource.name}": ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Main Entry Point — Fetch All Budget Data by Year                   */
/* ------------------------------------------------------------------ */

/**
 * Fetch all federal budget/fiscal data for a given year.
 * Aggregates from budget documents, public accounts, fiscal monitor,
 * and departmental plans.
 *
 * @param year - Fiscal year (e.g. "2024", "2024-25")
 * @param options - Ingestion options
 * @returns Aggregated record of all budget data sources
 */
export async function fetchAllBudgetData(
  year: string,
  options: Partial<BudgetIngestionOptions> & {
    recordTypes?: BudgetRecordType[];
    onProgress?: (msg: string) => void;
  } = {},
): Promise<Record<string, BudgetRecord[]>> {
  const log = options.onProgress ?? (() => {});
  const recordTypes = options.recordTypes;
  const result: Record<string, BudgetRecord[]> = {};

  // Budget documents
  if (!recordTypes || recordTypes.includes('budget')) {
    try {
      log('[Budget Fetcher] Fetching budget data...');
      result['budget'] = await fetchBudgetData(year, { ...options, onProgress: log });
      log(`[Budget Fetcher] Found ${result['budget'].length} budget records`);
    } catch (err) {
      log(`[Budget Fetcher] Budget fetch error: ${err instanceof Error ? err.message : String(err)}`);
      result['budget'] = [];
    }
  }

  // Public Accounts
  if (!recordTypes || recordTypes.includes('public_accounts')) {
    try {
      log('[Budget Fetcher] Fetching public accounts...');
      result['public_accounts'] = await fetchPublicAccounts(year, { ...options, onProgress: log });
      log(`[Budget Fetcher] Found ${result['public_accounts'].length} public accounts records`);
    } catch (err) {
      log(`[Budget Fetcher] PA fetch error: ${err instanceof Error ? err.message : String(err)}`);
      result['public_accounts'] = [];
    }
  }

  // Fiscal Monitor
  if (!recordTypes || recordTypes.includes('fiscal_monitor')) {
    try {
      log('[Budget Fetcher] Fetching fiscal monitor...');
      result['fiscal_monitor'] = await fetchFiscalMonitor({ ...options, year, onProgress: log });
      log(`[Budget Fetcher] Found ${result['fiscal_monitor'].length} fiscal monitor records`);
    } catch (err) {
      log(`[Budget Fetcher] FM fetch error: ${err instanceof Error ? err.message : String(err)}`);
      result['fiscal_monitor'] = [];
    }
  }

  // Departmental Plans
  if (!recordTypes || recordTypes.includes('departmental_plan')) {
    try {
      log('[Budget Fetcher] Fetching departmental plans...');
      result['departmental_plan'] = await fetchDepartmentalPlans({ ...options, year, onProgress: log });
      log(`[Budget Fetcher] Found ${result['departmental_plan'].length} departmental plan records`);
    } catch (err) {
      log(`[Budget Fetcher] DP fetch error: ${err instanceof Error ? err.message : String(err)}`);
      result['departmental_plan'] = [];
    }
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Helper: Extract document links from HTML                           */
/* ------------------------------------------------------------------ */

/**
 * Extract document links from an HTML listing page.
 * Looks for PDF, CSV, HTML document links that match budget/fiscal patterns.
 *
 * @param html - Raw HTML content
 * @param baseUrl - Base URL for resolving relative links
 * @returns Array of { url, text }
 */
export function extractDocumentLinks(
  html: string,
  baseUrl: string,
): Array<{ url: string; text: string }> {
  const links: Array<{ url: string; text: string }> = [];
  const seen = new Set<string>();

  // Match <a> tags with href
  const linkPattern = /<a\s+[^>]*href\s*=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  const documentExts = /\.(pdf|csv|xlsx?|html?|zip)$/i;
  const budgetKeywords = /\b(budget|fiscal|economic|outlook|projection|financial|account|audit|expense|revenue|deficit|surplus|debt|transfer|departmental\s*plan|results\s*report)\b/i;

  while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1].trim();
    const innerHtml = match[2];
    const text = innerHtml.replace(/<[^>]+>/g, '').trim();

    if (!href || href === '#' || href.startsWith('javascript:')) continue;

    let cleanUrl: string;
    if (href.startsWith('http://') || href.startsWith('https://')) {
      cleanUrl = href;
    } else if (href.startsWith('/')) {
      const base = new URL(baseUrl);
      cleanUrl = `${base.origin}${href}`;
    } else {
      cleanUrl = new URL(href, baseUrl).href;
    }

    const key = text + cleanUrl;
    if (seen.has(key)) continue;
    seen.add(key);

    // Keep if it looks like a budget/fiscal document
    const combined = text + ' ' + cleanUrl;
    if (documentExts.test(cleanUrl) || budgetKeywords.test(combined)) {
      links.push({ url: cleanUrl, text });
    }
  }

  return links;
}
