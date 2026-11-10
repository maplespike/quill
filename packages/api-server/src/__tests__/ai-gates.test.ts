// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorage, MemoryCache } from '../storage.js';
import type { Tier } from '../types.js';

/**
 * Make a mock RouteContext for testing. Registers a tenant with the given tier.
 */
function makeCtx(tier: Tier = 'free', overrides: Record<string, unknown> = {}) {
  const db = new MemoryStorage();
  const cache = new MemoryCache();
  db.registerTenant(
    { id: `test-${tier}`, name: `${tier}-user`, emailVerified: true, tier, isActive: true, journalismMode: false },
    `hash-${tier}`,
    `key-${tier}`,
  );
  return {
    tenant: { id: `test-${tier}`, name: `${tier}-user`, emailVerified: true, tier, isActive: true, journalismMode: false },
    apiKeyId: `key-${tier}`,
    requestId: `test-${tier}`,
    startTime: Date.now(),
    env: {},
    db,
    cache,
    ...overrides,
  };
}

describe('AI Feature Gates', () => {
  // ── aiAskHandler (RAG) gate ──────────────────────────────────────

  describe('POST /v1/ai/ask (RAG)', () => {
    it('returns 402 for free-tier tenant', async () => {
      const { aiAskHandler } = await import('../routes/ai.js');
      const ctx = makeCtx('free');
      const req = new Request('http://localhost/v1/ai/ask', {
        method: 'POST',
        body: JSON.stringify({ query: 'What is the federal budget?' }),
      });
      const resp = await aiAskHandler(req, ctx as any, {});
      assert.equal(resp.status, 402);
      const body = await resp.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'UPGRADE_REQUIRED');
      assert.ok(body.error.message.includes('Pro plan'));
    });

    it('returns 402 for unauthenticated (free default) tenant', async () => {
      const { aiAskHandler } = await import('../routes/ai.js');
      // Anonymous tenant with free tier — simulates authExempt path in index.ts
      const ctx = {
        tenant: { id: 'anon', name: 'Anonymous', emailVerified: false, tier: 'free' as const, isActive: true, journalismMode: false },
        apiKeyId: '',
        requestId: 'test-anon',
        startTime: Date.now(),
        env: {},
        db: new MemoryStorage(),
        cache: new MemoryCache(),
      };
      const req = new Request('http://localhost/v1/ai/ask', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });
      const resp = await aiAskHandler(req, ctx as any, {});
      assert.equal(resp.status, 402);
      const body = await resp.json();
      assert.equal(body.error.code, 'UPGRADE_REQUIRED');
    });

    it('allows pro-tier tenant (not 402)', async () => {
      const { aiAskHandler } = await import('../routes/ai.js');
      const ctx = makeCtx('pro');
      const req = new Request('http://localhost/v1/ai/ask', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });
      const resp = await aiAskHandler(req, ctx as any, {});
      assert.notEqual(resp.status, 402);
      // Should proceed to AI — we get either 200 (AI available) or 500 (no gateway)
      assert.ok([200, 500].includes(resp.status));
    });

    it('allows business-tier tenant (not 402)', async () => {
      const { aiAskHandler } = await import('../routes/ai.js');
      const ctx = makeCtx('business');
      const req = new Request('http://localhost/v1/ai/ask', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });
      const resp = await aiAskHandler(req, ctx as any, {});
      assert.notEqual(resp.status, 402);
      assert.ok([200, 500].includes(resp.status));
    });

    it('allows enterprise-tier tenant (not 402)', async () => {
      const { aiAskHandler } = await import('../routes/ai.js');
      const ctx = makeCtx('enterprise');
      const req = new Request('http://localhost/v1/ai/ask', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });
      const resp = await aiAskHandler(req, ctx as any, {});
      assert.notEqual(resp.status, 402);
      assert.ok([200, 500].includes(resp.status));
    });

    it('allows internal-tier tenant (not 402)', async () => {
      const { aiAskHandler } = await import('../routes/ai.js');
      const ctx = makeCtx('internal');
      const req = new Request('http://localhost/v1/ai/ask', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      });
      const resp = await aiAskHandler(req, ctx as any, {});
      assert.notEqual(resp.status, 402);
      assert.ok([200, 500].includes(resp.status));
    });

    it('rejects empty query with 400 (free tier — gate check passes first)', async () => {
      const { aiAskHandler } = await import('../routes/ai.js');
      const ctx = makeCtx('free');
      const req = new Request('http://localhost/v1/ai/ask', {
        method: 'POST',
        body: JSON.stringify({ query: '' }),
      });
      const resp = await aiAskHandler(req, ctx as any, {});
      // Free tier hits the gate FIRST (402), before validation (400)
      assert.equal(resp.status, 402);
      const body = await resp.json();
      assert.equal(body.error.code, 'UPGRADE_REQUIRED');
    });

    it('empty query on pro tier gets 400 (gate passes, hits validation)', async () => {
      const { aiAskHandler } = await import('../routes/ai.js');
      const ctx = makeCtx('pro');
      const req = new Request('http://localhost/v1/ai/ask', {
        method: 'POST',
        body: JSON.stringify({ query: '' }),
      });
      const resp = await aiAskHandler(req, ctx as any, {});
      // Pro passes gate → validation rejects empty query with 400
      assert.equal(resp.status, 400);
      const body = await resp.json();
      assert.equal(body.error.code, 'VALIDATION_ERROR');
    });
  });

  // ── aiAnalyzeHandler gate ────────────────────────────────────────

  describe('POST /v1/ai/analyze', () => {
    it('returns 402 for free-tier tenant', async () => {
      const { aiAnalyzeHandler } = await import('../routes/ai.js');
      const ctx = makeCtx('free');
      const req = new Request('http://localhost/v1/ai/analyze', {
        method: 'POST',
        body: JSON.stringify({ text: 'Some document content for analysis.' }),
      });
      const resp = await aiAnalyzeHandler(req, ctx as any, {});
      assert.equal(resp.status, 402);
      const body = await resp.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'UPGRADE_REQUIRED');
      assert.ok(body.error.message.includes('Pro plan'));
    });

    it('allows pro-tier tenant (not 402)', async () => {
      const { aiAnalyzeHandler } = await import('../routes/ai.js');
      const ctx = makeCtx('pro');
      const req = new Request('http://localhost/v1/ai/analyze', {
        method: 'POST',
        body: JSON.stringify({ text: 'Some document content for analysis.' }),
      });
      const resp = await aiAnalyzeHandler(req, ctx as any, {});
      assert.notEqual(resp.status, 402);
      // 200 if AI available, 503 if unavailable
      assert.ok([200, 500, 503].includes(resp.status));
    });

    it('rejects missing text with 400 on pro tier (gate passes, hits validation)', async () => {
      const { aiAnalyzeHandler } = await import('../routes/ai.js');
      const ctx = makeCtx('pro');
      const req = new Request('http://localhost/v1/ai/analyze', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const resp = await aiAnalyzeHandler(req, ctx as any, {});
      assert.equal(resp.status, 400);
      const body = await resp.json();
      assert.equal(body.error.code, 'VALIDATION_ERROR');
    });
  });

  // ── Tier ordering: gate check always runs first ──────────────────

  describe('gate runs before validation', () => {
    it('invalid body on enterprise tier returns 400 (gate passes, validation catches it)', async () => {
      const { aiAskHandler } = await import('../routes/ai.js');
      const ctx = makeCtx('enterprise');
      const req = new Request('http://localhost/v1/ai/ask', {
        method: 'POST',
        body: JSON.stringify({}), // missing 'query' field
      });
      const resp = await aiAskHandler(req, ctx as any, {});
      // Enterprise passes gate → validation rejects missing body with 400
      assert.equal(resp.status, 400);
      const body = await resp.json();
      assert.equal(body.error.code, 'VALIDATION_ERROR');
    });
  });
});
