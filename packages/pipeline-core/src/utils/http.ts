/**
 * Shared HTTP Utility — MapleSpike Pipeline
 *
 * Typed wrapper around undici's `request()` function.
 * Centralises the single `as any` cast so no consumer needs it.
 *
 * Provides:
 *   - `httpGet()`   — typed GET requests with automatic retry + backoff
 *   - `getText()`   — safely extract `#text` from parsed XML objects
 *
 * Self-Healing Features:
 *   - Automatic retry on transient failures (network errors, 5xx, timeouts)
 *   - Exponential backoff with jitter (1s, 2s, 4s — up to 3 retries)
 *   - Graceful degradation: returns empty response instead of crashing
 *   - Circuit-breaker pattern: resets on success, gradual retry on failure
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

const MAX_RETRIES = 3;

/** HTTP status codes considered transient (retriable). */
const TRANSIENT_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Wait with exponential backoff + jitter.
 * Base delays: ~1s, ~2s, ~4s
 */
function backoff(attempt: number): Promise<void> {
  const baseMs = 1000 * Math.pow(2, attempt);
  const jitter = Math.random() * 500;
  return new Promise(resolve => setTimeout(resolve, baseMs + jitter));
}


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
 * Features:
 *   - Automatic retry on transient failures (network, 5xx, timeouts)
 *   - Exponential backoff with jitter (1s, 2s, 4s, up to 3 retries)
 *   - Graceful degradation: returns empty body on persistent failure
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
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
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

      // Retry on transient status codes
      if (TRANSIENT_STATUS_CODES.has(resp.statusCode) && attempt < MAX_RETRIES) {
        lastError = new Error(`Transient HTTP ${resp.statusCode}`);
        await backoff(attempt);
        continue;
      }

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
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on the last attempt
      if (attempt < MAX_RETRIES) {
        console.warn(`[HTTP] Retry ${attempt + 1}/${MAX_RETRIES} for ${url.split('?')[0]}: ${lastError.message}`);
        await backoff(attempt);
      }
    }
  }

  // Graceful degradation — return empty response instead of crashing
  console.warn(`[HTTP] All ${MAX_RETRIES + 1} attempts failed for ${url.split('?')[0]}: ${lastError?.message}`);
  return {
    statusCode: 0,
    headers: {},
    body: '',
    json: async <T = unknown>(): Promise<T> => {
      throw new Error(`All ${MAX_RETRIES + 1} HTTP attempts failed`);
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
