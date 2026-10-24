// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Upstream outage tolerance for live integration tests.
 *
 * Why this exists: `upstream.test.ts` and `e2e.test.ts` call real government
 * hosts. Those hosts go down (see `quill-hermes/UPSTREAM-OUTAGES.md`, sections
 * 5 and 6). Before this module, a federal outage failed CI, so the job was
 * wrapped in `continue-on-error: true` — which also swallowed every real
 * regression. The split is now explicit:
 *
 *   - The host is unavailable (network error, 429, 5xx, no response)  -> SKIP.
 *     The outage is upstream, not ours. CI stays green and prints why.
 *   - The host answers with 4xx or a malformed payload               -> FAIL.
 *     That is our bug: a broken request, a moved endpoint, a parser that
 *     cannot read a 200. A skip here would hide a real regression.
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
  /** The thrown value, when the request rejected. */
  error?: unknown;
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
  return null;
}

/**
 * Skip the current test when the live call shows an upstream outage.
 * Returns true when it skipped — the caller must `return` immediately after.
 *
 * Does NOT skip on 4xx or on a well-formed response with a bad body: those
 * stay assertion failures, because they mean Quill (or the endpoint contract)
 * regressed.
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
    result = { status: resp.status };
  } catch (err) {
    result = { status: 0, error: err };
  }
  const reason = outageReason(result);
  if (reason === null) return null;
  return `upstream outage: ${name} ${reason}; not a Quill regression`;
}
