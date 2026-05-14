// ---------------------------------------------------------------------------
// MapleSpike SDK — URL builder, headers, response parsing
// ---------------------------------------------------------------------------
import type { MapleSpikeResponse, QueryOptions, MapleSpikeApiError } from './types.js';
import { MapleSpikeError } from './types.js';
import { getApiKey, getJwtToken } from './auth.js';

export const DEFAULT_BASE_URL = 'https://api.maplespike.ca';
const DEV_BASE_URL = 'http://127.0.0.1:8084';

/** Determine the base URL. Auto-detects dev environment. */
export function resolveBaseUrl(customBaseUrl?: string): string {
  if (customBaseUrl) return customBaseUrl.replace(/\/+$/, '');
  try {
    if (
      typeof process !== 'undefined' &&
      process.env?.NODE_ENV === 'development'
    ) {
      return DEV_BASE_URL;
    }
  } catch {
    // Ignore — running in a restricted environment
  }
  return DEFAULT_BASE_URL;
}

/** Build the full API URL for a query */
export function buildUrl(
  base: string,
  agent: string,
  action: string,
  params?: Record<string, unknown>,
  options?: QueryOptions,
): string {
  const path = `/v1/${encodeURIComponent(agent)}/${encodeURIComponent(action)}`;
  const url = new URL(path, base);

  // Merge params and options into query string
  const allParams: Record<string, string> = {};

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) {
        allParams[k] = String(v);
      }
    }
  }

  // Options that map to query params (excluding _mock, _format etc that are handled differently)
  if (options) {
    if (options._fields) allParams._fields = options._fields;
    if (options._format) allParams._format = options._format;
    if (options._limit !== undefined) allParams._limit = String(options._limit);
    if (options._page !== undefined) allParams._page = String(options._page);
    if (options._normalize !== undefined) allParams._normalize = String(options._normalize);
    if (options._units) allParams._units = options._units;
    if (options._summary !== undefined) allParams._summary = String(options._summary);
  }

  for (const [k, v] of Object.entries(allParams)) {
    url.searchParams.set(k, v);
  }

  return url.toString();
}

/** Build request headers from auth config */
export function buildHeaders(apiKey?: string, jwtToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const key = apiKey ?? getApiKey();
  const jwt = jwtToken ?? getJwtToken();

  if (key) {
    headers['X-API-Key'] = key;
  }
  if (jwt) {
    headers['Authorization'] = `Bearer ${jwt}`;
  }

  return headers;
}

/** Parse a fetch Response into a MapleSpikeResponse, throwing on errors */
export async function parseResponse<T = unknown>(response: Response): Promise<MapleSpikeResponse<T>> {
  if (!response.ok) {
    let apiError: MapleSpikeApiError;
    try {
      const body = await response.json() as Record<string, unknown>;
      apiError = {
        status: response.status,
        code: (body.code as string) ?? 'UNKNOWN',
        message: (body.message as string) ?? response.statusText,
        requestId: body.requestId as string | undefined,
      };
    } catch {
      apiError = {
        status: response.status,
        code: 'HTTP_ERROR',
        message: response.statusText,
      };
    }
    throw new MapleSpikeError(apiError);
  }

  const body = (await response.json()) as MapleSpikeResponse<T>;
  return body;
}
