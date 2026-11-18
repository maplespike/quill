/**
 * GET /usage → 308 /v1/usage.
 *
 * Mirrors the /health redirect (health-redirect.test.ts). Ops monitors and MCP
 * tooling (system_health) reach for `/usage` first; the real path is `/v1/usage`.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import app from '../index.js';

const env = {};

describe('GET /usage redirect', () => {
  it('answers 308 to /v1/usage', async () => {
    const res = await app.fetch(new Request('https://api.maplespike.ca/usage'), env);
    assert.equal(res.status, 308);
    const location = res.headers.get('location') ?? '';
    assert.match(location, /\/v1\/usage$/);
    assert.equal(new URL(location).host, 'api.maplespike.ca');
    assert.match(res.headers.get('cache-control') ?? '', /max-age=\d+/);
  });

  it('keeps the trailing-slash form working', async () => {
    const res = await app.fetch(new Request('http://localhost/usage/'), env);
    assert.equal(res.status, 308);
    assert.match(res.headers.get('location') ?? '', /\/v1\/usage$/);
  });

  it('preserves the query string', async () => {
    const res = await app.fetch(new Request('http://localhost/usage?scope=self'), env);
    assert.equal(res.status, 308);
    const location = new URL(res.headers.get('location') ?? '');
    assert.equal(location.pathname, '/v1/usage');
    assert.equal(location.search, '?scope=self');
  });

  it('does not shadow the real usage route', async () => {
    // /v1/usage requires auth; without it we get 401/402, not a redirect.
    const res = await app.fetch(new Request('http://localhost/v1/usage'), env);
    assert.notEqual(res.status, 308);
  });
});