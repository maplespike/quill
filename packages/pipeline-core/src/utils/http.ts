/**
 * Shared HTTP Utility — MapleSpike Pipeline
 *
 * Typed wrapper around undici's `request()` function.
 * Centralises the single `as any` cast so no consumer needs it.
 *
 * Provides:
 *   - `httpGet()`   — typed GET requests returning parsed response
 *   - `getText()`   — safely extract `#text` from parsed XML objects
 *
 * Usage:
 *   const resp = await httpGet('https://example.com/data.json', {
 *     headers: { Accept: 'application/json' },
 *     timeoutMs: 15_000,
 *   });
 *   const data = resp.body;            // raw text
 *   const json = await resp.json();    // parsed JSON
 */

import { request as undiciRequest } from 'undici';


const DEFAULT_USER_AGENT =
  process.env['DEFAULT_USER_AGENT'] ??
  'MapleSpikePipeline/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)';

const DEFAULT_TIMEOUT_MS = 30_000;


export interface HttpGetOptions {
  /** Additional request headers (merged with defaults). */
  headers?: Record<string, string>;
  /** Timeout in milliseconds (default 30_000). */
  timeoutMs?: number;
}

export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  /** Response body as raw text. */
  body: string;
  /** Parse the body as JSON. Safe to call multiple times (cached). */
  json<T = unknown>(): Promise<T>;
}

export interface HttpResponseLite {
  statusCode: number;
  headers: Record<string, string>;
  /** Response body as raw text. */
  body: string;
}


/**
 * Perform a GET request via undici, returning a typed response.
 *
 * All the unsafe `as any` casts that used to litter fetcher files
 * live here — one place, one justification.
 */
export async function httpGet(
  url: string,
  options: HttpGetOptions = {},
): Promise<HttpResponse> {
  const requestHeaders: Record<string, string> = {
    'User-Agent': DEFAULT_USER_AGENT,
    ...options.headers,
  };

  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resp = await (undiciRequest as any)(url, {
    method: 'GET',
    headers: requestHeaders,
    headersTimeout: timeout,
    bodyTimeout: timeout,
  });

  // Normalise headers — undici headers are iterable entries
  const respHeaders: Record<string, string> = {};
  try {
    for (const [k, v] of resp.headers.entries()) {
      respHeaders[k] = v;
    }
  } catch {
    // Some environments may not support .entries(); fallback
  }

  // Read body once and cache
  const bodyText: string = await resp.body.text();
  let _jsonParsed: unknown | undefined;

  return {
    statusCode: resp.statusCode,
    headers: respHeaders,
    body: bodyText,
    json: async <T = unknown>(): Promise<T> => {
      if (_jsonParsed === undefined) {
        _jsonParsed = JSON.parse(bodyText);
      }
      return _jsonParsed as T;
    },
  };
}


/**
 * Safely extract the `#text` value from a fast-xml-parser object
 * or return the input as-is if it is already a string.
 */
export function getText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const text = obj['#text'];
    if (typeof text === 'string') return text;
    if (text !== undefined && text !== null) return String(text);
  }
  return '';
}


/**
 * Parse a response body as JSON with a type assertion.
 * Thin wrapper around JSON.parse / resp.json().
 */
export async function parseJsonBody<T = unknown>(
  bodyOrResponse: string | HttpResponse,
): Promise<T> {
  const text = typeof bodyOrResponse === 'string'
    ? bodyOrResponse
    : bodyOrResponse.body;
  return JSON.parse(text) as T;
}
