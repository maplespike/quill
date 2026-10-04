/**
 * GIC Appointment Fetcher — Quill
 *
 * HTTP fetchers for Governor-in-Council appointment data from
 * multiple Canadian government sources:
 *
 *   1. GC InfoBase — primary API for GIC appointments data
 *   2. Canada Gazette Orders in Council — CKAN packages on open.canada.ca
 *   3. PCO GIC Appointments Portal — HTML fallback
 *
 * Uses undici for HTTP (consistent with the rest of the pipeline).
 * Reuses fetchCKANPackages() pattern from gov-api.ts for CKAN queries.
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import { GIC_SOURCES, ckanPackageUrl, infobaseApiUrl } from './constants.js';
import type { GICAppointment, RawGICRecord } from './types.js';


export class GICFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly source?: string,
  ) {
    super(message);
    this.name = 'GICFetchError';
  }
}


const DEFAULT_HEADERS = {
  'User-Agent': 'Quill/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
  Accept: 'application/json,text/csv,text/html,*/*',
} as const;

/**
 * Fetch raw JSON from a URL.
 */
export async function fetchJson<T = unknown>(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const resp = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS },
    timeoutMs: options.timeoutMs ?? 30_000,
  });

  if (resp.statusCode >= 400) {
    throw new GICFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return JSON.parse(resp.body) as T;
}

/**
 * Fetch raw text from a URL (for CSV or HTML).
 */
export async function fetchText(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const resp = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS },
    timeoutMs: options.timeoutMs ?? 30_000,
  });

  if (resp.statusCode >= 400) {
    throw new GICFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.body;
}


/**
 * Response shape from CKAN package_show.
 */
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

/**
 * Fetch a CKAN package by ID and return its resources.
 */
export async function fetchCkanPackage(
  packageId: string,
): Promise<CKANPackageResponse['result']> {
  const url = ckanPackageUrl(packageId);
  const resp = await fetchJson<CKANPackageResponse>(url);

  if (!resp.success || !resp.result) {
    throw new GICFetchError(
      `CKAN API error for package ${packageId}`,
      undefined,
      'ckan',
    );
  }

  return resp.result;
}

/**
 * Search for GIC-related packages on a CKAN portal.
 * Uses the open.canada.ca CKAN API.
 */
export async function searchGicPackages(
  query: string = 'governor+in+council+appointments',
  rows: number = 20,
): Promise<Array<{ id: string; title: string; resources: Array<{ name: string; format: string; url: string }> }>> {
  const url = `${GIC_SOURCES.CKAN.SEARCH}?q=${query}&rows=${rows}`;
  const resp = await fetchJson<{
    success: boolean;
    result: { results: Array<{
      id: string;
      title: string;
      notes: string | null;
      resources: Array<{ id: string; name: string; format: string; url: string }>;
    }> };
  }>(url);

  if (!resp.success) {
    return [];
  }

  return resp.result.results.map(p => ({
    id: p.id,
    title: p.title,
    resources: (p.resources ?? []).map(r => ({
      name: r.name,
      format: r.format,
      url: r.url,
    })),
  }));
}

/**
 * Fetch a CSV resource from a CKAN package and parse it as raw records.
 * Returns the raw CSV text (caller handles parsing).
 */
export async function fetchCkanCsvResource(
  resourceUrl: string,
): Promise<string> {
  return fetchText(resourceUrl);
}


/**
 * Fetch GIC appointments from GC InfoBase API.
 * GC InfoBase provides a structured API for federal appointments data
 * including Governor-in-Council appointments.
 */
export async function fetchGicAppointmentsFromInfobase(
  options: { limit?: number } = {},
): Promise<RawGICRecord[]> {
  const endpoint = 'gic-appointments';
  const url = infobaseApiUrl(endpoint);

  try {
    const data = await fetchJson<{ data: RawGICRecord[]; total?: number }>(url);
    const records = data.data ?? [];
    return options.limit ? records.slice(0, options.limit) : records;
  } catch (err) {
    // GC InfoBase API may not be available yet; log and return empty
    console.warn('[GIC] GC InfoBase API not available, trying CKAN sources');
    return [];
  }
}


/**
 * Fetch GIC appointment records from Canada Gazette Orders in Council
 * CKAN packages. This extracts GIC-related content from the Canada
 * Gazette Orders in Council publications.
 *
 * Steps:
 *   1. Fetch the CKAN package
 *   2. Find HTML/CSV resources
 *   3. Return the resource metadata for further processing
 */
export async function fetchGicAppointmentsFromCkan(
  packageId: string,
): Promise<{
  packageTitle: string;
  resources: Array<{ id: string; name: string; format: string; url: string }>;
}> {
  const pkg = await fetchCkanPackage(packageId);

  return {
    packageTitle: pkg.title,
    resources: pkg.resources.map(r => ({
      id: r.id,
      name: r.name,
      format: r.format,
      url: r.url,
    })),
  };
}


/**
 * Fetch GIC appointments from all available sources.
 * Tries sources in priority order:
 *   1. GC InfoBase API (primary)
 *   2. Canada Gazette CKAN packages (fallback)
 */
export async function fetchGICAppointments(
  options: {
    limit?: number;
    ckanPackageIds?: string[];
  } = {},
): Promise<{
  source: string;
  records: RawGICRecord[];
  sourcesTried: string[];
  errors: string[];
}> {
  const sourcesTried: string[] = [];
  const errors: string[] = [];
  let allRecords: RawGICRecord[] = [];
  let primarySuccess = false;

  // Step 1: Try GC InfoBase (primary source)
  try {
    sourcesTried.push('gc-infobase');
    const records = await fetchGicAppointmentsFromInfobase({ limit: options.limit });
    if (records.length > 0) {
      allRecords = records;
      primarySuccess = true;
    }
  } catch (err) {
    errors.push(`GC InfoBase: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Step 2: Try CKAN packages (fallback)
  if (!primarySuccess || allRecords.length === 0) {
    const ckanIds = options.ckanPackageIds ?? [
      'd63a5c6d-fd93-4442-ac28-561f4dac90c6', // Canada Gazette OIC 2020
      '1691db07-7620-4535-9cb0-e5a0512ba35d', // Canada Gazette OIC 2022
    ];

    for (const pkgId of ckanIds) {
      try {
        sourcesTried.push(`ckan:${pkgId}`);
        const result = await fetchGicAppointmentsFromCkan(pkgId);
        // Return resource URLs as raw records for downstream parsing
        allRecords.push({
          sourceSystem: 'ckan',
          ckanPackageId: pkgId,
          organization: result.packageTitle,
          positionTitle: result.packageTitle,
          sourceUrl: result.resources[0]?.url ?? '',
        } as unknown as RawGICRecord);
      } catch (err) {
        errors.push(`CKAN ${pkgId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return {
    source: primarySuccess ? 'gc-infobase' : 'ckan',
    records: allRecords,
    sourcesTried,
    errors,
  };
}


/**
 * Fetch detailed information about a single GIC appointment.
 * Uses the Canada Gazette HTML page for the specific Order in Council.
 *
 * @param orderInCouncilNumber — The PC number (e.g. "PC-2025-0001")
 */
export async function fetchAppointmentDetail(
  orderInCouncilNumber: string,
): Promise<{
  orderInCouncilNumber: string;
  rawHtml: string;
  sourceUrl: string;
}> {
  // Canada Gazette Order in Council page format
  const gazetteUrl = `https://gazette.gc.ca/rp-pr/p1/2025/${orderInCouncilNumber.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;

  const html = await fetchText(gazetteUrl);

  return {
    orderInCouncilNumber,
    rawHtml: html,
    sourceUrl: gazetteUrl,
  };
}
