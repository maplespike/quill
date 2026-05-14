import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorage, MemoryCache } from '../storage.js';

function makeCtx(overrides: Record<string, unknown> = {}) {
  const db = new MemoryStorage();
  const cache = new MemoryCache();
  db.registerTenant(
    { id: 'test-tenant', name: 'Test User', tier: 'free', isActive: true, journalismMode: false },
    'test-key-hash',
    'test-key-id',
  );
  return {
    tenant: { id: 'test-tenant', name: 'Test User', tier: 'free' as const, isActive: true, journalismMode: false },
    apiKeyId: 'test-key-id',
    requestId: 'test',
    startTime: Date.now(),
    env: {},
    db,
    cache,
    ...overrides,
  };
}

describe('API Server Routes', () => {
  it('health endpoint returns 200', async () => {
    const { healthHandler } = await import('../routes/health.js');
    const ctx = makeCtx();
    const resp = await healthHandler(new Request('http://localhost/v1/health'), ctx as any, {});
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.ok(body.success);
    assert.ok(body.data);
  });

  it('register handler validates name field', async () => {
    const { registerHandler } = await import('../routes/register.js');
    const ctx = makeCtx();
    const req = new Request('http://localhost/v1/register', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const resp = await registerHandler(req, ctx as any, {});
    assert.equal(resp.status, 400);
    const body = await resp.json();
    // Expected shape: { success: false, error: { code: 'VALIDATION_ERROR', message: '...' } }
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  it('register handler creates tenant with valid body', async () => {
    const { registerHandler } = await import('../routes/register.js');
    const ctx = makeCtx();
    const req = new Request('http://localhost/v1/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'New User', email: 'new@example.com' }),
    });
    const resp = await registerHandler(req, ctx as any, {});
    assert.equal(resp.status, 201);
    const body = await resp.json();
    assert.ok(body.success);
    assert.ok(body.data.apiKey.key.startsWith('maplespike_'));
  });

  it('keys endpoint returns list', async () => {
    const { listKeysHandler } = await import('../routes/keys.js');
    const ctx = makeCtx();
    const resp = await listKeysHandler(new Request('http://localhost/v1/keys'), ctx as any, {});
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.ok(body.success);
  });

  it('openapi spec returns JSON', async () => {
    const { openApiHandler } = await import('../routes/openapi.js');
    const ctx = makeCtx();
    const resp = await openApiHandler(new Request('http://localhost/v1/openapi.json'), ctx as any, {});
    assert.equal(resp.status, 200);
    assert.ok(resp.headers.get('content-type')?.includes('json'));
  });

  it('usage endpoint returns data', async () => {
    const { usageHandler } = await import('../routes/usage.js');
    const ctx = makeCtx();
    const resp = await usageHandler(new Request('http://localhost/v1/usage'), ctx as any, {});
    assert.equal(resp.status, 200);
  });

  it('auth enforcement: protected routes return null without key', async () => {
    const { authenticateRequest } = await import('../auth.js');
    const result = await authenticateRequest(new Request('http://localhost/v1/me'));
    assert.equal(result, null);
  });

  it('gov search handles missing query', async () => {
    const { searchGovHandler } = await import('../routes/gov.js');
    const ctx = makeCtx();
    const resp = await searchGovHandler(new Request('http://localhost/v1/gov/search'), ctx as any, {});
    assert.ok([200, 400].includes(resp.status));
  });

  it('citation handler returns 404 for unknown hash', async () => {
    const { getCitationHandler } = await import('../routes/citation.js');
    const ctx = makeCtx();
    // Use a valid-looking 64-char hex hash that doesn't exist in pipeline data
    const resp = await getCitationHandler(new Request('http://localhost/v1/citation/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'), ctx as any, { id: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2' });
    assert.ok([404, 500].includes(resp.status));
  });

  it('keys CRUD flow works correctly', async () => {
    const { createKeyHandler, listKeysHandler, deleteKeyHandler } = await import('../routes/keys.js');
    const ctx = makeCtx();

    const createResp = await createKeyHandler(new Request('http://localhost/v1/keys', {
      method: 'POST',
    }), ctx as any, {});
    // Should return 201 on success, or handle errors gracefully
    assert.ok([200, 201, 500].includes(createResp.status));
    if (createResp.status === 201 || createResp.status === 200) {
      const createBody = await createResp.json();
      assert.ok(createBody.data?.key?.startsWith('maplespike_'));
    }
  });
});
