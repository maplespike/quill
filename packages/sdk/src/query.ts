// SPDX-License-Identifier: Apache-2.0
// ---------------------------------------------------------------------------
// MapleSpike SDK — URL builder, headers, response parsing
// ---------------------------------------------------------------------------
import type { QuillResponse, QueryOptions, QuillApiError } from './types.js';
import { QuillError } from './types.js';
import { getApiKey, getJwtToken } from './auth.js';

const USER_AGENT = 'MapleSpike/0.2 (+https://maplespike.lan)';

export const DEFAULT_BASE_URL = process.env.QUILL_API_URL || 'http://127.0.0.1:8085';
const DEV_BASE_URL = process.env.QUILL_API_URL || 'http://127.0.0.1:8085';

/**
 * Bilingual error message map for SDK-generated errors
 * (i.e. network-level errors not returned by the API server)
 */
const BILINGUAL_ERRORS: Record<string, { en: string; fr: string }> = {
  HTTP_ERROR: {
    en: 'The server returned an unexpected response',
    fr: 'Le serveur a renvoyé une réponse inattendue',
  },
  NETWORK_ERROR: {
    en: 'A network error occurred. Please check your connection.',
    fr: 'Une erreur réseau est survenue. Vérifiez votre connexion.',
  },
};

/** Resolve a bilingual error message by code */
export function getBilingualError(code: string, lang: 'en' | 'fr'): string {
  return BILINGUAL_ERRORS[code]?.[lang] ?? BILINGUAL_ERRORS.HTTP_ERROR[lang];
}

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

  // Options that map to query params
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
    'User-Agent': USER_AGENT,
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

/** Parse a fetch Response into a QuillResponse, throwing on errors */
export async function parseResponse<T = unknown>(
  response: Response,
  lang: 'en' | 'fr' = 'en',
): Promise<QuillResponse<T>> {
  if (!response.ok) {
    let apiError: QuillApiError;
    try {
      const body = await response.json() as Record<string, unknown>;
      apiError = {
        status: response.status,
        code: (body.code as string) ?? 'UNKNOWN',
        message: (body.message as string) ?? response.statusText,
        requestId: body.requestId as string | undefined,
        messageFr: body.messageFr as string | undefined,
      };
    } catch {
      apiError = {
        status: response.status,
        code: 'HTTP_ERROR',
        message: getBilingualError('HTTP_ERROR', lang),
        messageFr: getBilingualError('HTTP_ERROR', 'fr'),
      };
    }
    throw new QuillError(apiError);
  }

  const body = (await response.json()) as QuillResponse<T>;
  return body;
}
