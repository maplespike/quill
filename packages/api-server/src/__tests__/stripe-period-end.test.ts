/**
 * stripe_current_period_end on Stripe-Version 2026-06-24.dahlia.
 *
 * Since 2025-03-31.basil the period lives on items.data[0], not the
 * subscription root. Covers the helper, both webhook paths, reconcile-expiry
 * end-to-end, and the dry-run-by-default backfill. Mocked fetch only.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const WHSEC = 'whsec_FAKEFAKEFAKEFAKEFAKE';
process.env.STRIPE_SECRET_KEY = 'sk_test_FAKEFAKEFAKEFAKEFAKE';
process.env.STRIPE_WEBHOOK_SECRET = WHSEC;
process.env.QUILL_BILLING_SECRET = 'test-billing-secret-FAKE';

import * as stripe from '../services/stripe.js';
import { stripeWebhookHandler, reconcileExpiryHandler } from '../routes/billing-stripe.js';
import { backfillPeriodEnd, sqliteBackfillStore, type BackfillStore } from '../billing-period-end-backfill.js';
import { MemoryStorage } from '../storage.js';
import type { RouteContext } from '../types.js';

const db = new MemoryStorage();
let n = 0;
function ensureTenant(id: string) {
  if (db.tenants.has(id)) return;
  db.registerTenant(
    { id, name: 'Test', emailVerified: false, tier: 'free', isActive: true, journalismMode: false },
    `keyhash-${id}-${n++}`,
    `key-${id}`,
  );
}
function ctx(id = 'tenant_pe_default'): RouteContext {
  ensureTenant(id);
  return {
    tenant: { id, name: 'Test', emailVerified: false, tier: 'free', isActive: true, journalismMode: false },
    apiKeyId: `key-${id}`,
    requestId: 'req-test',
    startTime: Date.now(),
    env: {},
    db,
    cache: { get: async () => null, put: async () => {}, delete: async () => {} },
  };
}
const tenantRow = (id: string) => (db as any).tenants.get(id);

async function post(event: Record<string, any>): Promise<Response> {
  const raw = JSON.stringify(event);
  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', WHSEC).update(`${ts}.${raw}`, 'utf8').digest('hex');
  const tid = event?.data?.object?.metadata?.tenant_id;
  if (typeof tid === 'string') ensureTenant(tid);
  return stripeWebhookHandler(
    new Request('http://localhost/v1/billing/stripe/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${ts},v1=${sig}` },
      body: raw,
    }),
    ctx(),
    {},
  );
}

let evt = 0;
const eid = (tag: string) => `evt_pe_${tag}_${Date.now()}_${evt++}`;
const now = () => Math.floor(Date.now() / 1000);

/** A dahlia-shaped subscription: NO top-level current_period_end. */
function dahliaSub(id: string, periodEnd: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    object: 'subscription',
    status: 'active',
    items: { object: 'list', data: [{ id: 'si_FAKE', current_period_start: periodEnd - 30 * 86400, current_period_end: periodEnd }] },
    ...extra,
  };
}

type Call = { method: string; url: string };
function installFetch(calls: Call[], subs: Record<string, unknown>) {
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ method: init?.method ?? 'GET', url });
    const m = url.match(/\/subscriptions\/([^/?]+)$/);
    if (m && subs[m[1]]) {
      return new Response(JSON.stringify(subs[m[1]]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: { message: 'not found' } }), { status: 404 });
  }) as typeof fetch;
}

describe('subscriptionCurrentPeriodEnd', () => {
  it('reads items.data[0].current_period_end (dahlia shape)', () => {
    assert.equal(stripe.subscriptionCurrentPeriodEnd(dahliaSub('sub_x', 1_900_000_000)), 1_900_000_000);
  });
  it('prefers the item value over a legacy root value', () => {
    assert.equal(stripe.subscriptionCurrentPeriodEnd({ ...dahliaSub('sub_x', 1_900_000_000), current_period_end: 1 }), 1_900_000_000);
  });
  it('falls back to the legacy root field for pre-basil payloads', () => {
    assert.equal(stripe.subscriptionCurrentPeriodEnd({ id: 'sub_x', current_period_end: 1_800_000_000 }), 1_800_000_000);
  });
  it('returns undefined for missing / malformed values', () => {
    for (const v of [null, undefined, 'x', {}, { items: { data: [] } }, { items: { data: [{ current_period_end: 'soon' }] } }, { current_period_end: -5 }, { current_period_end: 1.5 }]) {
      assert.equal(stripe.subscriptionCurrentPeriodEnd(v), undefined, JSON.stringify(v));
    }
  });
});

describe('webhook period end (dahlia)', () => {
  let originalFetch: typeof global.fetch;
  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(() => { global.fetch = originalFetch; });

  it('customer.subscription.updated sets stripe_current_period_end from items.data[0]', async () => {
    const tenantId = 'tenant_pe_sub_updated';
    ensureTenant(tenantId);
    await db.updateTenantStripe(tenantId, { stripeCustomerId: 'cus_FAKE_pe1' });
    const end = now() + 30 * 86400;
    const res = await post({
      id: eid('upd'), type: 'customer.subscription.updated', created: now(), livemode: false,
      data: { object: { ...dahliaSub('sub_FAKE_pe1', end), customer: 'cus_FAKE_pe1', metadata: { tenant_id: tenantId, plan_id: 'pro' } } },
    });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).data.action, 'tier_renewed');
    assert.equal(tenantRow(tenantId).stripeCurrentPeriodEnd, end);
    assert.equal(tenantRow(tenantId).tier, 'pro');
  });

  it('checkout.session.completed sets the period end from the subscription (GET, mocked)', async () => {
    const tenantId = 'tenant_pe_checkout';
    const end = now() + 31 * 86400;
    const calls: Call[] = [];
    installFetch(calls, { sub_FAKE_pe2: dahliaSub('sub_FAKE_pe2', end) });
    const res = await post({
      id: eid('cs'), type: 'checkout.session.completed', created: now(), livemode: false,
      data: { object: { id: 'cs_test_FAKE_pe2', object: 'checkout.session', customer: 'cus_FAKE_pe2', subscription: 'sub_FAKE_pe2', metadata: { tenant_id: tenantId, plan_id: 'business' } } },
    });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).data.action, 'tier_upgraded');
    const t = tenantRow(tenantId);
    assert.equal(t.tier, 'business');
    assert.equal(t.stripeSubscriptionId, 'sub_FAKE_pe2');
    assert.equal(t.stripeCurrentPeriodEnd, end);
    assert.deepEqual(calls.map((c) => c.method), ['GET']);
    assert.ok(calls[0].url.endsWith('/subscriptions/sub_FAKE_pe2'));
  });

  it('checkout.session.completed uses an expanded subscription without any Stripe call', async () => {
    const tenantId = 'tenant_pe_checkout_expanded';
    const end = now() + 29 * 86400;
    const calls: Call[] = [];
    installFetch(calls, {});
    const res = await post({
      id: eid('csx'), type: 'checkout.session.completed', created: now(), livemode: false,
      data: { object: { id: 'cs_test_FAKE_pe3', object: 'checkout.session', customer: 'cus_FAKE_pe3', subscription: dahliaSub('sub_FAKE_pe3', end), metadata: { tenant_id: tenantId, plan_id: 'pro' } } },
    });
    assert.equal(res.status, 200);
    assert.equal(tenantRow(tenantId).stripeCurrentPeriodEnd, end);
    assert.equal(tenantRow(tenantId).stripeSubscriptionId, 'sub_FAKE_pe3');
    assert.equal(calls.length, 0);
  });

  it('checkout.session.completed still upgrades when the subscription read fails', async () => {
    const tenantId = 'tenant_pe_checkout_fail';
    installFetch([], {});
    const res = await post({
      id: eid('csf'), type: 'checkout.session.completed', created: now(), livemode: false,
      data: { object: { id: 'cs_test_FAKE_pe4', object: 'checkout.session', customer: 'cus_FAKE_pe4', subscription: 'sub_FAKE_pe4', metadata: { tenant_id: tenantId, plan_id: 'pro' } } },
    });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).data.action, 'tier_upgraded');
    assert.equal(tenantRow(tenantId).tier, 'pro');
    assert.equal(tenantRow(tenantId).stripeCurrentPeriodEnd, undefined);
  });

  it('reconcile-expiry downgrades a tenant whose dahlia period end has passed', async () => {
    const tenantId = 'tenant_pe_expired';
    ensureTenant(tenantId);
    await db.updateTenantStripe(tenantId, { stripeCustomerId: 'cus_FAKE_pe5' });
    const past = now() - 3600;
    await post({
      id: eid('exp'), type: 'customer.subscription.updated', created: now(), livemode: false,
      data: { object: { ...dahliaSub('sub_FAKE_pe5', past), customer: 'cus_FAKE_pe5', metadata: { tenant_id: tenantId, plan_id: 'pro' } } },
    });
    assert.equal(tenantRow(tenantId).tier, 'pro');
    const res = await reconcileExpiryHandler(
      new Request('http://localhost/v1/billing/reconcile-expiry', { method: 'POST', headers: { 'X-Billing-Secret': 'test-billing-secret-FAKE' } }),
      ctx(),
      {},
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.data.downgraded.some((d: { tenant_id: string }) => d.tenant_id === tenantId));
    assert.equal(tenantRow(tenantId).tier, 'free');
  });
});

describe('backfillPeriodEnd (dry-run by default, idempotent)', () => {
  function memStore(rows: Array<{ id: string; sub?: string; end?: number }>): BackfillStore & { rows: typeof rows; writes: number } {
    const st = {
      rows,
      writes: 0,
      listCandidates: () =>
        rows.filter((r) => r.sub && r.end === undefined).map((r) => ({ tenant_id: r.id, stripe_subscription_id: r.sub! })),
      setPeriodEndIfNull: (id: string, v: number) => {
        const r = rows.find((x) => x.id === id);
        if (!r || r.end !== undefined) return 0;
        r.end = v;
        st.writes++;
        return 1;
      },
    };
    return st;
  }

  it('zero candidates is a clean no-op (current live state: 0 subs)', async () => {
    const st = memStore([{ id: 'free_only' }]);
    const r = await backfillPeriodEnd(st, { apply: true, retrieve: async () => { throw new Error('must not be called'); } });
    assert.deepEqual(r, { apply: true, candidates: 0, outcomes: [] });
  });

  it('dry run reports would_set and writes nothing', async () => {
    const st = memStore([{ id: 't1', sub: 'sub_FAKE_b1' }]);
    const r = await backfillPeriodEnd(st, { apply: false, retrieve: async (id) => dahliaSub(id, 1_900_000_000) });
    assert.deepEqual(r.outcomes, [{ tenant_id: 't1', subscription_id: 'sub_FAKE_b1', action: 'would_set', period_end: 1_900_000_000 }]);
    assert.equal(st.writes, 0);
    assert.equal(st.rows[0].end, undefined);
  });

  it('apply writes once; a second run is a no-op', async () => {
    const st = memStore([{ id: 't1', sub: 'sub_FAKE_b1' }, { id: 't2', sub: 'sub_FAKE_b2', end: 123 }]);
    const retrieve = async (id: string) => dahliaSub(id, 1_900_000_000);
    const first = await backfillPeriodEnd(st, { apply: true, retrieve });
    assert.deepEqual(first.outcomes.map((o) => o.action), ['set']);
    const second = await backfillPeriodEnd(st, { apply: true, retrieve });
    assert.equal(second.candidates, 0);
    assert.equal(st.writes, 1);
    assert.equal(st.rows[1].end, 123, 'already-set rows untouched');
  });

  it('reports errors and missing period ends without writing', async () => {
    const st = memStore([{ id: 'a', sub: 'sub_FAKE_err' }, { id: 'b', sub: 'sub_FAKE_none' }]);
    const r = await backfillPeriodEnd(st, {
      apply: true,
      retrieve: async (id) => {
        if (id === 'sub_FAKE_err') throw new stripe.StripeApiError(404, '{"error":{"message":"No such subscription"}}');
        return { id, items: { data: [] } };
      },
    });
    assert.deepEqual(r.outcomes.map((o) => o.action), ['error', 'no_period_end']);
    assert.equal(st.writes, 0);
    assert.ok(!JSON.stringify(r).includes('No such subscription'), 'provider bodies not echoed');
  });

  it('SQLite adapter: selects only NULL rows and the guarded UPDATE never overwrites', async () => {
    const sdb = new DatabaseSync(':memory:');
    sdb.exec(`CREATE TABLE tenants (id TEXT PRIMARY KEY, stripe_subscription_id TEXT, stripe_current_period_end INTEGER)`);
    const ins = sdb.prepare('INSERT INTO tenants VALUES (?, ?, ?)');
    ins.run('t_null', 'sub_FAKE_s1', null);
    ins.run('t_set', 'sub_FAKE_s2', 555);
    ins.run('t_free', null, null);
    ins.run('t_empty', '', null);
    const store = sqliteBackfillStore(sdb);
    assert.deepEqual(
      (store.listCandidates() as Array<{ tenant_id: string; stripe_subscription_id: string }>).map((c) => ({ ...c })),
      [{ tenant_id: 't_null', stripe_subscription_id: 'sub_FAKE_s1' }],
    );
    const dry = await backfillPeriodEnd(store, { apply: false, retrieve: async (id) => dahliaSub(id, 1_900_000_000) });
    assert.equal(dry.outcomes[0].action, 'would_set');
    assert.equal((sdb.prepare("SELECT stripe_current_period_end AS e FROM tenants WHERE id='t_null'").get() as any).e, null);
    await backfillPeriodEnd(store, { apply: true, retrieve: async (id) => dahliaSub(id, 1_900_000_000) });
    assert.equal((sdb.prepare("SELECT stripe_current_period_end AS e FROM tenants WHERE id='t_null'").get() as any).e, 1_900_000_000);
    assert.equal(store.setPeriodEndIfNull('t_set', 1), 0);
    assert.equal((sdb.prepare("SELECT stripe_current_period_end AS e FROM tenants WHERE id='t_set'").get() as any).e, 555);
    sdb.close();
  });

  it('retrieveSubscription refuses non sub_ ids (no path injection)', async () => {
    await assert.rejects(() => stripe.retrieveSubscription('../customers/cus_x'), /Invalid Stripe subscription id/);
  });
});
