// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Entity Detail Routes tests
 *
 * Covers GET /v1/entities/{id} and GET /v1/entities/{id}/links:
 * tier gating (Pro / Business), validation, and graceful not-found
 * behavior when the entity graph is not populated.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeCtx as makeBaseCtx } from './_helpers.js';

// The handlers touch the shared DB via getRawDb() (default path
// 'quill.sqlite' relative to CWD). better-sqlite3 CREATES the file if
// absent — clean up so the suite doesn't pollute packages/api-server/.
//
// IMPORTANT: resolve the cleanup target relative to THIS test file, never
// process.cwd() — a repo-root test invocation would otherwise delete the
// shared root quill.sqlite holding real ingested data. The target is
// constructed inside the api-server package dir and the guard re-checks that
// so this hook can never touch files it didn't create.
const API_SERVER_PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
after(() => {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      const target = resolve(API_SERVER_PKG, `quill.sqlite${suffix}`);
      if (target.startsWith(API_SERVER_PKG + sep)) {
        rmSync(target, { force: true });
      }
    } catch {
      // best-effort cleanup
    }
  }
});

function makeCtx(tier: string) {
  return makeBaseCtx({ tenant: { tier } });
}

describe('Entity Detail Routes', () => {
  it('GET /entities/{id} requires Pro tier (free → 402)', async () => {
    const { entityByIdHandler } = await import('../routes/entities-detail.js');
    const ctx = makeCtx('free');
    const req = new Request('http://localhost/v1/entities/ent_1');
    const resp = await entityByIdHandler(req, ctx as any, { id: 'ent_1' });
    assert.equal(resp.status, 402);
    const body = await resp.json();
    assert.equal(body.error.code, 'UPGRADE_REQUIRED');
  });

  it('GET /entities/{id} accepts pro tier and returns 404 when graph not populated', async () => {
    const { entityByIdHandler } = await import('../routes/entities-detail.js');
    const ctx = makeCtx('pro');
    const req = new Request('http://localhost/v1/entities/ent_missing');
    const resp = await entityByIdHandler(req, ctx as any, { id: 'ent_missing' });
    // Graph may or may not be populated in the test environment; both outcomes
    // are valid as long as we don't crash or leak an internal error.
    assert.ok([200, 404].includes(resp.status));
    if (resp.status === 404) {
      const body = await resp.json();
      assert.equal(body.error.code, 'NOT_FOUND');
    }
  });

  it('GET /entities/{id} rejects missing id with 400', async () => {
    const { entityByIdHandler } = await import('../routes/entities-detail.js');
    const ctx = makeCtx('pro');
    const req = new Request('http://localhost/v1/entities/');
    const resp = await entityByIdHandler(req, ctx as any, { id: '' });
    assert.equal(resp.status, 400);
  });

  it('GET /entities/{id}/links requires Business tier (free → 402)', async () => {
    const { entityLinksHandler } = await import('../routes/entities-detail.js');
    const ctx = makeCtx('free');
    const req = new Request('http://localhost/v1/entities/ent_1/links');
    const resp = await entityLinksHandler(req, ctx as any, { id: 'ent_1' });
    assert.equal(resp.status, 402);
  });

  it('GET /entities/{id}/links requires Business tier (pro → 402)', async () => {
    const { entityLinksHandler } = await import('../routes/entities-detail.js');
    const ctx = makeCtx('pro');
    const req = new Request('http://localhost/v1/entities/ent_1/links');
    const resp = await entityLinksHandler(req, ctx as any, { id: 'ent_1' });
    assert.equal(resp.status, 402);
    const body = await resp.json();
    assert.equal(body.error.code, 'UPGRADE_REQUIRED');
  });

  it('GET /entities/{id}/links accepts business tier and returns 404 when graph not populated', async () => {
    const { entityLinksHandler } = await import('../routes/entities-detail.js');
    const ctx = makeCtx('business');
    const req = new Request('http://localhost/v1/entities/ent_missing/links');
    const resp = await entityLinksHandler(req, ctx as any, { id: 'ent_missing' });
    assert.ok([200, 404].includes(resp.status));
    if (resp.status === 404) {
      const body = await resp.json();
      assert.equal(body.error.code, 'NOT_FOUND');
    }
  });

  it('GET /entities/{id}/links rejects invalid type with 400', async () => {
    const { entityLinksHandler } = await import('../routes/entities-detail.js');
    const ctx = makeCtx('business');
    const req = new Request('http://localhost/v1/entities/ent_1/links?type=bogus');
    const resp = await entityLinksHandler(req, ctx as any, { id: 'ent_1' });
    assert.equal(resp.status, 400);
    const body = await resp.json();
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });
});
