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

export interface MockCall {
  url: string;
  method: string;
}

export interface MockUpstream {
  start(): void;
  stop(): void;
  getCalls(): MockCall[];
  /** Override the response for URLs matching a pattern */
  setResponse(urlPattern: RegExp, status: number, body: unknown): void;
}

function makeResponse(url: string, overrides: { pattern: RegExp; status: number; body: unknown }[]): { statusCode: number; body: string; contentType: string } {
  for (const o of overrides) {
    if (o.pattern.test(url)) {
      const body = typeof o.body === 'string' ? o.body : JSON.stringify(o.body);
      return { statusCode: o.status, body, contentType: 'application/json' };
    }
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

  // Default: empty JSON object
  return { statusCode: 200, body: JSON.stringify({}), contentType: 'application/json' };
}

export function mockUpstream(): MockUpstream {
  const calls: MockCall[] = [];
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
        return Promise.resolve(new Response(resp.body, {
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
    setResponse(urlPattern: RegExp, status: number, body: unknown) {
      overrides.push({ pattern: urlPattern, status, body });
    },
  };
}

