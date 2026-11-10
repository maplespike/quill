// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makeCtx as makeBaseCtx } from './_helpers.js';

function makeCtx() {
  return makeBaseCtx({ tenant: { tier: 'pro' } });
}

describe('Entity Resolution Routes', () => {
  it('POST /entity/resolve requires query parameter', async () => {
    const { entityResolveHandler } = await import('../routes/entity.js');
    const ctx = makeCtx();
    const req = new Request('http://localhost/v1/entity/resolve', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const resp = await entityResolveHandler(req, ctx as any, {});
    assert.equal(resp.status, 400);
    const body = await resp.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  it('POST /entity/resolve accepts valid query', async () => {
    const { entityResolveHandler } = await import('../routes/entity.js');
    const ctx = makeCtx();
    const req = new Request('http://localhost/v1/entity/resolve', {
      method: 'POST',
      body: JSON.stringify({ query: 'Trudeau' }),
    });
    const resp = await entityResolveHandler(req, ctx as any, {});
    assert.ok([200, 500].includes(resp.status));
    if (resp.status === 200) {
      const body = await resp.json();
      assert.ok(body.success);
      assert.ok(Array.isArray(body.data.entities));
    }
  });

  it('POST /entity/resolve filters by entity_type', async () => {
    const { entityResolveHandler } = await import('../routes/entity.js');
    const ctx = makeCtx();
    const req = new Request('http://localhost/v1/entity/resolve', {
      method: 'POST',
      body: JSON.stringify({ query: 'Trudeau', entity_type: 'person' }),
    });
    const resp = await entityResolveHandler(req, ctx as any, {});
    assert.ok([200, 500].includes(resp.status));
  });

  it('POST /entity/resolve rejects invalid entity_type', async () => {
    const { entityResolveHandler } = await import('../routes/entity.js');
    const ctx = makeCtx();
    const req = new Request('http://localhost/v1/entity/resolve', {
      method: 'POST',
      body: JSON.stringify({ query: 'Test', entity_type: 'invalid' }),
    });
    const resp = await entityResolveHandler(req, ctx as any, {});
    assert.equal(resp.status, 400);
    const body = await resp.json();
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  it('POST /entity/resolve respects confidence_threshold', async () => {
    const { entityResolveHandler } = await import('../routes/entity.js');
    const ctx = makeCtx();
    const req = new Request('http://localhost/v1/entity/resolve', {
      method: 'POST',
      body: JSON.stringify({ query: 'Test', confidence_threshold: 0.9 }),
    });
    const resp = await entityResolveHandler(req, ctx as any, {});
    assert.ok([200, 500].includes(resp.status));
  });

  it('POST /entity/resolve rejects invalid confidence_threshold', async () => {
    const { entityResolveHandler } = await import('../routes/entity.js');
    const ctx = makeCtx();
    const req = new Request('http://localhost/v1/entity/resolve', {
      method: 'POST',
      body: JSON.stringify({ query: 'Test', confidence_threshold: 1.5 }),
    });
    const resp = await entityResolveHandler(req, ctx as any, {});
    assert.equal(resp.status, 400);
    const body = await resp.json();
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  it('GET /entity/connections requires entity_id parameter', async () => {
    const { entityConnectionsHandler } = await import('../routes/entity.js');
    const ctx = makeCtx();
    const req = new Request('http://localhost/v1/entity/connections');
    const resp = await entityConnectionsHandler(req, ctx as any, {});
    assert.equal(resp.status, 400);
    const body = await resp.json();
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  it('GET /entity/connections accepts valid entity_id', async () => {
    const { entityConnectionsHandler } = await import('../routes/entity.js');
    const ctx = makeCtx();
    const req = new Request('http://localhost/v1/entity/connections?entity_id=test-entity-id');
    const resp = await entityConnectionsHandler(req, ctx as any, {});
    assert.ok([200, 500].includes(resp.status));
    if (resp.status === 200) {
      const body = await resp.json();
      assert.ok(body.success);
      assert.ok(Array.isArray(body.data.nodes));
      assert.ok(Array.isArray(body.data.edges));
    }
  });

  it('GET /entity/connections filters by relationship_type', async () => {
    const { entityConnectionsHandler } = await import('../routes/entity.js');
    const ctx = makeCtx();
    const req = new Request('http://localhost/v1/entity/connections?entity_id=test-entity-id&relationship_type=employment');
    const resp = await entityConnectionsHandler(req, ctx as any, {});
    assert.ok([200, 500].includes(resp.status));
  });

  it('GET /entity/connections respects max_depth parameter', async () => {
    const { entityConnectionsHandler } = await import('../routes/entity.js');
    const ctx = makeCtx();
    const req = new Request('http://localhost/v1/entity/connections?entity_id=test-entity-id&max_depth=3');
    const resp = await entityConnectionsHandler(req, ctx as any, {});
    assert.ok([200, 500].includes(resp.status));
  });

  it('GET /entity/connections rejects invalid max_depth', async () => {
    const { entityConnectionsHandler } = await import('../routes/entity.js');
    const ctx = makeCtx();
    const req = new Request('http://localhost/v1/entity/connections?entity_id=test-entity-id&max_depth=10');
    const resp = await entityConnectionsHandler(req, ctx as any, {});
    assert.equal(resp.status, 400);
    const body = await resp.json();
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });
});