// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Mock upstream fetch — intercepts all HTTP calls for unit tests.
 *
 * Intercepts both globalThis.fetch (used by quill-mcp upstream-fetcher)
 * and undici.request (used by pipeline-core utils/http.ts) so tool handlers
 * can be exercised without hitting real government APIs.
 *
 * Usage:
 *   import { mockUpstream } from './helpers/mock-upstream.js';
 *   const mock = mockUpstream();
 *   before(() => mock.start());
 *   after(() => mock.stop());
 */

const ORIGINAL_FETCH = globalThis.fetch;

// Minimal valid ZIP (deflate) carrying a 3-line StatCan-style CSV. Embedded so
// the mocked StatCan CSV download exercises the real extractFromZip path:
// previously the generic `{}` default was fed to the unzipper, which threw
// "unexpected end of file" (zlib) and flaked the coverage job (#859).
const STATCAN_ZIP_B64 =
  'UEsDBBQAAAAIAG+nNV0yApqCOAAAAEIAAAAMAAAAMTcxMDAwMDkuY3N2C3J1i3dxDHHVcXf113HOzy9KycxLLEnVCXP0CXXlMjIwMtFxTsxLTEnUMdQxNDBAETHSMQKKAABQSwECFAMUAAAACABvpzVdMgKagjgAAABCAAAADAAAAAAAAAAAAAAAgAEAAAAAMTcxMDAwMDkuY3N2UEsFBgAAAAABAAEAOgAAAGIAAAAAAA==';

function statcanZip(): Uint8Array {
  return Uint8Array.from(atob(STATCAN_ZIP_B64), (c) => c.charCodeAt(0));
}

export interface MockCall {
  url: string;
  method: string;
}

export interface MockUpstream {
  start(): void;
  stop(): void;
  getCalls(): MockCall[];
  /** URLs that fell through to the generic default — a new upstream family
   *  the mock does not model yet (empty = fully modelled). */
  getUnhandledCalls(): MockCall[];
  /** Override the response for URLs matching a pattern */
  setResponse(urlPattern: RegExp, status: number, body: unknown): void;
}

interface MockResponse {
  statusCode: number;
  body: string;
  contentType: string;
  binary?: Uint8Array;
  unhandled?: boolean;
}

function makeResponse(url: string, overrides: { pattern: RegExp; status: number; body: unknown }[]): MockResponse {
  for (const o of overrides) {
    if (o.pattern.test(url)) {
      const body = typeof o.body === 'string' ? o.body : JSON.stringify(o.body);
      return { statusCode: o.status, body, contentType: 'application/json' };
    }
  }

  // StatCan table CSV downloads are ZIPs — serve a real one so the handler
  // path (fetch -> arrayBuffer -> extractFromZip -> CSV parse) works mocked.
  if (url.includes('www150.statcan.gc.ca/n1/tbl/csv/')) {
    return { statusCode: 200, body: '', contentType: 'application/zip', binary: statcanZip() };
  }

  // StatCan WDS REST endpoints return JSON arrays.
  if (url.includes('www150.statcan.gc.ca/t1/wds/rest/') || url.includes('/t1/wds/rest/')) {
    return { statusCode: 200, body: JSON.stringify([]), contentType: 'application/json' };
  }

  // Return empty CKAN-style result for API calls
  if (url.includes('/api/3/action/package_search') || url.includes('/api/action/package_search')) {
    return { statusCode: 200, body: JSON.stringify({ result: { results: [], total: 0 } }), contentType: 'application/json' };
  }

  // Return empty Socrata-style result
  if (url.includes('/api/views') || url.includes('/resource/')) {
    return { statusCode: 200, body: JSON.stringify([]), contentType: 'application/json' };
  }

  // Return empty RSS/XML for feed URLs
  if (url.endsWith('.xml') || url.includes('/rss')) {
    return { statusCode: 200, body: '<?xml version="1.0"?><rss><channel></channel></rss>', contentType: 'application/xml' };
  }

  // Default: empty JSON object — record as unhandled so tests can flag a new
  // upstream family the mock does not model yet.
  return { statusCode: 200, body: JSON.stringify({}), contentType: 'application/json', unhandled: true };
}

export function mockUpstream(): MockUpstream {
  const calls: MockCall[] = [];
  const unhandled: MockCall[] = [];
  const overrides: { pattern: RegExp; status: number; body: unknown }[] = [];

  // Intercept undici.request (used by pipeline-core httpGet)
  let undiciHook: ((url: string) => void) | null = null;

  return {
    start() {
      // Enable mock flag for pipeline-core's httpGet (which uses undici directly)
      (globalThis as { __MAPLESPIKE_MOCK_FETCH?: boolean }).__MAPLESPIKE_MOCK_FETCH = true;
      // Intercept globalThis.fetch (used by quill-mcp upstream-fetcher)
      globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        calls.push({ url, method });
        const resp = makeResponse(url, overrides);
        if (resp.unhandled) unhandled.push({ url, method });
        return Promise.resolve(new Response(resp.binary ?? resp.body, {
          status: resp.statusCode,
          headers: { 'Content-Type': resp.contentType },
        }));
      }) as typeof fetch;

      // undici interception is handled by pipeline-core's httpGet
      // which checks if globalThis.fetch has been overridden
      undiciHook = null;
    },
    stop() {
      (globalThis as { __MAPLESPIKE_MOCK_FETCH?: boolean }).__MAPLESPIKE_MOCK_FETCH = false;
      globalThis.fetch = ORIGINAL_FETCH;
      undiciHook = null;
    },
    getCalls() {
      return [...calls];
    },
    getUnhandledCalls() {
      return [...unhandled];
    },
    setResponse(urlPattern: RegExp, status: number, body: unknown) {
      overrides.push({ pattern: urlPattern, status, body });
    },
  };
}

