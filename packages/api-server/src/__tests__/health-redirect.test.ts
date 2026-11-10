// SPDX-License-Identifier: AGPL-3.0-only
/**
 * GET /health → 308 /v1/health.
 *
 * Incident (QUILL-AUDIT.md 2026-10-24, P2): `https://api.maplespike.ca/health`
 * returned 404 NOT_FOUND while the real liveness path is `/v1/health`. Ops
 * docs, ad-hoc curl checks and third-party monitors reach for `/health` first.
 *
 * 308 (permanent, method-preserving) is deliberate: `/v1/health` is the only
 * health document, so a client that guessed `/health` never has to guess again,
 * and a cache may keep the redirect.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import app from '../index.js';

const env = {};

describe('GET /health redirect', () => {
  it('answers 308 to /v1/health', async () => {
    const res = await app.fetch(new Request('https://api.maplespike.ca/health'), env);

    assert.equal(res.status, 308);
    const location = res.headers.get('location') ?? '';
    assert.match(location, /\/v1\/health$/);
    assert.equal(new URL(location).host, 'api.maplespike.ca');
    assert.match(res.headers.get('cache-control') ?? '', /max-age=\d+/);
  });

  it('keeps the trailing-slash form working', async () => {
    const res = await app.fetch(new Request('http://localhost/health/'), env);
    assert.equal(res.status, 308);
    assert.match(res.headers.get('location') ?? '', /\/v1\/health$/);
  });

  it('preserves the query string', async () => {
    const res = await app.fetch(new Request('http://localhost/health?verbose=1'), env);
    assert.equal(res.status, 308);
    const location = new URL(res.headers.get('location') ?? '');
    assert.equal(location.pathname, '/v1/health');
    assert.equal(location.search, '?verbose=1');
  });

  it('does not shadow the real health route', async () => {
    const res = await app.fetch(new Request('http://localhost/v1/health'), env);
    assert.equal(res.status, 200);
  });
});
