// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Upstream outage tolerance for live integration tests.
 *
 * Why this exists: `upstream.test.ts` and `e2e.test.ts` call real government
 * hosts. Those hosts go down (see `quill-hermes/UPSTREAM-OUTAGES.md`, sections
 * 5 and 6). Before this module, a federal outage failed CI, so the job was
 * wrapped in `continue-on-error: true` — which also swallowed every real
 * regression. The split is now explicit:
 *
 *   - The host is unavailable                                            -> SKIP.
 *     Network error, 429, 5xx, no response, or a 2xx whose body is an HTML
 *     document instead of the API payload. CI stays green and prints why.
 *   - The host answers with 4xx, or with JSON that is malformed or the
 *     wrong shape                                                       -> FAIL.
 *     That is our bug: a broken request, a moved endpoint, a parser that
 *     cannot read a JSON 200. A skip here would hide a real regression.
 *
 * A 2xx HTML document is the same outage as a 500. Newfoundland and
 * Labrador's portal (offline since 2026-10-21) answers 500 on some days
 * and HTTP 200 with `<!DOCTYPE html>` ("An error has occurred") on others.
 * A status-only check flipped between skip and fail for one outage.
 *
 * 0 means "no HTTP response at all" (fetch rejected) — treated as an outage,
 * never as a pass, because there is no evidence the endpoint still works.
 */

import type { TestContext } from 'node:test';

/** Status codes that mean "the upstream is unavailable", not "we are wrong". */
export function isUpstreamOutage(status: number): boolean {
  return status === 0 || status === 429 || status >= 500;
}

const NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ECONNABORTED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
  'UND_ERR_CLOSED',
]);

const NETWORK_ERROR_NAMES = new Set([
  'TimeoutError',
  'AbortError',
  'ConnectTimeoutError',
  'HeadersTimeoutError',
  'BodyTimeoutError',
  'SocketError',
]);

const NETWORK_ERROR_TEXT = [
  'fetch failed',
  'ECONNREFUSED',
  'ECONNRESET',
  'ECONNABORTED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'UND_ERR_',
  'socket hang up',
  'network socket disconnected',
];

/** `All N HTTP attempts failed` is the pipeline-core retry wrapper's last line. */
const ALL_ATTEMPTS_FAILED = /All \d+ HTTP attempts failed/;

function errorText(err: unknown): string {
  if (err === null || err === undefined) return '';
  if (typeof err === 'string') return err;
  const parts: string[] = [];
  if (err instanceof Error) {
    parts.push(err.name, err.message);
    const cause = (err as { cause?: unknown }).cause;
    if (cause) parts.push(errorText(cause));
  } else if (typeof err === 'object') {
    const e = err as { name?: unknown; message?: unknown; code?: unknown };
    if (typeof e.name === 'string') parts.push(e.name);
    if (typeof e.message === 'string') parts.push(e.message);
    if (typeof e.code === 'string') parts.push(e.code);
  } else {
    parts.push(String(err));
  }
  return parts.join(' ');
}

/** Walk the `cause` chain: undici nests the real socket error one level down. */
function inspectError(err: unknown, depth = 0): boolean {
  if (err === null || err === undefined || depth > 4) return false;
  if (typeof err === 'object') {
    const name = (err as { name?: unknown }).name;
    if (typeof name === 'string' && NETWORK_ERROR_NAMES.has(name)) return true;
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string' && (NETWORK_ERROR_CODES.has(code) || code.startsWith('UND_ERR'))) {
      return true;
    }
    const cause = (err as { cause?: unknown }).cause;
    if (inspectError(cause, depth + 1)) return true;
  }
  const text = errorText(err);
  if (!text) return false;
  if (ALL_ATTEMPTS_FAILED.test(text)) return true;
  const lower = text.toLowerCase();
  return NETWORK_ERROR_TEXT.some((needle) => lower.includes(needle.toLowerCase()));
}

/**
 * True when the failure is a transport problem (DNS, TCP, TLS, timeout,
 * aborted fetch, undici socket error) rather than a protocol problem.
 * A 404, a bad JSON body or an assertion failure is NOT a network error.
 */
export function isNetworkError(err: unknown): boolean {
  return inspectError(err);
}

/** Result of a live fetch, normalised so the helpers can judge it. */
export interface UpstreamFetchResult {
  /** HTTP status. 0 means the request never produced a response. */
  status: number;
  body?: string;
  /** Response Content-Type, when the request produced a response. */
  contentType?: string;
  /** The thrown value, when the request rejected. */
  error?: unknown;
}

const HTML_CONTENT_TYPE = /(?:^|[;\s])(?:text\/html|application\/xhtml\+xml)\b/i;
/** Optional XML declaration, then an HTML doctype or an <html> root. RSS stays out. */
const HTML_DOCUMENT_START = /^(?:<\?xml\b[^>]*>\s*)?(?:<!doctype\s+html\b|<html\b)/i;

function payloadPrefix(body: string | undefined): string {
  return (body ?? '').replace(/^\uFEFF/, '').trimStart();
}

/**
 * True when the body is an HTML document rather than JSON or an XML feed.
 *
 * A JSON body wins over a wrong Content-Type: some portals label JSON as
 * text/html. An RSS document (`<?xml …><rss`) is not HTML. An empty body
 * with `Content-Type: text/html` is HTML — the error page carried no payload.
 */
export function isHtmlDocument(r: UpstreamFetchResult): boolean {
  const prefix = payloadPrefix(r.body);
  if (prefix.startsWith('{') || prefix.startsWith('[')) return false;
  if (r.contentType && HTML_CONTENT_TYPE.test(r.contentType)) return true;
  if (!prefix) return false;
  return HTML_DOCUMENT_START.test(prefix);
}

/**
 * True when `JSON.parse` / `resp.json()` rejected an HTML body.
 *
 * Node 22 reports `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`.
 * Older Node reports `Unexpected token < in JSON at position 0`. Both are
 * the HTML-document outage, seen from a caller that already consumed the body.
 * A truncated JSON value (`Unexpected token n`) is not this case.
 */
export function isHtmlJsonParseError(err: unknown): boolean {
  const text = errorText(err);
  if (!text.includes('<')) return false;
  return /not valid JSON/i.test(text) || /unexpected token\s*['"]?</i.test(text);
}

function outageReason(r: UpstreamFetchResult): string | null {
  if (r.error !== undefined && isNetworkError(r.error)) {
    return `network error (${errorText(r.error).trim().slice(0, 200)})`;
  }
  if (isUpstreamOutage(r.status)) {
    return r.status === 0
      ? 'no HTTP response'
      : `HTTP ${r.status}`;
  }
  // 2xx only. A 4xx HTML page is still a failure: the endpoint moved or refused us.
  if (r.status >= 200 && r.status < 300 && isHtmlDocument(r)) {
    const rawType = r.contentType?.split(';')[0]?.trim() ?? '';
    const type = rawType.length > 0 ? ` ${rawType}` : '';
    return `HTTP ${r.status} HTML document${type}`;
  }
  return null;
}

/**
 * Skip the current test when the live call shows an upstream outage.
 * Returns true when it skipped — the caller must `return` immediately after.
 *
 * Does NOT skip on 4xx or on a JSON body that is malformed or the wrong
 * shape: those stay assertion failures, because they mean Quill (or the
 * endpoint contract) regressed. A 2xx HTML document does skip — the host
 * served an error page, not the API.
 */
export function skipIfUpstreamDown(
  t: TestContext,
  r: UpstreamFetchResult,
  name: string,
): boolean {
  const reason = outageReason(r);
  if (reason === null) return false;
  t.skip(`upstream outage: ${name} ${reason}; not a Quill regression`);
  return true;
}

/** Skip when a thrown error is a transport failure. Returns true when it skipped. */
export function skipIfNetworkError(t: TestContext, err: unknown, name: string): boolean {
  if (!isNetworkError(err)) return false;
  t.skip(`upstream outage: ${name} network error (${errorText(err).trim().slice(0, 200)})`);
  return true;
}

/**
 * Skip when a JSON parser rejected an HTML document.
 * Returns true when it skipped. A truncated JSON value does not skip.
 */
export function skipIfHtmlParseError(t: TestContext, err: unknown, name: string): boolean {
  if (!isHtmlJsonParseError(err)) return false;
  t.skip(`upstream outage: ${name} returned an HTML document instead of JSON; not a Quill regression`);
  return true;
}

/**
 * Probe a host once, for suites that call handlers instead of raw URLs.
 * Returns `null` when the host looks healthy, or the skip reason when it does
 * not. Never throws.
 */
export async function probeUpstream(
  name: string,
  url: string,
  timeoutMs = 10_000,
): Promise<string | null> {
  let result: UpstreamFetchResult;
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'QuillTest/1.0', Accept: 'application/json, text/xml, */*' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    // Prefix only. The HTML check reads the start of the body and the type.
    const raw = await resp.text();
    result = {
      status: resp.status,
      body: raw.slice(0, 512),
      contentType: resp.headers.get('content-type') ?? undefined,
    };
  } catch (err) {
    result = { status: 0, error: err };
  }
  const reason = outageReason(result);
  if (reason === null) return null;
  return `upstream outage: ${name} ${reason}; not a Quill regression`;
}
