/**
 * CanLII Fetcher — Quill
 *
 * HTTP fetcher for the CanLII REST API v1 at https://api.canlii.org/v1/.
 *
 * Supports:
 *   - caseBrowse: list decisions from a specific court's database
 *   - caseDetail: fetch metadata for a specific decision
 *   - caseCitator: fetch citations (cited cases, citing cases, cited legislation)
 *   - caseSearch: search decisions by query text
 *
 * The API key is read from the CANLII_API_KEY environment variable.
 * If the key is missing, the fetcher logs a warning and returns empty results
 * to allow graceful degradation in development/testing.
 *
 * API docs: https://github.com/canlii/API_documentation
 */

import { httpGet } from '../../utils/http.js';
import {
  CANLII_API_BASE,
  CANLII_API_KEY_ENV,
  CANLII_DEFAULT_LANG,
  CANLII_MAX_RESULTS,
  CANLII_DEFAULT_OFFSET,
} from './constants.js';
import type {
  RawCaseListResponse,
  RawCaseDetailResponse,
  RawCitatorResponse,
  RawSearchResponse,
} from './types.js';


export class CanliiFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'CanliiFetchError';
  }
}


let _apiKeyWarningLogged = false;

const CANLII_MIN_GAP_MS = 500;
const CANLII_DAILY_LIMIT = 5000;
const DAY_MS = 86_400_000;

const canliiState = {
  lastRequestTime: 0,
  dailyCount: 0,
  dailyReset: Date.now(),
  queue: Promise.resolve() as Promise<unknown>,
};

async function rateLimitedCall<T>(fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  if (now - canliiState.dailyReset > DAY_MS) {
    canliiState.dailyCount = 0;
    canliiState.dailyReset = now;
  }

  if (canliiState.dailyCount >= CANLII_DAILY_LIMIT) {
    console.warn('[canlii] Daily limit 5,000 reached, skipping remaining requests');
    throw new CanliiFetchError('Daily API limit reached (5,000 requests)');
  }

  const prevQueue = canliiState.queue;

  const thisCall = prevQueue.then(async () => {
    const elapsed = Date.now() - canliiState.lastRequestTime;
    if (elapsed < CANLII_MIN_GAP_MS) {
      const waitMs = CANLII_MIN_GAP_MS - elapsed;
      console.warn(`[canlii] Throttling: waiting ${waitMs}ms for 2 req/s limit`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
    canliiState.lastRequestTime = Date.now();
    canliiState.dailyCount++;
    return fn();
  });

  canliiState.queue = thisCall.catch(() => {});

  return thisCall;
}

/**
 * Get the CanLII API key from environment.
 * Returns null if not set (with a one-time warning).
 */
function getApiKey(): string | null {
  const key = process.env[CANLII_API_KEY_ENV];
  if (!key) {
    if (!_apiKeyWarningLogged) {
      console.warn(
        `[canlii] ${CANLII_API_KEY_ENV} environment variable is not set. ` +
        `CanLII API calls will return empty results. ` +
        `Get an API key at https://www.canlii.org/en/feedback/feedback.html`,
      );
      _apiKeyWarningLogged = true;
    }
    return null;
  }
  return key;
}


const DEFAULT_HEADERS = {
  'User-Agent': 'MapleSpike/0.1 (civic-tech; mailto:hello@maplespike.ca)',
  Accept: 'application/json',
} as const;

/**
 * Perform an authenticated GET request to the CanLII API.
 * Returns null if the API key is not configured.
 */
async function apiGet<T>(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<{ data: T | null; statusCode: number }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { data: null, statusCode: 0 };
  }

  // Append API key to URL
  const separator = url.includes('?') ? '&' : '?';
  const authenticatedUrl = `${url}${separator}api_key=${encodeURIComponent(apiKey)}`;

  try {
    const resp = await rateLimitedCall(() => httpGet(authenticatedUrl, {
      headers: { ...DEFAULT_HEADERS as Record<string, string> },
      timeoutMs: options.timeoutMs ?? 30_000,
    }));

    if (resp.statusCode === 429) {
      canliiState.dailyCount = CANLII_DAILY_LIMIT;
      console.warn('[canlii] Received 429 — daily limit likely exceeded. Halting remaining requests.');
      return { data: null, statusCode: 429 };
    }

    if (resp.statusCode >= 400) {
      throw new CanliiFetchError(
        `HTTP ${resp.statusCode} from CanLII API`,
        resp.statusCode,
        authenticatedUrl,
      );
    }

    const body = await resp.json() as T;
    return { data: body, statusCode: resp.statusCode };
  } catch (err) {
    if (err instanceof CanliiFetchError && err.message.includes('Daily API limit')) {
      return { data: null, statusCode: 0 };
    }
    if (err instanceof CanliiFetchError) throw err;
    throw new CanliiFetchError(
      err instanceof Error ? err.message : String(err),
      undefined,
      url,
    );
  }
}


/**
 * Search CanLII for decisions matching a query.
 *
 * Uses the caseBrowse endpoint filtered by database and searches
 * by query terms via the API's decisionDate/publishedAfter filters.
 *
 * For full-text search, uses the caseSearch endpoint if available,
 * falling back to caseBrowse when search is not supported.
 *
 * @param query - Search query (case name, keyword, party name)
 * @param court - Optional court databaseId to restrict search to
 * @param options - Additional options (offset, limit, etc.)
 * @returns Raw search response or null if API key not configured
 */
export async function searchCanlii(
  query: string,
  court?: string,
  options: {
    offset?: number;
    limit?: number;
    timeoutMs?: number;
  } = {},
): Promise<RawSearchResponse | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  // Attempt caseSearch endpoint first
  const searchParams = new URLSearchParams();
  searchParams.set('q', query);
  if (court) searchParams.set('court', court);
  searchParams.set('offset', String(options.offset ?? CANLII_DEFAULT_OFFSET));
  searchParams.set('limit', String(options.limit ?? CANLII_MAX_RESULTS));
  searchParams.set('api_key', apiKey);

  const searchUrl = `${CANLII_API_BASE}/caseSearch/${CANLII_DEFAULT_LANG}/?${searchParams.toString()}`;

  try {
    const resp = await rateLimitedCall(() => httpGet(searchUrl, {
      headers: { ...DEFAULT_HEADERS as Record<string, string> },
      timeoutMs: options.timeoutMs ?? 30_000,
    }));

    if (resp.statusCode === 429) {
      canliiState.dailyCount = CANLII_DAILY_LIMIT;
      console.warn('[canlii] Received 429 — daily limit likely exceeded. Halting remaining requests.');
      return null;
    }

    if (resp.statusCode >= 400) {
      throw new CanliiFetchError(
        `HTTP ${resp.statusCode} searching CanLII`,
        resp.statusCode,
        searchUrl,
      );
    }

    const body = await resp.json() as RawSearchResponse;
    return body;
  } catch (err) {
    if (err instanceof CanliiFetchError && err.message.includes('Daily API limit')) {
      return null;
    }
    // If search endpoint is not found (404), fall back to caseBrowse
    if (err instanceof CanliiFetchError && err.statusCode === 404 && court) {
      // Fallback: use caseBrowse with the court database
      return searchViaCaseBrowse(query, court, options);
    }
    if (err instanceof CanliiFetchError) throw err;
    throw new CanliiFetchError(
      err instanceof Error ? err.message : String(err),
      undefined,
      searchUrl,
    );
  }
}

/**
 * Fallback: search by browsing a court's case list and filtering client-side.
 * This is a best-effort approach when caseSearch is unavailable.
 */
async function searchViaCaseBrowse(
  query: string,
  databaseId: string,
  options: { offset?: number; limit?: number; timeoutMs?: number } = {},
): Promise<RawSearchResponse> {
  const result = await fetchCaseList(databaseId, {
    offset: options.offset,
    resultCount: options.limit ?? CANLII_MAX_RESULTS,
    timeoutMs: options.timeoutMs,
  });

  if (!result) {
    return { cases: [], total: 0 };
  }

  // Basic client-side filtering by query string (simple keyword match)
  const queryLower = query.toLowerCase();
  const filtered = (result.cases ?? []).filter(c => {
    const title = c.title?.toLowerCase() ?? '';
    const citation = c.citation?.toLowerCase() ?? '';
    return title.includes(queryLower) || citation.includes(queryLower);
  });

  return { cases: filtered, total: filtered.length };
}


/**
 * Fetch a list of decisions from a specific CanLII database/court.
 *
 * @param databaseId - CanLII database identifier (e.g. "csc-scc", "fc-cf")
 * @param options - Pagination and date filter options
 * @returns Raw case list response or null if API key not configured
 */
export async function fetchCaseList(
  databaseId: string,
  options: {
    offset?: number;
    resultCount?: number;
    publishedAfter?: string;
    decisionDateAfter?: string;
    decisionDateBefore?: string;
    timeoutMs?: number;
  } = {},
): Promise<RawCaseListResponse | null> {
  const params = new URLSearchParams();
  params.set('offset', String(options.offset ?? CANLII_DEFAULT_OFFSET));
  params.set('resultCount', String(options.resultCount ?? CANLII_MAX_RESULTS));

  if (options.publishedAfter) params.set('publishedAfter', options.publishedAfter);
  if (options.decisionDateAfter) params.set('decisionDateAfter', options.decisionDateAfter);
  if (options.decisionDateBefore) params.set('decisionDateBefore', options.decisionDateBefore);

  const url = `${CANLII_API_BASE}/caseBrowse/${CANLII_DEFAULT_LANG}/${databaseId}/?${params.toString()}`;
  const result = await apiGet<RawCaseListResponse>(url, options);
  return result.data;
}


/**
 * Fetch detailed metadata for a specific CanLII decision.
 *
 * @param databaseId - CanLII database identifier
 * @param caseId - CanLII case identifier
 * @param options - Timeout options
 * @returns Raw case detail response or null if API key not configured
 */
export async function fetchDecisionDetail(
  databaseId: string,
  caseId: string,
  options: { timeoutMs?: number } = {},
): Promise<RawCaseDetailResponse | null> {
  const url = `${CANLII_API_BASE}/caseBrowse/${CANLII_DEFAULT_LANG}/${databaseId}/${caseId}/`;
  const result = await apiGet<RawCaseDetailResponse>(url, options);
  return result.data;
}


/**
 * Fetch cited cases for a specific decision.
 *
 * @param databaseId - CanLII database identifier
 * @param caseId - CanLII case identifier
 * @param options - Timeout options
 * @returns Raw citator response or null if API key not configured
 */
export async function fetchCitedCases(
  databaseId: string,
  caseId: string,
  options: { timeoutMs?: number } = {},
): Promise<RawCitatorResponse | null> {
  const url = `${CANLII_API_BASE}/caseCitator/en/${databaseId}/${caseId}/citedCases`;
  const result = await apiGet<RawCitatorResponse>(url, options);
  return result.data;
}

/**
 * Fetch citing cases for a specific decision.
 *
 * @param databaseId - CanLII database identifier
 * @param caseId - CanLII case identifier
 * @param options - Timeout options
 * @returns Raw citator response or null if API key not configured
 */
export async function fetchCitingCases(
  databaseId: string,
  caseId: string,
  options: { timeoutMs?: number } = {},
): Promise<RawCitatorResponse | null> {
  const url = `${CANLII_API_BASE}/caseCitator/en/${databaseId}/${caseId}/citingCases`;
  const result = await apiGet<RawCitatorResponse>(url, options);
  return result.data;
}

/**
 * Fetch legislation cited by a specific decision.
 *
 * @param databaseId - CanLII database identifier
 * @param caseId - CanLII case identifier
 * @param options - Timeout options
 * @returns Raw citator response or null if API key not configured
 */
export async function fetchCitedLegislation(
  databaseId: string,
  caseId: string,
  options: { timeoutMs?: number } = {},
): Promise<RawCitatorResponse | null> {
  const url = `${CANLII_API_BASE}/caseCitator/en/${databaseId}/${caseId}/citedLegislations`;
  const result = await apiGet<RawCitatorResponse>(url, options);
  return result.data;
}


/**
 * Fetch the list of all databases (courts and tribunals) available in CanLII.
 *
 * @param options - Timeout options
 * @returns Database list response or null if API key not configured
 */
export async function fetchDatabaseList(
  options: { timeoutMs?: number } = {},
): Promise<RawCaseListResponse | null> {
  // caseBrowse returns case databases when no databaseId is specified
  const url = `${CANLII_API_BASE}/caseBrowse/${CANLII_DEFAULT_LANG}/`;
  const result = await apiGet<RawCaseListResponse>(url, options);
  return result.data;
}


/**
 * Search for decisions that cite a specific piece of legislation.
 *
 * Uses the caseCitator in reverse: we search for case names containing
 * the act name via caseSearch, then look up their cited legislation.
 *
 * @param actName - Name of the act or regulation (e.g. "Access to Information Act")
 * @param court - Optional court databaseId to restrict search
 * @param options - Additional options
 * @returns Raw search response or null if API key not configured
 */
export async function searchByLegislation(
  actName: string,
  court?: string,
  options: {
    offset?: number;
    limit?: number;
    timeoutMs?: number;
  } = {},
): Promise<RawSearchResponse | null> {
  // Search for cases mentioning the act name
  return searchCanlii(actName, court, options);
}
