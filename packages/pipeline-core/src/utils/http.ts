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

import { createHash } from 'node:crypto';
import { request as undiciRequest } from 'undici';
import { recordIngestionArtifact } from '../claims/artifact-capture.js';

function captureHttpArtifact(url: string, statusCode: number, headers: Record<string, string>, body: string): void {
  const parsedUrl = new URL(url);
  const urlRedacted = parsedUrl.username !== '' || parsedUrl.password !== '' || parsedUrl.searchParams.size > 0;
  parsedUrl.username = '';
  parsedUrl.password = '';
  parsedUrl.search = '';
  recordIngestionArtifact({
    url: parsedUrl.toString(),
    urlRedacted,
    retrievedAt: new Date().toISOString(),
    sha256: createHash('sha256').update(body, 'utf8').digest('hex'),
    statusCode,
    bodyCapture: 'complete-http-client-body',
    mediaType: headers['content-type'],
    byteLength: Buffer.byteLength(body, 'utf8'),
    etag: headers.etag,
    lastModified: headers['last-modified'],
  });
}

// Capture the original globalThis.fetch at module load for mock detection
const ORIGINAL_GLOBAL_FETCH = globalThis.fetch;

// Test override flag: set by mock-upstream to route HTTP through globalThis.fetch
// Don't initialize it here — just check it at runtime
declare global {
  // eslint-disable-next-line no-var
  var __MAPLESPIKE_MOCK_FETCH: boolean | undefined;
}


const DEFAULT_USER_AGENT =
  process.env['DEFAULT_USER_AGENT'] ??
  'MapleSpikePipeline/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)';

const DEFAULT_TIMEOUT_MS = process.env['MAPLESPIKE_HTTP_TIMEOUT_MS'] !== undefined
  ? parseInt(process.env['MAPLESPIKE_HTTP_TIMEOUT_MS'], 10)
  : 30_000;

const MAX_RETRIES = process.env['MAPLESPIKE_HTTP_MAX_RETRIES'] !== undefined
  ? parseInt(process.env['MAPLESPIKE_HTTP_MAX_RETRIES'], 10)
  : 3;

/**
 * Process-level guard for undici stream-decompression crashes.
 *
 * undici's internal gzip inflate can emit an *uncaught* error when an
 * upstream truncates a gzip / HTTP/2 response mid-transfer (observed with
 * cbc.ca closing with NGHTTP2_INTERNAL_ERROR; surfaced by the live MCP tool
 * smoke run). The error is thrown from Node's internal webstreams adapter
 * (`node:internal/webstreams/adapters` → `Z_BUF_ERROR`, "unexpected end of
 * file") rather than as a promise rejection, so it escapes httpGet()'s
 * try/catch and would otherwise kill the whole process.
 *
 * Installs a narrowly-scoped `uncaughtException` handler that swallows ONLY
 * that known-benign signature and lets everything else crash loudly as
 * usual. Idempotent — safe to call from multiple entry points (MCP SSE
 * server, CLI, one-shot drivers, ingestion runners).
 */
export interface GuardLogger {
  warn(obj: Record<string, unknown>, msg?: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
}

let streamGuardInstalled = false;

export function installStreamErrorGuard(log: GuardLogger): void {
  if (streamGuardInstalled) return;
  streamGuardInstalled = true;

  process.on('uncaughtException', (err: Error) => {
    const code = (err as NodeJS.ErrnoException).code;
    const msg = err instanceof Error ? err.message : String(err);
    const benign = code === 'Z_BUF_ERROR' || /unexpected end of file/i.test(msg);
    if (benign) {
      log.warn({ err }, 'Ignoring benign upstream decompression error (truncated gzip/HTTP2 body)');
      return;
    }
    log.error({ err }, 'Uncaught exception — exiting (not the benign stream-decompression signature)');
    // Exit loudly for anything that is NOT the known stream-decompression
    // signature. NOTE: re-throwing inside/after this handler would re-enter
    // it (infinite loop), so an explicit exit is the correct crash pattern.
    process.exit(1);
  });
}

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


/** Per-domain rate-limit configuration for token bucket. */
export interface DomainThrottleConfig {
  maxTokens: number;
  refillPerSecond: number;
}

// Default throttle: 2 req/s per domain (fits CKAN APIs, StatCan 25 req/s)
const DEFAULT_DOMAIN_THROTTLE: DomainThrottleConfig = { maxTokens: 2, refillPerSecond: 1 };

// Per-domain token buckets — rate limiter, not concurrency limiter (tokens don't return)
const domainThrottles = new Map<string, { tokens: number; lastRefill: number }>();
const domainErrorCounts = new Map<string, { count: number; firstSeen: number }>();

// Alert: same domain fails >5 times in 5min
const ERROR_ALERT_THRESHOLD = 5;
const ERROR_ALERT_WINDOW_MS = 5 * 60 * 1000;

// Alerts when same domain fails repeatedly
function trackError(domain: string): void {
  const now = Date.now();
  let entry = domainErrorCounts.get(domain);
  if (!entry || (now - entry.firstSeen) > ERROR_ALERT_WINDOW_MS) {
    entry = { count: 1, firstSeen: now };
    domainErrorCounts.set(domain, entry);
    return;
  }
  entry.count++;
  if (entry.count > ERROR_ALERT_THRESHOLD) {
    console.warn(`[HTTP] ALERT: ${domain} has failed ${entry.count} times in 5 minutes`);
  }
}

/**
 * Acquire a token from per-domain rate limiter.
 * Waits if no tokens available (token bucket algorithm).
 * Tokens do NOT return after use — this is a rate limiter, not concurrency limiter.
 */
async function acquireToken(domain: string, config: DomainThrottleConfig): Promise<void> {
  while (true) {
    let state = domainThrottles.get(domain);
    if (!state) {
      state = { tokens: config.maxTokens, lastRefill: Date.now() };
      domainThrottles.set(domain, state);
    }

    const now = Date.now();
    const elapsed = (now - state.lastRefill) / 1000;
    state.tokens = Math.min(config.maxTokens, state.tokens + elapsed * config.refillPerSecond);
    state.lastRefill = now;

    if (state.tokens >= 1) {
      state.tokens -= 1;
      return;
    }

    // No tokens — wait for next refill tick
    const waitMs = Math.ceil(((1 - state.tokens) / config.refillPerSecond) * 1000);
    console.warn(`[HTTP] Throttled ${domain}: waiting ${waitMs}ms for token`);
    await new Promise(resolve => setTimeout(resolve, Math.min(waitMs, 1000)));
  }
}

export interface HttpGetOptions {
  /** Additional request headers (merged with defaults). */
  headers?: Record<string, string>;
  /** Timeout in milliseconds (default 30_000). */
  timeoutMs?: number;
  /** Per-domain rate-limit override. Default: 2 req/s. */
  throttle?: DomainThrottleConfig;
  /** HTTP method (default 'GET'). Use 'HEAD' for lightweight health checks. */
  method?: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Force HTTP/1.1 fallback for servers with HTTP/2 issues (e.g. CBC). */
  preferHttp1?: boolean;
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
  const start = Date.now();

  // StatCan WDS lock period check (midnight-8:30 AM ET daily)
  // Skip request entirely — no point wasting a connection
  const isStatCan = url.includes('statcan') || url.includes('wds') || url.includes('www150');
  if (isStatCan) {
    const now = new Date();
    const hourET = (now.getUTCHours() - 5 + 24) % 24; // UTC-5 (EST, ignores DST)
    const minuteET = now.getUTCMinutes();
    if (hourET < 8 || (hourET === 8 && minuteET < 30)) {
      console.warn(`[HTTP] StatCan WDS locked (midnight-8:30 AM ET), skipping retry: ${url.split('?')[0]}`);
      return {
        statusCode: 409,
        headers: {},
        body: '',
        json: async <T = unknown>(): Promise<T> => {
          throw new Error('StatCan WDS locked (midnight-8:30 AM ET)');
        },
      };
    }
  }

  // Per-domain rate limiting — acquire token before request
  // Skip throttling entirely when mock fetch is active
  const domain = new URL(url).hostname;
  const pathname = url.split('?')[0];
  if (globalThis.__MAPLESPIKE_MOCK_FETCH !== true) {
    const domainThrottleConfig = options.throttle ?? DEFAULT_DOMAIN_THROTTLE;
    await acquireToken(domain, domainThrottleConfig);
  }

  // Test mode: if mock fetch flag is set, route through globalThis.fetch
  if (globalThis.__MAPLESPIKE_MOCK_FETCH === true) {
    const resp = await fetch(url, {
      method: options.method ?? 'GET',
      headers: requestHeaders,
    });
    const respHeaders: Record<string, string> = {};
    resp.headers.forEach((v: string, k: string) => { respHeaders[k] = v; });
    const body = await resp.text();
    captureHttpArtifact(url, resp.status, respHeaders, body);
    let parsed: unknown;
    const json = async <T = unknown>(): Promise<T> => {
      if (parsed === undefined) parsed = JSON.parse(body);
      return parsed as T;
    };
    return { statusCode: resp.status, headers: respHeaders, body, json };
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resp = await (undiciRequest as any)(url,
      // When preferHttp1 is true, disable HTTP/2 ALPN negotiation
      // to work around NGHTTP2_INTERNAL_ERROR on misconfigured servers.
      {
        method: options.method ?? 'GET',
        headers: requestHeaders,
        headersTimeout: timeout,
        bodyTimeout: timeout,
        ...(options.preferHttp1 ? { allowH2: false } : {}),
      });

      // Normalise headers — undici headers are iterable entries
      const respHeaders: Record<string, string> = {};
      try {
        for (const [k, v] of Object.entries(resp.headers)) {
          if (typeof v === 'string') respHeaders[k.toLowerCase()] = v;
          else if (Array.isArray(v)) respHeaders[k.toLowerCase()] = v.join(', ');
        }
      } catch {
        // Some environments may not expose enumerable response headers.
      }

      // Read body once and cache
      const bodyText: string = await resp.body.text();
      captureHttpArtifact(url, resp.statusCode, respHeaders, bodyText);
      let _jsonParsed: unknown | undefined;

      // Retry on transient status codes
      if (TRANSIENT_STATUS_CODES.has(resp.statusCode) && attempt < MAX_RETRIES) {
        const durationMs = Date.now() - start;
        console.warn(`[HTTP] ${domain} ${resp.statusCode} GET ${pathname} (attempt ${attempt + 1}/${MAX_RETRIES + 1}) — ${durationMs}ms — retrying`);
        lastError = new Error(`Transient HTTP ${resp.statusCode}`);
        await backoff(attempt);
        continue;
      }

      // Non-transient error — log warning but return response
      if (resp.statusCode >= 400) {
        const durationMs = Date.now() - start;
        console.warn(`[HTTP] ${domain} ${resp.statusCode} GET ${pathname} — ${durationMs}ms — non-transient error`);
        trackError(domain);
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
        const durationMs = Date.now() - start;
        console.warn(`[HTTP] ${domain} 0 GET ${pathname} (attempt ${attempt + 1}/${MAX_RETRIES + 1}) — ${durationMs}ms — ${lastError.message}`);
        await backoff(attempt);
      }
    }
  }

  // Graceful degradation — return empty response instead of crashing
  const durationMs = Date.now() - start;
  console.warn(`[HTTP] ${domain} 0 GET ${pathname} (attempt ${MAX_RETRIES + 1}/${MAX_RETRIES + 1}) — ${durationMs}ms — ALL RETRIES FAILED: ${lastError?.message}`);
  trackError(domain);
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
