import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../index.js';
import { hashApiKey } from '../auth.js';
import { NodeSqliteStorage } from '../node-sqlite-storage.js';
import { MemoryCache } from '../storage.js';
import type { TestContext } from 'node:test';
import type { Tier } from '../types.js';

const SECRET = 'synthetic-expiry-operator-secret';
const NOW = 1_800_000_000;

beforeEach((t) => {
  const saved = process.env.QUILL_BILLING_SECRET;
  process.env.QUILL_BILLING_SECRET = SECRET;
  t.after(() => {
    if (saved === undefined) delete process.env.QUILL_BILLING_SECRET;
    else process.env.QUILL_BILLING_SECRET = saved;
  });
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Outbound requests forbidden in expiry tests'); });
  t.mock.timers.enable({ apis: ['Date'], now: NOW * 1000 });
});

function key(id: string): string {
  return `synthetic-key-${id}`;
}

async function fixture(t: TestContext) {
  const db = new NodeSqliteStorage(':memory:');
  t.after(() => db.close());
  const cache = new MemoryCache();
  for (const [id, tier, period] of [
    ['expired-pro', 'pro', NOW - 1],
    ['expired-business', 'business', 0],
    ['boundary', 'pro', NOW],
    ['future', 'business', NOW + 1],
    ['no-period', 'pro', undefined],
    ['free', 'free', NOW - 1],
  ] as const) {
    db.createTenant({ id, name: id, tier, emailVerified: true, isActive: true, journalismMode: false });
    db.createApiKey(`key-${id}`, id, await hashApiKey(key(id)), 'test');
    await db.updateTenantStripe(id, { stripeCurrentPeriodEnd: period, stripeSubscriptionStatus: 'active' });
  }
  const call = (path = '/v1/billing/reconcile-expiry', init: RequestInit = {}) =>
    handleRequest(new Request(`http://expiry.test${path}`, { method: 'POST', ...init }),
      { ENVIRONMENT: 'test' }, db, cache);
  return { db, call };
}

const authorized = { headers: { 'X-Billing-Secret': SECRET } };

async function tier(db: NodeSqliteStorage, key: string): Promise<Tier | undefined> {
  return (await db.authenticate(key))?.tenant.tier;
}

describe('expiry reconciliation through the gateway', () => {
  it('secret-only empty-body request downgrades expired paid tiers, audits once, and updates the next tenant read', async (t) => {
    const { db, call } = await fixture(t);
    const res = await call(undefined, authorized);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.processed, 2);
    assert.deepEqual(body.data.downgraded.map((row: { tenant_id: string }) => row.tenant_id).sort(), ['expired-business', 'expired-pro']);
    assert.ok(!JSON.stringify(body).includes(SECRET));
    for (const id of ['expired-pro', 'expired-business']) {
      const tenant = (await db.authenticate(key(id)))!.tenant;
      assert.equal(tenant.tier, 'free');
      assert.equal(tenant.stripeSubscriptionStatus, 'canceled');
      const audit = await db.queryAudit({ tenantId: id, operation: 'billing_tier_expired' });
      assert.equal(audit.length, 1);
      assert.equal(audit[0].success, true);
    }
    for (const [id, expected] of [['boundary', 'pro'], ['future', 'business'], ['no-period', 'pro'], ['free', 'free']] as const) {
      assert.equal(await tier(db, key(id)), expected);
      assert.equal((await db.queryAudit({ tenantId: id, operation: 'billing_tier_expired' })).length, 0);
    }
    const usage = await call('/v1/usage', { method: 'GET', headers: { Authorization: `Bearer ${key('expired-pro')}` } });
    assert.equal(usage.status, 200);
    assert.equal((await usage.json()).data.tenant.tier, 'free');
    const repeat = await call('/v1/billing/reconcile-expiry/', authorized);
    assert.equal(repeat.status, 200);
    assert.deepEqual((await repeat.json()).data, { processed: 0, downgraded: [] });
    assert.equal((await db.queryAudit({ tenantId: 'expired-pro', operation: 'billing_tier_expired' })).length, 1);
  });

  for (const [name, supplied, configured] of [
    ['missing header', undefined, SECRET],
    ['empty header', '', SECRET],
    ['wrong header', 'wrong-secret', SECRET],
    ['unconfigured secret', SECRET, undefined],
    ['empty configured secret', '', ''],
  ] as const) {
    it(`rejects ${name} without reading or mutating expiry state`, async (t) => {
      const { db, call } = await fixture(t);
      if (configured === undefined) delete process.env.QUILL_BILLING_SECRET;
      else process.env.QUILL_BILLING_SECRET = configured;
      const read = t.mock.method(db, 'findTenantsForTierExpiry');
      const res = await call(undefined, { headers: supplied === undefined ? {} : { 'X-Billing-Secret': supplied } });
      assert.equal(res.status, 403);
      assert.equal((await res.json()).error.code, 'FORBIDDEN');
      assert.equal(read.mock.callCount(), 0);
      assert.equal(await tier(db, key('expired-pro')), 'pro');
      assert.equal((await db.queryAudit({ tenantId: 'expired-pro' })).length, 0);
    });
  }

  it('a valid tenant key alone cannot authorize expiry, and an invalid Bearer key cannot block a valid operator', async (t) => {
    const { db, call } = await fixture(t);
    const denied = await call(undefined, { headers: { Authorization: `Bearer ${key('free')}` } });
    assert.equal(denied.status, 403);
    assert.equal(await tier(db, key('expired-pro')), 'pro');
    const allowed = await call(undefined, { headers: { 'x-billing-secret': SECRET, Authorization: 'Bearer invalid-key' } });
    assert.equal(allowed.status, 200);
    assert.equal((await allowed.json()).data.processed, 2);
  });

  it('keeps the operator secret inside the expiry route: no other path is matched or upgraded by it', async (t) => {
    const { call } = await fixture(t);
    assert.equal((await call('/v1/billing/reconcile-expiry/extra', authorized)).status, 404);
    assert.equal((await call(undefined, { method: 'GET', ...authorized })).status, 404);
    assert.equal((await call('/v1/energy', { method: 'GET', headers: {
      Authorization: `Bearer ${key('free')}`, 'X-Billing-Secret': SECRET,
    } })).status, 402);
  });

  it('returns an empty result when no paid tenant is expired', async (t) => {
    const { db, call } = await fixture(t);
    for (const id of ['expired-pro', 'expired-business']) await db.updateTenantStripe(id, { tier: 'free' });
    const res = await call(undefined, authorized);
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).data, { processed: 0, downgraded: [] });
  });

  it('reports a partial write failure and retries only the still-expired tenant', async (t) => {
    const { db, call } = await fixture(t);
    const update = db.updateTenantStripe.bind(db);
    let failing = true;
    t.mock.method(db, 'updateTenantStripe', async (id, changes) => {
      if (id === 'expired-pro' && failing) throw new Error('Synthetic write failure');
      await update(id, changes);
    });
    const failed = await call(undefined, authorized);
    assert.equal(failed.status, 500);
    assert.equal((await failed.json()).error.code, 'RECONCILE_FAILED');
    assert.equal(await tier(db, key('expired-pro')), 'pro');
    assert.equal(await tier(db, key('expired-business')), 'free');
    failing = false;
    const retried = await call(undefined, authorized);
    assert.equal(retried.status, 200);
    assert.deepEqual((await retried.json()).data, {
      processed: 1, downgraded: [{ tenant_id: 'expired-pro', from: 'pro', to: 'free' }],
    });
    for (const id of ['expired-pro', 'expired-business']) {
      assert.equal((await db.queryAudit({ tenantId: id, operation: 'billing_tier_expired' })).length, 1);
    }
  });
});
