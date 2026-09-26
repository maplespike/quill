import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeCtx as makeBaseCtx } from './_helpers.js';
import { MemoryStorage } from '../storage.js';
import { authMeHandler } from '../auth/github.js';
import { registerHandler } from '../routes/register.js';

interface MakeCtxOptions {
  cache?: any;
  db?: any;
  tenant?: any;
  apiKeyId?: string;
  requestId?: string;
  startTime?: number;
  env?: Record<string, string | undefined>;
}

function makeCtx(opts: MakeCtxOptions = {}) {
  const base = makeBaseCtx({
    tenant: opts.tenant ?? { tier: 'free' },
    db: opts.db ?? new MemoryStorage(),
    cache: opts.cache ?? new Map(),
  });
  return {
    ...base,
    apiKeyId: opts.apiKeyId ?? base.apiKeyId,
    requestId: opts.requestId ?? base.requestId,
    startTime: opts.startTime ?? base.startTime,
    env: opts.env ?? base.env,
  };
}

describe('GET /v1/auth/me', () => {
  let db: MemoryStorage;

  beforeEach(async () => {
    db = new MemoryStorage();
    // Ensure clean state
  });

  it('returns anon tenant when no credentials', async () => {
    const ctx = makeCtx({ db });
    const req = new Request('http://localhost/v1/auth/me', {
      method: 'GET',
    });
    const resp = await authMeHandler(req, ctx as any, {});
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.ok(body.success);
    assert.equal(body.data.tenant.id, 'anon');
    assert.equal(body.data.tenant.name, 'Anonymous');
    assert.deepEqual(body.data.apiKeys, []); // no keys for anon
  });

  it('returns tenant info when valid API key is provided', async () => {
    // First, register a tenant to get an API key
    const registerCtx = makeCtx({ db });
    const registerReq = new Request('http://localhost/v1/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test User', email: 'test@example.com' }),
    });
    const registerResp = await registerHandler(registerReq, registerCtx as any, {});
    assert.equal(registerResp.status, 201);
    const registerBody = await registerResp.json();
    assert.ok(registerBody.success);
    const apiKey = registerBody.data.apiKey.key; // raw key
    const tenantId = registerBody.data.tenant.id;

    // Now call /v1/auth/me with that key
    const authCtx = makeCtx({ db, apiKeyId: 'test-key-id' }); // apiKeyId is not used by handler but we set it
    const authReq = new Request('http://localhost/v1/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const authResp = await authMeHandler(authReq, authCtx as any, {});
    assert.equal(authResp.status, 200);
    const authBody = await authResp.json();
    assert.ok(authBody.success);
    // The tenant should match the registered tenant, not anon
    assert.notEqual(authBody.data.tenant.id, 'anon');
    assert.equal(authBody.data.tenant.id, tenantId);
    assert.equal(authBody.data.tenant.name, 'Test User');
    // The apiKeys array should contain at least one key (the one we just created)
    assert.ok(Array.isArray(authBody.data.apiKeys));
    assert.equal(authBody.data.apiKeys.length, 1);
    // The key object should have id and name, but not the raw key
    assert.ok(authBody.data.apiKeys[0].id);
    assert.equal(authBody.data.apiKeys[0].name, 'default');
    assert.ok(authBody.data.apiKeys[0].isActive);
    // The user object should also be populated (from GitHub OAuth? but we haven't linked)
    // Since we registered via email, the user might not be linked to a GitHub user.
    // The authMeHandler in github.js tries to getUser(ctx.tenant.id) which returns null if no GitHub user.
    // In that case, it falls back to returning the tenant fields as user.
    // So we expect the user object to match the tenant.
    assert.ok(authBody.data.user);
    assert.equal(authBody.data.user.id, tenantId);
    assert.equal(authBody.data.user.name, 'Test User');
  });

  it('returns 401 when invalid API key is provided', async () => {
    const ctx = makeCtx({ db });
    const req = new Request('http://localhost/v1/auth/me', {
      method: 'GET',
      headers: { Authorization: 'Bearer invalid_key' },
    });
    const resp = await authMeHandler(req, ctx as any, {});
    assert.equal(resp.status, 401);
    const body = await resp.json();
    assert.ok(!body.success);
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });
});