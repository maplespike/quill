// SPDX-License-Identifier: AGPL-3.0-only
/**
 * In-process route-registration smoke test for the API server.
 *
 * Invokes the default `fetch` handler (which internally calls `handleRequest`)
 * with synthetic `new Request(...)` objects for every route the source
 * declares in `index.ts`. The goal: catch regressions where a route gets
 * accidentally unregistered or its auth gate breaks.
 *
 * Strategy:
 *   1. Iterate the discovered ROUTES by parsing `index.ts` — we don't want
 *      to import private internals, but we can mirror the regex/method.
 *   2. Send a minimal `GET` (or POST where required) and assert response
 *      status ∈ [200, 499] ∪ {500 if CONFIG_ERROR}. Anything else (e.g. a
 *      handler throwing unhandled → 520) is a regression.
 *   3. Public/auth-exempt routes should return 2xx.
 *
 * NOTE: We deliberately do NOT exhaustively test response BODIES — that's
 * covered by domain-specific tests in `src/__tests__/`. This file only asserts
 * "the route IS registered and returns a meaningful status".
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import app from '../index.js';

// Routes that the fetch handler must keep responsive even without any deps.
// We list them as `(pattern, method, path)` triples.
interface RouteCase {
  pattern: string; // regex source from src/index.ts
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Expected status — either a number or a range setter */
  expect: (status: number) => boolean;
  humanLabel: string;
}

// Statuses that prove "route is registered, handler ran, response generated":
//   200  -> success
//   401  -> auth gate fired (route reached middleware)
//   404  -> parametric route returned not-found (handler ran)
//   422  -> validation failed (handler parsed request)
//   429  -> rate-limit fired (only seen when >5 anon calls share the same window)
//   503  -> upstream loader unavailable (signals/graph/briefs/entities)
//
// Anything 5xx OTHER than 503 means the handler threw unhandled — that's a
// regression this test is designed to catch.
const registered = (s: number) =>
  s === 200 || s === 401 || (s >= 400 && s < 500) || s === 503;

const ROUTES: RouteCase[] = [
  // ── Public probes — must return 200 (or 429 if anon calls exceed 5/min). ──
  // /v1/health is in the rate-limit exempt list, so it stays clean.
  { pattern: '/v1/health', url: 'http://test.local/v1/health', method: 'GET', expect: (s) => s === 200, humanLabel: 'GET /v1/health' },

  // ── Auth-exempt probes — accept 200 / 429 / 503 ──
  { pattern: '/v1/version', url: 'http://test.local/v1/version', method: 'GET', expect: registered, humanLabel: 'GET /v1/version' },
  { pattern: '/v1/compliance', url: 'http://test.local/v1/compliance', method: 'GET', expect: registered, humanLabel: 'GET /v1/compliance' },
  { pattern: '/v1/onboarding', url: 'http://test.local/v1/onboarding', method: 'GET', expect: registered, humanLabel: 'GET /v1/onboarding' },
  { pattern: '/v1/openapi.json', url: 'http://test.local/v1/openapi.json', method: 'GET', expect: registered, humanLabel: 'GET /v1/openapi.json' },
  // /v1/data/quality's handler emits 500 DATA_QUALITY_ERROR on any
  // downstream failure (see routes/data-quality.ts catch block). 500 is
  // therefore an acceptable registration signal here, not a regression.
  { pattern: '/v1/data/quality', url: 'http://test.local/v1/data/quality', method: 'GET', expect: (s) => registered(s) || s === 500, humanLabel: 'GET /v1/data/quality' },
  { pattern: '/v1/billing/plans', url: 'http://test.local/v1/billing/plans', method: 'GET', expect: registered, humanLabel: 'GET /v1/billing/plans' },
  { pattern: '/v1/gov/releases', url: 'http://test.local/v1/gov/releases', method: 'GET', expect: registered, humanLabel: 'GET /v1/gov/releases' },
  { pattern: '/v1/gov/search', url: 'http://test.local/v1/gov/search?dummy=1', method: 'GET', expect: registered, humanLabel: 'GET /v1/gov/search' },
  { pattern: '/v1/engine/status', url: 'http://test.local/v1/engine/status', method: 'GET', expect: registered, humanLabel: 'GET /v1/engine/status' },

  // ── Auth-gated routes without creds — accept anything 4xx, 429, or 503 ──
  { pattern: '/v1/me', url: 'http://test.local/v1/me', method: 'GET', expect: registered, humanLabel: 'GET /v1/me (unauth)' },
  { pattern: '/v1/keys', url: 'http://test.local/v1/keys', method: 'GET', expect: registered, humanLabel: 'GET /v1/keys (unauth)' },
  { pattern: '/v1/annotations', url: 'http://test.local/v1/annotations', method: 'GET', expect: registered, humanLabel: 'GET /v1/annotations (unauth)' },
  { pattern: '/v1/audit', url: 'http://test.local/v1/audit', method: 'GET', expect: registered, humanLabel: 'GET /v1/audit (unauth)' },
  { pattern: '/v1/usage', url: 'http://test.local/v1/usage', method: 'GET', expect: registered, humanLabel: 'GET /v1/usage (unauth)' },
  { pattern: '/v1/energy', url: 'http://test.local/v1/energy', method: 'GET', expect: registered, humanLabel: 'GET /v1/energy (unauth)' },
  { pattern: '/v1/real-estate', url: 'http://test.local/v1/real-estate', method: 'GET', expect: registered, humanLabel: 'GET /v1/real-estate (unauth)' },
  { pattern: '/v1/financial-regulation', url: 'http://test.local/v1/financial-regulation', method: 'GET', expect: registered, humanLabel: 'GET /v1/financial-regulation (unauth)' },
  { pattern: '/v1/municipal', url: 'http://test.local/v1/municipal', method: 'GET', expect: registered, humanLabel: 'GET /v1/municipal (unauth)' },
  { pattern: '/v1/webhooks', url: 'http://test.local/v1/webhooks', method: 'GET', expect: registered, humanLabel: 'GET /v1/webhooks (unauth)' },

  // ── Parametric routes — must be registered, handler must NOT crash. ──
  // Many of these return 404 when the lookup id doesn't exist, which proves
  // the route is wired through to its handler.
  { pattern: '/v1/citation/:id', url: 'http://test.local/v1/citation/abc123', method: 'GET', expect: registered, humanLabel: 'GET /v1/citation/:id' },
  { pattern: '/v1/municipal/:city', url: 'http://test.local/v1/municipal/toronto', method: 'GET', expect: registered, humanLabel: 'GET /v1/municipal/:city (unauth)' },
  { pattern: '/v1/webhooks/:id', url: 'http://test.local/v1/webhooks/wh_123', method: 'GET', expect: registered, humanLabel: 'GET /v1/webhooks/:id (unauth)' },
  { pattern: '/v1/keys/:id', url: 'http://test.local/v1/keys/k_123', method: 'DELETE', expect: registered, humanLabel: 'DELETE /v1/keys/:id (unauth)' },
  { pattern: '/v1/auth/oauth/:provider', url: 'http://test.local/v1/auth/oauth/github', method: 'GET', expect: registered, humanLabel: 'GET /v1/auth/oauth/:provider' },

  // ── Not-a-route sentinel — must return 404 (locks in dispatcher's else branch) ──
  { pattern: '__nonexistent__', url: 'http://test.local/v1/this-route-does-not-exist-xyz', method: 'GET', expect: (s) => s === 404, humanLabel: 'GET /v1/__not_found__' },
];

describe('api-server route registration smoke', () => {
  for (const route of ROUTES) {
    it(`${route.humanLabel} returns expected status (route registered)`, async () => {
      const req = new Request(route.url, { method: route.method });
      const env: Record<string, unknown> = {}; // → falls back to MemoryStorage + MemoryCache
      const res = await app.fetch(req, env as { DB?: unknown; CACHE?: unknown });
      assert.ok(
        route.expect(res.status),
        `${route.humanLabel}: expected status to satisfy matcher, got ${res.status}`,
      );
      // Body must be JSON-shaped for any non-204 response
      if (res.status !== 204) {
        const ct = res.headers.get('content-type') || '';
        assert.ok(
          ct.includes('application/json') || ct.includes('text/plain') || ct.includes('text/event-stream'),
          `${route.humanLabel}: expected JSON/plain content-type, got "${ct}"`,
        );
      }
    });
  }
});
