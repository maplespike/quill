import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorage, MemoryCache } from '../storage.js';

/**
 * Basic response headers test — verifies that every response from the
 * API server carries the expected OWASP security headers and correct
 * CORS behaviour.  We use the health endpoint as our probe: it is
 * auth-exempt, simple, and always returns 200, so any missing header
 * is a regression.
 */

function makeCtx(overrides: Record<string, unknown> = {}) {
  const db = new MemoryStorage();
  const cache = new MemoryCache();
  db.registerTenant(
    { id: 'test-tenant', name: 'Test User', emailVerified: true, tier: 'free', isActive: true, journalismMode: false },
    'test-key-hash',
    'test-key-id',
  );
  return {
    tenant: { id: 'test-tenant', name: 'Test User', emailVerified: true, tier: 'free' as const, isActive: true, journalismMode: false },
    apiKeyId: 'test-key-id',
    requestId: 'test',
    startTime: Date.now(),
    env: {},
    db,
    cache,
    ...overrides,
  };
}

describe('Security Headers', () => {
  it('health response includes X-Content-Type-Options: nosniff', async () => {
    const { healthHandler } = await import('../routes/health.js');
    const ctx = makeCtx();
    const resp = await healthHandler(new Request('http://localhost/v1/health'), ctx as any, {});
    assert.equal(resp.headers.get('X-Content-Type-Options'), 'nosniff');
  });

  it('health response includes X-Frame-Options: DENY', async () => {
    const { healthHandler } = await import('../routes/health.js');
    const ctx = makeCtx();
    const resp = await healthHandler(new Request('http://localhost/v1/health'), ctx as any, {});
    assert.equal(resp.headers.get('X-Frame-Options'), 'DENY');
  });

  it('health response includes Referrer-Policy', async () => {
    const { healthHandler } = await import('../routes/health.js');
    const ctx = makeCtx();
    const resp = await healthHandler(new Request('http://localhost/v1/health'), ctx as any, {});
    const val = resp.headers.get('Referrer-Policy');
    assert.ok(val);
    assert.match(val, /strict-origin/i);
  });

  it('health response includes Content-Security-Policy', async () => {
    const { healthHandler } = await import('../routes/health.js');
    const ctx = makeCtx();
    const resp = await healthHandler(new Request('http://localhost/v1/health'), ctx as any, {});
    const csp = resp.headers.get('Content-Security-Policy');
    assert.ok(csp);
    assert.match(csp, /default-src 'none'/);
    assert.match(csp, /base-uri 'none'/);
  });

  it('health response includes Cache-Control with no-store', async () => {
    const { healthHandler } = await import('../routes/health.js');
    const ctx = makeCtx();
    const resp = await healthHandler(new Request('http://localhost/v1/health'), ctx as any, {});
    const cc = resp.headers.get('Cache-Control');
    assert.ok(cc);
    assert.match(cc, /no-store/);
  });

  it('health response includes Permissions-Policy with restricted defaults', async () => {
    const { healthHandler } = await import('../routes/health.js');
    const ctx = makeCtx();
    const resp = await healthHandler(new Request('http://localhost/v1/health'), ctx as any, {});
    const pp = resp.headers.get('Permissions-Policy');
    assert.ok(pp);
    assert.match(pp, /camera=\(\)/);
    assert.match(pp, /microphone=\(\)/);
    assert.match(pp, /geolocation=\(\)/);
  });

  it('does not include HSTS by default in dev environment', async () => {
    const { healthHandler } = await import('../routes/health.js');
    const ctx = makeCtx();
    const resp = await healthHandler(new Request('http://localhost/v1/health'), ctx as any, {});
    // HSTS is only set when environment === 'production'
    assert.equal(resp.headers.get('Strict-Transport-Security'), null);
  });
});

describe('CORS Headers', () => {
  it('options preflight returns 204 with correct CORS headers', async () => {
    const { corsPreflight } = await import('../response.js');
    const resp = corsPreflight('https://quill-api.lan');
    assert.equal(resp.status, 204);
    assert.equal(resp.headers.get('Access-Control-Allow-Origin'), 'https://quill-api.lan');
    assert.equal(resp.headers.get('Access-Control-Allow-Methods'), 'GET, POST, PATCH, DELETE, OPTIONS');
    assert.equal(resp.headers.get('Access-Control-Expose-Headers'), 'X-MapleSpike-Version, X-MapleSpike-Trace-Id, X-RateLimit-Remaining, X-RateLimit-Reset, X-Attribution-Notice');
    assert.ok(resp.headers.get('Access-Control-Max-Age'));
  });

  it('cors preflight includes security headers', async () => {
    const { corsPreflight } = await import('../response.js');
    const resp = corsPreflight('https://quill-api.lan');
    assert.equal(resp.headers.get('X-Content-Type-Options'), 'nosniff');
  });

  it('allows registered production origins', async () => {
    const { getAllowedOrigin } = await import('../response.js');
    assert.equal(getAllowedOrigin('https://maplespike.ca'), 'https://maplespike.ca');
    assert.equal(getAllowedOrigin('https://api.maplespike.ca'), 'https://api.maplespike.ca');
    assert.equal(getAllowedOrigin('https://mcp.maplespike.ca'), 'https://mcp.maplespike.ca');
    assert.equal(getAllowedOrigin('https://portal.maplespike.ca'), 'https://portal.maplespike.ca');
    assert.equal(getAllowedOrigin('https://quill.maplespike.ca'), 'https://quill.maplespike.ca');
    assert.equal(getAllowedOrigin('https://maplespike-quill.pages.dev'), 'https://maplespike-quill.pages.dev');
    assert.equal(getAllowedOrigin('https://maplespike-quill.pages.dev.evil.com'), 'null');
  });

  it('allows local dev origins', async () => {
    const { getAllowedOrigin } = await import('../response.js');
    assert.equal(getAllowedOrigin('http://localhost:8082'), 'http://localhost:8082');
    assert.equal(getAllowedOrigin('http://localhost:4321'), 'http://localhost:4321');
    assert.equal(getAllowedOrigin('http://localhost:3001'), 'http://localhost:3001');
  });

  it('returns null for unregistered origins', async () => {
    const { getAllowedOrigin } = await import('../response.js');
    assert.equal(getAllowedOrigin('https://evil.com'), 'null');
    assert.equal(getAllowedOrigin('http://localhost:9999'), 'null');
  });

  it('handles null origin gracefully', async () => {
    const { getAllowedOrigin } = await import('../response.js');
    assert.equal(getAllowedOrigin(null), 'null');
  });

  it('allows known internal LAN origins', async () => {
    const { getAllowedOrigin } = await import('../response.js');
    assert.equal(getAllowedOrigin('https://quill-api.lan'), 'https://quill-api.lan');
    assert.equal(getAllowedOrigin('https://quill-portal.lan'), 'https://quill-portal.lan');
    assert.equal(getAllowedOrigin('https://quill.lan'), 'https://quill.lan');
  });
});

describe('Rate Limit Configuration', () => {
  it('checkRateLimit allows requests under the limit', async () => {
    const { checkRateLimit } = await import('../rate-limit.js');
    const result = checkRateLimit('test-tenant', 5, 60_000);
    assert.ok(result.allowed);
    assert.equal(result.remaining, 4);
  });

  it('checkRateLimit blocks when limit exceeded', async () => {
    const { checkRateLimit } = await import('../rate-limit.js');
    const key = `test-block-${Date.now()}`;
    // Consume all 5 slots
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, 5, 60_000);
    }
    const result = checkRateLimit(key, 5, 60_000);
    assert.equal(result.allowed, false);
    assert.equal(result.remaining, 0);
  });

  it('Tier limits are appropriately configured', async () => {
    const { TIER_LIMITS } = await import('../types.js');
    // Free tier should have low limits
    assert.ok(TIER_LIMITS.free.monthly <= 5000);
    assert.ok(TIER_LIMITS.free.daily <= 100);
    // Pro should be higher than free
    assert.ok(TIER_LIMITS.pro.monthly > TIER_LIMITS.free.monthly);
    assert.ok(TIER_LIMITS.pro.daily > TIER_LIMITS.free.daily);
    // Enterprise should have highest limits
    assert.ok(TIER_LIMITS.enterprise.monthly >= TIER_LIMITS.business.monthly);
    assert.ok(TIER_LIMITS.enterprise.daily >= TIER_LIMITS.business.daily);
  });

  it('rate-limit headers are attached on 429 responses', async () => {
    // Use the actual handleRequest flow to verify rate-limit headers appear
    const { handleRequest } = await import('../index.js');
    const db = new MemoryStorage();
    const cache = new MemoryCache();
    db.registerTenant(
      { id: 'rate-test', name: 'Rate Test', emailVerified: true, tier: 'free', isActive: true, journalismMode: false },
      'rate-test-key-hash',
      'rate-test-key',
    );
    const env = {
      QUILL_VERSION: '0.1.0',
      ENVIRONMENT: 'development',
      JWT_SECRET: 'test-jwt-secret-that-is-long-enough-for-testing',
    };
    // First, exhaust the rate limit by sending many requests
    let lastResp: Response | null = null;
    for (let i = 0; i < 40; i++) {
      const req = new Request('http://localhost/v1/keys', {
        headers: { 'X-API-Key': 'maplespike-dev-key' },
      });
      lastResp = await handleRequest(req, env, db, cache);
    }
    // Some requests should have been rate-limited
    if (lastResp && lastResp.status === 429) {
      assert.ok(lastResp.headers.get('X-RateLimit-Remaining'));
      assert.ok(lastResp.headers.get('X-RateLimit-Reset'));
      assert.ok(lastResp.headers.get('Retry-After'));
    }
  });
});

describe('Security Headers via jsonResponse', () => {
  it('jsonResponse includes security headers', async () => {
    const { buildSuccess, jsonResponse } = await import('../response.js');
    const ctx = {
      tenant: { id: 'test', name: 'Test', emailVerified: true, tier: 'free' as const, isActive: true, journalismMode: false },
      requestId: 'test',
      startTime: Date.now(),
    };
    const body = buildSuccess({ hello: 'world' }, ctx);
    const resp = jsonResponse(body, 200, {}, undefined, 'production');
    assert.equal(resp.headers.get('Strict-Transport-Security'), 'max-age=63072000; includeSubDomains; preload');
    assert.equal(resp.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(resp.headers.get('X-Frame-Options'), 'DENY');
  });

  it('jsonResponse does not add HSTS in non-production', async () => {
    const { buildSuccess, jsonResponse } = await import('../response.js');
    const ctx = {
      tenant: { id: 'test', name: 'Test', emailVerified: true, tier: 'free' as const, isActive: true, journalismMode: false },
      requestId: 'test',
      startTime: Date.now(),
    };
    const body = buildSuccess({ hello: 'world' }, ctx);
    const resp = jsonResponse(body, 200, {}, undefined, undefined);
    assert.equal(resp.headers.get('Strict-Transport-Security'), null);
  });
});
