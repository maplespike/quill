/**
 * CIPO (Canadian Intellectual Property Office) Fetcher — Quill
 *
 * Fetches IP rights records from CIPO sources:
 *   - Patents — Canadian Patent Database API / open data
 *   - Trademarks — Canadian Trademarks Database API / open data
 *   - Industrial Designs — Industrial Design Database API / open data
 *
 * Uses undici for HTTP (consistent with the rest of the pipeline).
 */

import { httpGet } from '../../utils/http.js';
import {
  CIPO_SOURCES,
  CIPO_IP_TYPE_CONFIG,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_HEADERS,
} from './constants.js';
import type {
  CipoIpType,
  RawCipoRecord,
  CipoPatentApiRecord,
  CipoTrademarkApiRecord,
  CipoDesignApiRecord,
} from './types.js';
import type { HttpResponse } from '../../utils/http.js';

/* ------------------------------------------------------------------ */
/*  Error Class                                                        */
/* ------------------------------------------------------------------ */

export class CipoFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
    public readonly ipType?: CipoIpType,
  ) {
    super(message);
    this.name = 'CipoFetchError';
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
    throw new CipoFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.json<T>();
}

/**
 * Fetch raw text from a URL (for HTML/XML endpoints).
 */
async function fetchText(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const resp: HttpResponse = await httpGet(url, {
    headers: { ...DEFAULT_HEADERS, Accept: 'text/html,application/xml,*/*' },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  if (resp.statusCode >= 400) {
    throw new CipoFetchError(
      `HTTP ${resp.statusCode} fetching ${url}`,
      resp.statusCode,
      url,
    );
  }

  return resp.body;
}

/* ------------------------------------------------------------------ */
/*  Fetch Functions — by IP type                                       */
/* ------------------------------------------------------------------ */

/**
 * Fetch patent records from the CIPO patent database.
 *
 * @param year - Filter by filing year (optional)
 * @param options - Fetch options
 * @returns Raw records and any errors
 */
export async function fetchCipoPatents(
  year?: number,
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<{ records: RawCipoRecord[]; errors: string[] }> {
  const errors: string[] = [];
  const limit = options.limit ?? 500;

  try {
    // Attempt JSON API fetch first
    const params = new URLSearchParams();
    params.set('lang', 'eng');
    if (year) params.set('filingYear', String(year));
    params.set('limit', String(limit));

    const url = `${CIPO_SOURCES.PATENT.JSON_API}?${params.toString()}`;
    const apiRecords = await fetchJson<CipoPatentApiRecord[]>(url, options);

    const records = (apiRecords || []).map(r => ({
      applicationNumber: r.application_number ?? undefined,
      filingDate: r.filing_date ?? undefined,
      status: r.status ?? undefined,
      type: 'patent' as const,
      title: r.title ?? undefined,
      ownerName: r.owner_name ?? undefined,
      agentName: r.agent_name ?? undefined,
      ipcClassification: r.ipc_codes ?? undefined,
      registrationDate: r.registration_date ?? undefined,
      expiryDate: r.expiry_date ?? undefined,
      publicationDate: r.publication_date ?? undefined,
      description: r.abstract ?? undefined,
      sourceUrl: r.application_number
        ? `${CIPO_SOURCES.PATENT.DETAIL}${r.application_number}`
        : CIPO_SOURCES.PATENT.SEARCH,
    })) as RawCipoRecord[];

    return { records, errors };
  } catch (err) {
    const msg = `CIPO patent fetch failed: ${(err as Error).message}`;
    errors.push(msg);
    return { records: [], errors };
  }
}

/**
 * Fetch trademark records from the CIPO trademarks database.
 *
 * @param year - Filter by filing year (optional)
 * @param options - Fetch options
 * @returns Raw records and any errors
 */
export async function fetchCipoTrademarks(
  year?: number,
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<{ records: RawCipoRecord[]; errors: string[] }> {
  const errors: string[] = [];
  const limit = options.limit ?? 500;

  try {
    const params = new URLSearchParams();
    params.set('lang', 'eng');
    if (year) params.set('filingYear', String(year));
    params.set('limit', String(limit));

    const url = `${CIPO_SOURCES.TRADEMARK.JSON_API}?${params.toString()}`;
    const apiRecords = await fetchJson<CipoTrademarkApiRecord[]>(url, options);

    const records = (apiRecords || []).map(r => ({
      applicationNumber: r.application_number ?? undefined,
      filingDate: r.filing_date ?? undefined,
      status: r.status ?? undefined,
      type: 'trademark' as const,
      title: r.mark_name ?? undefined,
      ownerName: r.owner_name ?? undefined,
      agentName: r.agent_name ?? undefined,
      niceClassification: r.nice_classes ?? undefined,
      registrationDate: r.registration_date ?? undefined,
      expiryDate: r.expiry_date ?? undefined,
      publicationDate: r.publication_date ?? undefined,
      sourceUrl: r.application_number
        ? `${CIPO_SOURCES.TRADEMARK.DETAIL}${r.application_number}`
        : CIPO_SOURCES.TRADEMARK.SEARCH,
    })) as RawCipoRecord[];

    return { records, errors };
  } catch (err) {
    const msg = `CIPO trademark fetch failed: ${(err as Error).message}`;
    errors.push(msg);
    return { records: [], errors };
  }
}

/**
 * Fetch industrial design records from the CIPO designs database.
 *
 * @param year - Filter by filing year (optional)
 * @param options - Fetch options
 * @returns Raw records and any errors
 */
export async function fetchCipoDesigns(
  year?: number,
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<{ records: RawCipoRecord[]; errors: string[] }> {
  const errors: string[] = [];
  const limit = options.limit ?? 500;

  try {
    const params = new URLSearchParams();
    params.set('lang', 'eng');
    if (year) params.set('filingYear', String(year));
    params.set('limit', String(limit));

    const url = `${CIPO_SOURCES.DESIGN.JSON_API}?${params.toString()}`;
    const apiRecords = await fetchJson<CipoDesignApiRecord[]>(url, options);

    const records = (apiRecords || []).map(r => ({
      applicationNumber: r.application_number ?? undefined,
      filingDate: r.filing_date ?? undefined,
      status: r.status ?? undefined,
      type: 'industrial_design' as const,
      title: r.design_name ?? undefined,
      ownerName: r.owner_name ?? undefined,
      agentName: r.agent_name ?? undefined,
      registrationDate: r.registration_date ?? undefined,
      expiryDate: r.expiry_date ?? undefined,
      publicationDate: r.publication_date ?? undefined,
      sourceUrl: r.application_number
        ? `${CIPO_SOURCES.DESIGN.DETAIL}${r.application_number}`
        : CIPO_SOURCES.DESIGN.SEARCH,
    })) as RawCipoRecord[];

    return { records, errors };
  } catch (err) {
    const msg = `CIPO design fetch failed: ${(err as Error).message}`;
    errors.push(msg);
    return { records: [], errors };
  }
}

/* ------------------------------------------------------------------ */
/*  Orchestrated Fetch                                                 */
/* ------------------------------------------------------------------ */

/**
 * Fetch CIPO records for a given IP type.
 *
 * @param ipType - The type of IP to fetch (patent, trademark, industrial_design)
 * @param options - Fetch options
 * @returns Raw records and any errors
 */
export async function fetchCipoRecords(
  ipType: CipoIpType,
  year?: number,
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<{ records: RawCipoRecord[]; errors: string[] }> {
  switch (ipType) {
    case 'patent':
      return fetchCipoPatents(year, options);
    case 'trademark':
      return fetchCipoTrademarks(year, options);
    case 'industrial_design':
      return fetchCipoDesigns(year, options);
    default:
      return { records: [], errors: [`Unknown CIPO IP type: ${ipType}`] };
  }
}

/**
 * Fetch CIPO records for all IP types.
 *
 * @param year - Year filter (optional)
 * @param options - Fetch options
 * @returns Map of IP type to raw records and errors
 */
export async function fetchAllCipoRecords(
  year?: number,
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<Record<CipoIpType, { records: RawCipoRecord[]; errors: string[] }>> {
  const [patents, trademarks, designs] = await Promise.all([
    fetchCipoPatents(year, options),
    fetchCipoTrademarks(year, options),
    fetchCipoDesigns(year, options),
  ]);

  return {
    patent: patents,
    trademark: trademarks,
    industrial_design: designs,
  };
}
