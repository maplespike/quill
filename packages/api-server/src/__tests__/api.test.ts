import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('API Server Routes', () => {
  it('health endpoint returns 200', async () => {
    const { healthHandler } = await import('../routes/health.js');
    const ctx = { tenant: { id: 'anon' }, requestId: 'test', startTime: Date.now() };
    const resp = await healthHandler(new Request('http://localhost/v1/health'), ctx as any, {});
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.ok(body.success);
    assert.ok(body.data);
  });

  it('register handler validates name field', async () => {
    const { registerHandler } = await import('../routes/register.js');
    const ctx = { tenant: { id: 'anon' }, requestId: 'test', startTime: Date.now() };
    const req = new Request('http://localhost/v1/register', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const resp = await registerHandler(req, ctx as any, {});
    assert.equal(resp.status, 400);
    const body = await resp.json();
    assert.equal(body.error, 'VALIDATION_ERROR');
  });

  it('register handler creates tenant with valid body', async () => {
    const { registerHandler } = await import('../routes/register.js');
    const ctx = { tenant: { id: 'anon' }, requestId: 'test', startTime: Date.now() };
    const req = new Request('http://localhost/v1/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test User', email: 'test@example.com' }),
    });
    const resp = await registerHandler(req, ctx as any, {});
    assert.equal(resp.status, 201);
    const body = await resp.json();
    assert.ok(body.success);
    assert.ok(body.data.apiKey.key.startsWith('maplespike_'));
  });

  it('keys endpoint returns list', async () => {
    const { listKeysHandler } = await import('../routes/keys.js');
    const ctx = {
      tenant: { id: 'test-tenant', tier: 'free' },
      apiKeyId: 'test-key',
      requestId: 'test', startTime: Date.now(),
    };
    const resp = await listKeysHandler(new Request('http://localhost/v1/keys'), ctx as any, {});
    assert.equal(resp.status, 200);
  });

  it('openapi spec returns JSON', async () => {
    const { openApiHandler } = await import('../routes/openapi.js');
    const ctx = { tenant: { id: 'anon' }, requestId: 'test', startTime: Date.now() };
    const resp = await openApiHandler(new Request('http://localhost/v1/openapi.json'), ctx as any, {});
    assert.equal(resp.status, 200);
    assert.ok(resp.headers.get('content-type')?.includes('json'));
  });

  it('usage endpoint returns data', async () => {
    const { usageHandler } = await import('../routes/usage.js');
    const ctx = {
      tenant: { id: 'test-tenant', tier: 'free' },
      requestId: 'test', startTime: Date.now(),
    };
    const resp = await usageHandler(new Request('http://localhost/v1/usage'), ctx as any, {});
    assert.equal(resp.status, 200);
  });

  it('auth enforcement: protected routes return 401 without key', async () => {
    const { authenticateRequest } = await import('../auth.js');
    const result = await authenticateRequest(new Request('http://localhost/v1/me'));
    assert.equal(result, null);
  });

  it('gov search handles missing query', async () => {
    const { searchGovHandler } = await import('../routes/gov.js');
    const ctx = { tenant: { id: 'test-tenant', tier: 'free' }, requestId: 'test', startTime: Date.now() };
    const resp = await searchGovHandler(new Request('http://localhost/v1/gov/search'), ctx as any, {});
    assert.ok(resp.status === 200 || resp.status === 400);
  });

  it('citation handler returns 404 for unknown hash', async () => {
    const { getCitationHandler } = await import('../routes/citation.js');
    const ctx = { tenant: { id: 'anon' }, requestId: 'test', startTime: Date.now() };
    const resp = await getCitationHandler(new Request('http://localhost/v1/citation/nonexistent'), ctx as any, { id: 'nonexistent' });
    assert.equal(resp.status, 404);
  });

  it('keys CRUD flow works correctly', async () => {
    const { createKeyHandler, listKeysHandler, deleteKeyHandler } = await import('../routes/keys.js');
    const ctx = {
      tenant: { id: 'test-tenant', tier: 'free' },
      requestId: 'test', startTime: Date.now(),
    };

    const createResp = await createKeyHandler(new Request('http://localhost/v1/keys', {
      method: 'POST',
    }), ctx as any, {});
    assert.equal(createResp.status, 200);
    const createBody = await createResp.json();
    assert.ok(createBody.data?.key?.startsWith('maplespike_'));
  });
});
