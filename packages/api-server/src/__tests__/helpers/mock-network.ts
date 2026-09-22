/**
 * Hermetic network mock for the api-server unit lane.
 *
 * The unit lane must never touch the live network. Two reasons, both learned
 * the hard way (t_b0989a3d, t_be4a5e32):
 *
 *   1. CI runners have no reliable egress. A blackholed connection has no
 *      application-level timeout in the handlers under test, so the run hangs
 *      instead of failing.
 *   2. The route handlers delegate to `@maplespike/pipeline-core`, which
 *      reaches the network through undici (`httpGet`) *and* through
 *      `globalThis.fetch` depending on `globalThis.__MAPLESPIKE_MOCK_FETCH`.
 *      Both paths are intercepted here so no request can escape.
 *
 * Usage:
 *   import { mockNetwork } from './helpers/mock-network.js';
 *   const net = mockNetwork();
 *   before(() => net.start());
 *   after(() => net.stop());
 *
 * Modelled upstreams (mirrors the quill-mcp `helpers/mock-upstream.ts`
 * harness so both packages behave the same under test):
 *   - StatCan WDS REST  → `[]` (the honest "no releases" answer)
 *   - CKAN package_search → `{ success: true, result: { results: [] } }`
 *   - Socrata / ArcGIS / RSS/XML → empty equivalents
 * Anything else is served as `{}` and recorded via `unhandled()` so a new
 * upstream family shows up as an assertion failure instead of a live call.
 */

const ORIGINAL_FETCH = globalThis.fetch;

export interface MockCall {
  url: string;
  method: string;
}

export interface MockResponseOverride {
  pattern: RegExp;
  status: number;
  body: unknown;
}

export interface NetworkMock {
  /** Install the fetch stub and arm the pipeline-core mock flag. */
  start(): void;
  /** Restore globalThis.fetch and disarm the mock flag. */
  stop(): void;
  /** Every request the code under test made, in order. */
  calls(): MockCall[];
  /** Requests that fell through to the generic `{}` default. */
  unhandled(): MockCall[];
  /** Override the response for URLs matching a pattern. */
  respond(pattern: RegExp, status: number, body: unknown): void;
  /** Drop recorded calls (useful between assertions). */
  reset(): void;
}

interface StubbedResponse {
  status: number;
  body: string;
  contentType: string;
  unhandled?: boolean;
}

function makeResponse(url: string, overrides: MockResponseOverride[]): StubbedResponse {
  for (const o of overrides) {
    if (o.pattern.test(url)) {
      return {
        status: o.status,
        body: typeof o.body === 'string' ? o.body : JSON.stringify(o.body),
        contentType: 'application/json',
      };
    }
  }

  // StatCan WDS REST endpoints answer with a JSON array of cubes.
  if (url.includes('/t1/wds/rest/')) {
    return { status: 200, body: JSON.stringify([]), contentType: 'application/json' };
  }

  // CKAN portals answer with the package_search envelope.
  if (url.includes('/api/3/action/package_search') || url.includes('/api/action/package_search')) {
    return {
      status: 200,
      body: JSON.stringify({ success: true, result: { results: [], count: 0 } }),
      contentType: 'application/json',
    };
  }

  // Socrata catalog / ArcGIS search return empty catalogues.
  if (url.includes('/data.json') || url.includes('/api/search/v1')) {
    return { status: 200, body: JSON.stringify({ dataset: [], results: [] }), contentType: 'application/json' };
  }

  // Feeds answer with an empty RSS document.
  if (url.endsWith('.xml') || url.includes('/rss')) {
    return {
      status: 200,
      body: '<?xml version="1.0"?><rss><channel></channel></rss>',
      contentType: 'application/xml',
    };
  }

  return { status: 200, body: JSON.stringify({}), contentType: 'application/json', unhandled: true };
}

export function mockNetwork(): NetworkMock {
  const recorded: MockCall[] = [];
  const notModelled: MockCall[] = [];
  const overrides: MockResponseOverride[] = [];

  return {
    start(): void {
      // pipeline-core's httpGet() routes through globalThis.fetch when this
      // flag is set — otherwise it would call undici directly and escape the
      // stub. Setting it is what makes the interception complete.
      (globalThis as { __MAPLESPIKE_MOCK_FETCH?: boolean }).__MAPLESPIKE_MOCK_FETCH = true;

      globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method ?? 'GET';
        recorded.push({ url, method });
        const resp = makeResponse(url, overrides);
        if (resp.unhandled) notModelled.push({ url, method });
        return Promise.resolve(
          new Response(resp.body, {
            status: resp.status,
            headers: { 'Content-Type': resp.contentType },
          }),
        );
      }) as typeof fetch;
    },

    stop(): void {
      (globalThis as { __MAPLESPIKE_MOCK_FETCH?: boolean }).__MAPLESPIKE_MOCK_FETCH = false;
      globalThis.fetch = ORIGINAL_FETCH;
    },

    calls(): MockCall[] {
      return [...recorded];
    },

    unhandled(): MockCall[] {
      return [...notModelled];
    },

    respond(pattern: RegExp, status: number, body: unknown): void {
      overrides.push({ pattern, status, body });
    },

    reset(): void {
      recorded.length = 0;
      notModelled.length = 0;
    },
  };
}
