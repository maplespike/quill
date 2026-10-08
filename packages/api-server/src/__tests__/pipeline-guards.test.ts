/**
 * The pre-routing guards, through the exported handler.
 *
 * Preflight, transport and body size all run before a route is matched, so they
 * are asserted here rather than through the surfaces other files own: dispatch
 * through the Worker entry is routes-smoke.test.ts, and which routes take
 * credentials is route-auth-contract.test.ts. What these cases pin is the exact
 * status, error code and redirect target of each guard, and the fall-through when
 * a guard does not fire — not a status class.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../index.js';
import { MemoryStorage, MemoryCache } from '../storage.js';

const LIMIT = 1_048_576;

function call(path: string, init: RequestInit = {}) {
  return handleRequest(
    new Request(`http://guards.test${path}`, init),
    { ENVIRONMENT: 'test' },
    new MemoryStorage(),
    new MemoryCache(),
  );
}

interface GuardCase {
  what: string;
  path: string;
  init?: RequestInit;
  status: number;
  /** Error code, for a response the guard itself built. */
  code?: string;
  /** Error message prefix, for a request that fell through to routing. */
  message?: string;
  location?: string;
}

const CASES: GuardCase[] = [
  {
    what: 'a body one byte over 1 MiB is rejected before any handler runs',
    path: '/v1/health',
    init: { method: 'POST', headers: { 'content-length': String(LIMIT + 1) } },
    status: 413,
    code: 'PAYLOAD_TOO_LARGE',
  },
  {
    what: 'a body exactly at the limit passes the guard and reaches routing',
    path: '/v1/health',
    init: { method: 'POST', headers: { 'content-length': String(LIMIT) } },
    status: 404,
    message: 'No route matches POST /v1/health',
  },
  {
    what: 'an unparseable content-length is not treated as oversized',
    path: '/v1/health',
    init: { method: 'POST', headers: { 'content-length': 'not-a-number' } },
    status: 404,
    message: 'No route matches POST /v1/health',
  },
  {
    what: 'an oversized body is rejected before the key gate can answer',
    path: '/v1/usage',
    init: { method: 'POST', headers: { 'content-length': '2000000' } },
    status: 413,
    code: 'PAYLOAD_TOO_LARGE',
  },
  {
    what: 'a proxy reporting plain HTTP gets a 307 to the same URL over HTTPS',
    path: '/v1/health',
    init: { headers: { 'X-Forwarded-Proto': 'http' } },
    status: 307,
    location: 'https://guards.test/v1/health',
  },
  {
    what: 'an unmatched path reaches the dispatcher, so no guard fired',
    path: '/v1/this-route-does-not-exist',
    status: 404,
    message: 'No route matches GET /v1/this-route-does-not-exist',
  },
  {
    what: 'CORS preflight is answered before routing',
    path: '/v1/health',
    init: { method: 'OPTIONS', headers: { Origin: 'https://portal.test' } },
    status: 204,
  },
];

describe('pre-routing guards', () => {
  for (const { what, path, init, status, code, message, location } of CASES) {
    it(what, async () => {
      const response = await call(path, init);
      assert.equal(response.status, status, `${init?.method ?? 'GET'} ${path}`);

      if (code) {
        assert.equal((await response.json()).error.code, code, `${init?.method} ${path}`);
      }
      if (message) {
        assert.equal((await response.json()).error.message, message, `${init?.method} ${path}`);
      }
      if (location) {
        assert.equal(response.headers.get('location'), location);
      }
    });
  }

  it('an ingress that already reports HTTPS changes nothing', async () => {
    const control = await call('/v1/health');
    const withHeader = await call('/v1/health', { headers: { 'X-Forwarded-Proto': 'https' } });
    assert.notEqual(control.status, 307, 'the control must not be a redirect');
    assert.equal(withHeader.status, control.status);
    assert.equal(withHeader.headers.get('location'), null);
  });
});
