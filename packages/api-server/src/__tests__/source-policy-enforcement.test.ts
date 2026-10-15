import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorage, MemoryCache } from '../storage.js';
import type { Tier } from '../types.js';

/**
 * Licence-policy enforcement on the export surface (paid tier).
 *
 * Incident rule: pins the 2026-10-14 compliance design — committee
 * proceedings are discovery-only (parliamentary permissions exclude
 * commercial use), so the export endpoint must never return their content
 * (speeches, transcripts, evidence text). If a future edit removes the
 * policy hook in routes/export.ts, these fail.
 */

function makeCtx(tier: Tier = 'business') {
  const db = new MemoryStorage();
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
    cache: new MemoryCache(),
  };
}

const BANNED_CONTENT_KEYS = ['text', 'speech', 'speechText', 'transcript', 'evidence', 'content', 'fullText'];

/** Collect every object key anywhere in a value — proves absence of content fields. */
function collectKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, out);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      out.add(key);
      collectKeys(child, out);
    }
  }
  return out;
}

describe('committee sources are discovery-only on the export surface', () => {
  it('bulk export of committees returns no records, a policy block, and notices', async () => {
    const { exportModuleHandler } = await import('../routes/export.js');
    const ctx = makeCtx('business');
    const req = new Request('http://localhost/v1/export/committees?limit=50');
    const resp = await exportModuleHandler(req as never, ctx as never, { module: 'committees' });
    assert.equal(resp.status, 200);
    const body = await resp.json();
    const data = (body.data ?? body) as any;
    assert.equal(data.policy.discovery_only, true);
    assert.equal(data.policy.commercial_use, false);
    assert.deepEqual(data.records, []);
    assert.equal(data.total, 0);
    assert.ok(data.policy.notices.length >= 1, 'required notices must be attached');
    assert.ok(
      data.policy.notices.some((n: string) => n.includes("Speaker's Permission")),
      "the Speaker's Permission notice must ride with the response",
    );
    assert.ok(String(data.provenance.reason).includes('not offered'));
  });

  it('the paid export response never contains content fields', async () => {
    const { exportModuleHandler } = await import('../routes/export.js');
    const ctx = makeCtx('pro');
    const req = new Request('http://localhost/v1/export/committees?limit=50');
    const resp = await exportModuleHandler(req as never, ctx as never, { module: 'committees' });
    const body = await resp.json();
    const keys = collectKeys((body.data ?? body) as unknown);
    for (const banned of BANNED_CONTENT_KEYS) {
      assert.ok(!keys.has(banned), `response must not contain a "${banned}" field`);
    }
  });

  it('single-record export of committees is restricted too', async () => {
    const { exportModuleHandler } = await import('../routes/export.js');
    const ctx = makeCtx('enterprise');
    const req = new Request('http://localhost/v1/export/committees/some-id');
    const resp = await exportModuleHandler(req as never, ctx as never, {
      module: 'committees',
      id: 'some-id',
    });
    assert.equal(resp.status, 200);
    const body = await resp.json();
    const data = (body.data ?? body) as any;
    assert.deepEqual(data.records, []);
    assert.equal(data.policy.discovery_only, true);
  });

  it('modules listing carries the policy flags (and a negative control)', async () => {
    const { listModulesHandler } = await import('../routes/export.js');
    const ctx = makeCtx('pro');
    const resp = await listModulesHandler(new Request('http://localhost/v1/export/modules') as never, ctx as never, {});
    const body = await resp.json();
    const data = (body.data ?? body) as any;
    const committees = data.modules.find((m: { name: string }) => m.name === 'committees');
    assert.ok(committees, 'committees module must be listed');
    assert.equal(committees.policy.discovery_only, true);
    assert.equal(committees.policy.commercial_use, false);

    // Negative control: an unrestricted source does not claim discovery-only.
    const bank = data.modules.find((m: { name: string }) => m.name === 'bank-of-canada');
    assert.ok(bank, 'bank-of-canada module must be listed');
    assert.equal(bank.policy.discovery_only, false);
    assert.equal(bank.policy.commercial_use, true);

    // Personal-information minimization is flagged for lobbying/charity sources.
    const charity = data.modules.find((m: { name: string }) => m.name === 'cra-charity');
    assert.ok(charity, 'cra-charity module must be listed');
    assert.equal(charity.policy.minimize_personal_information, true);
  });
});
