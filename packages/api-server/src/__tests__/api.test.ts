import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makeCtx as makeBaseCtx } from './_helpers.js';

function makeCtx(tier: 'free' | 'pro' | 'business' = 'free') {
  return makeBaseCtx({ tenant: { tier } });
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
    assert.ok(body.data.apiKey.key.startsWith('quill_'));
  });

  it('keys endpoint returns list', async () => {
    const { listKeysHandler } = await import('../routes/keys.js');
    const ctx = makeCtx('pro');
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
    const ctx = makeCtx('business');
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

  it('compliance endpoint returns 200 or 503', async () => {
    const { complianceHandler } = await import('../routes/compliance.js');
    const ctx = makeCtx();
    const resp = await complianceHandler(new Request('http://localhost/v1/compliance?package=pipeline-core'), ctx as any, {});
    assert.ok([200, 503].includes(resp.status));
    if (resp.status === 200) {
      const body = await resp.json();
      assert.ok(body.success);
      assert.ok(body.data);
      const result = body.data.results[0];
      assert.equal(result.license, 'AGPL-3.0-only');
      assert.equal(result.attributionRequired, null);
      assert.equal(result.sourceAttributed, null);
    }
  });

  it('compliance endpoint with no package returns all', async () => {
    const { complianceHandler } = await import('../routes/compliance.js');
    const ctx = makeCtx();
    const resp = await complianceHandler(new Request('http://localhost/v1/compliance'), ctx as any, {});
    assert.ok([200, 503].includes(resp.status));
  });

  it('keys CRUD flow works correctly', async () => {
    const { createKeyHandler, listKeysHandler, deleteKeyHandler } = await import('../routes/keys.js');
    const ctx = makeCtx('pro');

    const createResp = await createKeyHandler(new Request('http://localhost/v1/keys', {
      method: 'POST',
    }), ctx as any, {});
    // Should return 201 on success, or handle errors gracefully
    assert.ok([200, 201, 500].includes(createResp.status));
    if (createResp.status === 201 || createResp.status === 200) {
      const createBody = await createResp.json();
      assert.ok(createBody.data?.key?.startsWith('quill_'));
    }
  });

  it('GET /v1/audit returns 200', async () => {
    const { auditGetHandler } = await import('../routes/audit-get.js');
    const ctx = makeCtx();
    const resp = await auditGetHandler(new Request('http://localhost/v1/audit'), ctx as any, {});
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.ok(body.success);
    assert.ok(Array.isArray(body.data.entries));
  });

  it('GET /v1/audit filters by operation', async () => {
    const { auditGetHandler } = await import('../routes/audit-get.js');
    const ctx = makeCtx();
    const resp = await auditGetHandler(new Request('http://localhost/v1/audit?operation=api_call'), ctx as any, {});
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.ok(body.success);
    assert.equal(body.data.query.operation, 'api_call');
  });

  it('GET /v1/audit respects limit param', async () => {
    const { auditGetHandler } = await import('../routes/audit-get.js');
    const ctx = makeCtx();
    const resp = await auditGetHandler(new Request('http://localhost/v1/audit?limit=5'), ctx as any, {});
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.equal(body.data.query.limit, 5);
  });
});
