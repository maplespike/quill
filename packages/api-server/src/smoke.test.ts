/**
 * MapleSpike — API Server Smoke Tests
 *
 * Basic smoke tests using node:test to verify critical parts of the server
 * are importable and callable without crashing.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Test 1 dependencies
import { healthHandler } from './routes/health.js';
import type { RouteContext } from './types.js';
import type { MapleSpikeStorage, MapleSpikeCache } from './types.js';

/* ------------------------------------------------------------------ */
/*  Stubs                                                              */
/* ------------------------------------------------------------------ */

const stubDb: MapleSpikeStorage = {
  authenticate: async () => null,
  getDailyUsage: async () => 0,
  getMonthlyUsage: async () => 0,
  incrementUsage: async () => {},
  logAudit: async () => {},
  queryAudit: async () => [],
  listApiKeys: async () => [],
};

const stubCache: MapleSpikeCache = {
  get: async () => null,
  put: async () => {},
};

function makeContext(overrides: Partial<RouteContext> = {}): RouteContext {
  return {
    tenant: {
      id: 'smoke-test',
      name: 'Smoke Test',
      emailVerified: true,
      tier: 'internal',
      isActive: true,
      journalismMode: false,
    },
    apiKeyId: 'smoke-key',
    requestId: 'smoke-001',
    startTime: Date.now(),
    env: {},
    db: stubDb,
    cache: stubCache,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('API Server — Smoke', () => {
  it('health endpoint handler exists and can be called', async () => {
    const request = new Request('http://localhost/v1/health', { method: 'GET' });
    const ctx = makeContext();
    const params: Record<string, string> = {};

    const response = await healthHandler(request, ctx, params);

    assert.ok(response instanceof Response, 'handler returned a Response');
    assert.equal(response.status, 200, 'health endpoint returns 200');

    const body = await response.json();
    assert.equal(body.success, true, 'response body has success: true');
    assert.equal(body.data?.status, 'ok', 'data.status is "ok"');
  });

  it('server module creates without throwing', async () => {
    // Importing the main module should resolve without error.
    let mod: Record<string, unknown>;
    try {
      mod = await import('./index.js');
    } catch (err) {
      assert.fail(`Importing server module threw: ${err}`);
    }

    assert.ok(mod, 'module is defined');
    assert.ok(mod.handleRequest || mod.default, 'module exports handleRequest or default');
  });
});
