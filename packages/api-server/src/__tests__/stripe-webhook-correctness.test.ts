/**
 * Stripe webhook correctness (audit item 3). Mocked fetch only; fake keys.
 *
 *  - processed-marking only after the DB commit (in-memory + reconciliation row)
 *  - charge.refunded records the incremental delta
 *  - event.livemode must match STRIPE_ENV
 *  - validateStripeEnv fails closed when STRIPE_ENV is unset in production
 *  - webhook route exempt from the FREE per-IP rate limit
 *  - charge.dispute.created / .closed, customer.deleted, checkout.session.expired
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';

const WHSEC = 'whsec_FAKEFAKEFAKEFAKEFAKE';
process.env.STRIPE_SECRET_KEY = 'sk_test_FAKEFAKEFAKEFAKEFAKE';
process.env.STRIPE_WEBHOOK_SECRET = WHSEC;

import { stripeWebhookHandler, stripePortalHandler, _resetProcessedStripeEventsForTests } from '../routes/billing-stripe.js';
import { validateStripeEnv } from '../config.js';
import { createNodeRequestListener, isRateLimitExempt, type NodeRateLimiter } from '../node-listener.js';
import { MemoryCache, MemoryStorage } from '../storage.js';
import type { RouteContext } from '../types.js';

/** MemoryStorage with switchable failure injection. */
class FlakyStorage extends MemoryStorage {
  failTenantWrites = 0;
  failReconciliation: 'none' | 'generic' = 'none';
  override async updateTenantStripe(...args: Parameters<MemoryStorage['updateTenantStripe']>) {
    if (this.failTenantWrites > 0) {
      this.failTenantWrites--;
      throw new Error('SQLITE_BUSY: database is locked');
    }
    return super.updateTenantStripe(...args);
  }
  override async createPaymentReconciliation(...args: Parameters<MemoryStorage['createPaymentReconciliation']>) {
    if (this.failReconciliation === 'generic') {
      this.failReconciliation = 'none';
      throw new Error('disk I/O error');
    }
    return super.createPaymentReconciliation(...args);
  }
}

const db = new FlakyStorage();
let n = 0;
function ensureTenant(id: string) {
  if (db.tenants.has(id)) return;
  db.registerTenant(
    { id, name: 'Test', emailVerified: false, tier: 'free', isActive: true, journalismMode: false },
    `keyhash-${id}-${n++}`,
    `key-${id}`,
  );
}
function ctx(id = 'tenant_wc_default'): RouteContext {
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
const row = (id: string) => (db as any).tenants.get(id);
let seq = 0;
const eid = (t: string) => `evt_wc_${t}_${Date.now()}_${seq++}`;
const now = () => Math.floor(Date.now() / 1000);

async function post(event: Record<string, any>): Promise<{ status: number; body: any }> {
  const raw = JSON.stringify({ created: now(), livemode: false, ...event });
  const ts = now();
  const sig = crypto.createHmac('sha256', WHSEC).update(`${ts}.${raw}`, 'utf8').digest('hex');
  const res = await stripeWebhookHandler(
    new Request('http://localhost/v1/billing/stripe/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${ts},v1=${sig}` },
      body: raw,
    }),
    ctx(),
    {},
  );
  return { status: res.status, body: await res.json() };
}

function subUpdated(id: string, tenantId: string, customer: string, plan = 'pro') {
  return {
    id,
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: `sub_FAKE_${tenantId}`,
        object: 'subscription',
        status: 'active',
        customer,
        metadata: { tenant_id: tenantId, plan_id: plan },
        items: { data: [{ current_period_end: now() + 30 * 86400 }] },
      },
    },
  };
}

let savedEnv: string | undefined;
let originalFetch: typeof global.fetch;
let errLines: string[] = [];
let origConsoleError: typeof console.error;
beforeEach(() => {
  savedEnv = process.env.STRIPE_ENV;
  delete process.env.STRIPE_ENV;
  originalFetch = global.fetch;
  global.fetch = (async () => new Response('{"error":{}}', { status: 404 })) as typeof fetch;
  errLines = [];
  origConsoleError = console.error;
  console.error = (...a: unknown[]) => { errLines.push(a.map(String).join(' ')); };
});
afterEach(() => {
  if (savedEnv === undefined) delete process.env.STRIPE_ENV;
  else process.env.STRIPE_ENV = savedEnv;
  global.fetch = originalFetch;
  console.error = origConsoleError;
});

describe('processed only after the DB commit', () => {
  it('a handler DB failure returns 500 and the retry is processed, not "duplicate"', async () => {
    const t = 'tenant_wc_retry';
    ensureTenant(t);
    await db.updateTenantStripe(t, { stripeCustomerId: 'cus_FAKE_retry' });
    const ev = subUpdated(eid('retry'), t, 'cus_FAKE_retry');
    db.failTenantWrites = 1;
    const first = await post(ev);
    assert.equal(first.status, 500);
    assert.equal(row(t).tier, 'free');
    const second = await post(ev);
    assert.equal(second.status, 200);
    assert.equal(second.body.data.action, 'tier_renewed');
    assert.equal(row(t).tier, 'pro');
    const third = await post(ev);
    assert.equal(third.body.data.action, 'duplicate');
  });

  it('a non-UNIQUE reconciliation failure is a 500 (not swallowed) and the retry succeeds', async () => {
    const t = 'tenant_wc_recon';
    ensureTenant(t);
    await db.updateTenantStripe(t, { stripeCustomerId: 'cus_FAKE_recon' });
    const ev = subUpdated(eid('recon'), t, 'cus_FAKE_recon');
    db.failReconciliation = 'generic';
    const first = await post(ev);
    assert.equal(first.status, 500);
    assert.equal(first.body.error.code, 'WEBHOOK_PERSIST_ERROR');
    const second = await post(ev);
    assert.equal(second.status, 200);
    assert.equal(second.body.data.action, 'tier_renewed');
    const recs = await db.getPaymentReconciliations(500);
    assert.equal(recs.filter((r) => r.transactionUid === ev.id).length, 1);
  });

  it('after a pod restart the DB UNIQUE key dedupes (duplicate_db)', async () => {
    const t = 'tenant_wc_restart';
    ensureTenant(t);
    await db.updateTenantStripe(t, { stripeCustomerId: 'cus_FAKE_restart' });
    const ev = subUpdated(eid('restart'), t, 'cus_FAKE_restart');
    assert.equal((await post(ev)).body.data.action, 'tier_renewed');
    _resetProcessedStripeEventsForTests();
    const replay = await post(ev);
    assert.equal(replay.status, 200);
    assert.equal(replay.body.data.action, 'duplicate_db');
  });
});

describe('charge.refunded records the incremental delta', () => {
  it('two partial refunds on one charge net -1000 then -500 (not -1500 cumulative)', async () => {
    await db.ensureTaxLedgerSchema();
    const before = await db.getTaxLedgerSummary(0);
    const base = { object: 'charge', id: 'ch_FAKE_partial', amount: 5000, currency: 'cad' };
    const r1 = await post({ id: eid('ref1'), type: 'charge.refunded', data: { object: { ...base, amount_refunded: 1000 }, previous_attributes: { amount_refunded: 0 } } });
    const r2 = await post({ id: eid('ref2'), type: 'charge.refunded', data: { object: { ...base, amount_refunded: 1500 }, previous_attributes: { amount_refunded: 1000 } } });
    assert.equal(r1.body.data.action, 'refund_recorded');
    assert.equal(r2.body.data.action, 'refund_recorded');
    const after = await db.getTaxLedgerSummary(0);
    assert.equal(after.refundsCents - before.refundsCents, 1500);
  });

  it('missing previous_attributes is flagged for review and records nothing', async () => {
    const before = await db.getTaxLedgerSummary(0);
    const r = await post({ id: eid('refx'), type: 'charge.refunded', data: { object: { object: 'charge', id: 'ch_FAKE_noprev', amount_refunded: 700, currency: 'cad' } } });
    assert.equal(r.body.data.action, 'refund_needs_review');
    assert.equal((await db.getTaxLedgerSummary(0)).refundsCents, before.refundsCents);
    assert.ok(errLines.some((l) => l.includes('[BILLING-ALERT][refund_delta_unknown]')));
  });
});

describe('event.livemode must match STRIPE_ENV', () => {
  const ping = (livemode: boolean) => ({ id: eid('mode'), type: 'ping.unhandled', livemode, data: { object: {} } });
  it('STRIPE_ENV=live rejects a test-mode event', async () => {
    process.env.STRIPE_ENV = 'live';
    const r = await post(ping(false));
    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, 'LIVEMODE_MISMATCH');
  });
  it('STRIPE_ENV=test rejects a live-mode event', async () => {
    process.env.STRIPE_ENV = 'test';
    assert.equal((await post(ping(true))).status, 400);
  });
  it('matching modes pass', async () => {
    process.env.STRIPE_ENV = 'live';
    assert.equal((await post(ping(true))).status, 200);
    process.env.STRIPE_ENV = 'test';
    assert.equal((await post(ping(false))).status, 200);
  });
  it('STRIPE_ENV unset keeps the previous behaviour (no check)', async () => {
    assert.equal((await post(ping(true))).status, 200);
  });
});

describe('validateStripeEnv fails closed when STRIPE_ENV is unset in production', () => {
  const SK = 'sk_live_' + 'q'.repeat(24);
  it('throws in production with a secret key and no STRIPE_ENV, without key material', () => {
    assert.throws(
      () => validateStripeEnv({ ENVIRONMENT: 'production', STRIPE_SECRET_KEY: SK }),
      (e: Error) => /STRIPE_ENV is unset in production/.test(e.message) && !e.message.includes('qqqq'),
    );
  });
  it('throws in production with only a webhook secret', () => {
    assert.throws(() => validateStripeEnv({ ENVIRONMENT: 'production', STRIPE_WEBHOOK_SECRET: WHSEC }), /STRIPE_ENV is unset/);
  });
  it('production without any Stripe credentials (cannot bill) still boots', () => {
    assert.doesNotThrow(() => validateStripeEnv({ ENVIRONMENT: 'production' }));
  });
  it('development / tests stay permissive', () => {
    assert.doesNotThrow(() => validateStripeEnv({ ENVIRONMENT: 'development', STRIPE_SECRET_KEY: SK }));
    assert.doesNotThrow(() => validateStripeEnv({ STRIPE_SECRET_KEY: SK }));
  });
  it('production with STRIPE_ENV declared is unchanged', () => {
    assert.doesNotThrow(() => validateStripeEnv({ ENVIRONMENT: 'production', STRIPE_ENV: 'live', STRIPE_SECRET_KEY: SK }));
  });
});

describe('webhook route is exempt from the FREE per-IP rate limit', () => {
  it('isRateLimitExempt: exact POST webhook path only', () => {
    assert.equal(isRateLimitExempt('POST', '/v1/billing/stripe/webhook'), true);
    assert.equal(isRateLimitExempt('POST', '/v1/billing/stripe/webhook/'), true);
    assert.equal(isRateLimitExempt('GET', '/v1/billing/stripe/webhook'), false);
    assert.equal(isRateLimitExempt('POST', '/v1/billing/stripe/checkout'), false);
    assert.equal(isRateLimitExempt('POST', '/v1/billing/stripe/webhookx'), false);
  });

  it('listener: an exhausted limiter still lets the webhook through; other routes get 429', async () => {
    global.fetch = originalFetch; // real loopback HTTP for this test
    let checks = 0;
    const deny: NodeRateLimiter = {
      extractIP: () => '203.0.113.9',
      extractTier: () => 'FREE',
      async check() {
        checks++;
        return { allowed: false, limit: 100, remaining: 0, resetTime: 1_700_000_000, retryAfter: 30 };
      },
    };
    const handler = createNodeRequestListener({
      responseCache: { get: async () => null, set: async () => {} },
      rateLimiter: deny,
      handleRequest: async () => new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
      env: { ENVIRONMENT: 'development', JWT_SECRET: 'test-jwt-secret-webhook-rl-0123456789abcdef' },
      db: new MemoryStorage(),
      quillCache: new MemoryCache(),
      environment: 'development',
    });
    const server = http.createServer(handler);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const port = (server.address() as AddressInfo).port;
    try {
      const wh = await fetch(`http://127.0.0.1:${port}/v1/billing/stripe/webhook`, { method: 'POST', body: '{}' });
      assert.equal(wh.status, 200);
      assert.equal(checks, 0, 'limiter not consulted for the webhook');
      const other = await fetch(`http://127.0.0.1:${port}/v1/modules`);
      assert.equal(other.status, 429);
      const getWh = await fetch(`http://127.0.0.1:${port}/v1/billing/stripe/webhook`);
      assert.equal(getWh.status, 429);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
    }
  });
});

describe('charge.dispute.created / closed', () => {
  function chargeFetch(tenantId: string, customer: string) {
    const calls: string[] = [];
    global.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (/\/charges\/ch_FAKE_disp\?expand%5B%5D=customer$|\/charges\/ch_FAKE_disp\?expand\[\]=customer$/.test(url)) {
        return new Response(JSON.stringify({ id: 'ch_FAKE_disp', object: 'charge', customer: { id: customer, object: 'customer', metadata: { tenant_id: tenantId } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('{"error":{}}', { status: 404 });
    }) as typeof fetch;
    return calls;
  }

  it('freezes entitlements, alerts, holds against re-upgrade, and lifts on a won close', async () => {
    const t = 'tenant_wc_dispute';
    ensureTenant(t);
    await db.updateTenantStripe(t, { tier: 'pro', stripeCustomerId: 'cus_FAKE_disp', stripeSubscriptionStatus: 'active' });
    const calls = chargeFetch(t, 'cus_FAKE_disp');
    const r = await post({ id: eid('dc'), type: 'charge.dispute.created', data: { object: { id: 'dp_FAKE_1', object: 'dispute', charge: 'ch_FAKE_disp', amount: 5000, currency: 'cad', reason: 'fraudulent', status: 'needs_response' } } });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.action, 'entitlements_frozen');
    assert.equal(row(t).tier, 'free');
    assert.equal(row(t).stripeSubscriptionStatus, 'disputed');
    assert.ok(calls.some((u) => u.includes('/charges/ch_FAKE_disp')));
    assert.ok(errLines.some((l) => l.includes('[BILLING-ALERT][dispute_created]') && l.includes('dp_FAKE_1')));

    const held = await post(subUpdated(eid('held'), t, 'cus_FAKE_disp'));
    assert.equal(held.body.data.action, 'held_disputed');
    assert.equal(row(t).tier, 'free');

    const closed = await post({ id: eid('dw'), type: 'charge.dispute.closed', data: { object: { id: 'dp_FAKE_1', object: 'dispute', charge: 'ch_FAKE_disp', status: 'won' } } });
    assert.equal(closed.body.data.action, 'dispute_hold_lifted');
    assert.equal(row(t).stripeSubscriptionStatus, 'active');
    const renewed = await post(subUpdated(eid('ren'), t, 'cus_FAKE_disp'));
    assert.equal(renewed.body.data.action, 'tier_renewed');
    assert.equal(row(t).tier, 'pro');
  });

  it('a lost dispute keeps the freeze', async () => {
    const t = 'tenant_wc_dispute_lost';
    ensureTenant(t);
    await db.updateTenantStripe(t, { tier: 'business', stripeCustomerId: 'cus_FAKE_lost' });
    chargeFetch(t, 'cus_FAKE_lost');
    await post({ id: eid('dl1'), type: 'charge.dispute.created', data: { object: { id: 'dp_FAKE_2', charge: 'ch_FAKE_disp', amount: 20000, currency: 'cad' } } });
    const c = await post({ id: eid('dl2'), type: 'charge.dispute.closed', data: { object: { id: 'dp_FAKE_2', charge: 'ch_FAKE_disp', status: 'lost' } } });
    assert.equal(c.body.data.action, 'dispute_lost_kept_frozen');
    assert.equal(row(t).stripeSubscriptionStatus, 'disputed');
  });

  it('a dispute whose customer is not bound to the claimed tenant freezes nobody but still alerts', async () => {
    const victim = 'tenant_wc_dispute_victim';
    ensureTenant(victim);
    await db.updateTenantStripe(victim, { tier: 'pro', stripeCustomerId: 'cus_FAKE_victim' });
    chargeFetch(victim, 'cus_FAKE_someone_else');
    const r = await post({ id: eid('du'), type: 'charge.dispute.created', data: { object: { id: 'dp_FAKE_3', charge: 'ch_FAKE_disp', amount: 1 } } });
    assert.equal(r.body.data.action, 'dispute_unmatched');
    assert.equal(row(victim).tier, 'pro');
    assert.ok(errLines.some((l) => l.includes('[BILLING-ALERT][dispute_unmatched]')));
  });

  it('a failed charge lookup is a 500 so Stripe retries (not marked processed)', async () => {
    const ev = { id: eid('dfail'), type: 'charge.dispute.created', data: { object: { id: 'dp_FAKE_4', charge: 'ch_FAKE_missing' } } };
    assert.equal((await post(ev)).status, 500);
    assert.equal((await post(ev)).status, 500, 'still retried, never short-circuited as duplicate');
  });
});

describe('customer.deleted', () => {
  it('unbinds the deleted customer; portal then reports no customer', async () => {
    const t = 'tenant_wc_custdel';
    ensureTenant(t);
    await db.updateTenantStripe(t, { stripeCustomerId: 'cus_FAKE_del', stripeSubscriptionId: 'sub_FAKE_del' });
    const r = await post({ id: eid('cd'), type: 'customer.deleted', data: { object: { id: 'cus_FAKE_del', object: 'customer', metadata: { tenant_id: t } } } });
    assert.equal(r.body.data.action, 'customer_unbound');
    assert.ok(!(await db.getTenantStripeCustomerId(t)));
    const portal = await stripePortalHandler(new Request('http://localhost/v1/billing/stripe/portal', { method: 'POST' }), ctx(t), {});
    assert.equal(portal.status, 404);
  });

  it('ignores a customer that is not the tenant\'s bound one', async () => {
    const t = 'tenant_wc_custdel2';
    ensureTenant(t);
    await db.updateTenantStripe(t, { stripeCustomerId: 'cus_FAKE_keep' });
    const r = await post({ id: eid('cd2'), type: 'customer.deleted', data: { object: { id: 'cus_FAKE_other', object: 'customer', metadata: { tenant_id: t } } } });
    assert.equal(r.body.data.action, 'customer_not_bound');
    assert.equal(await db.getTenantStripeCustomerId(t), 'cus_FAKE_keep');
  });
});

describe('checkout.session.expired', () => {
  it('marks our pending order expired; leaves paid orders alone', async () => {
    const t = 'tenant_wc_expired';
    ensureTenant(t);
    await db.createStripeOrder({ order_id: 'MS-EXPIR1', tenant_id: t, plan_id: 'pro', amount_cents: 5000, currency: 'CAD', stripe_checkout_session_id: 'cs_test_FAKE_exp1', status: 'pending', expires_at: now() - 1 });
    await db.createStripeOrder({ order_id: 'MS-PAID01', tenant_id: t, plan_id: 'pro', amount_cents: 5000, currency: 'CAD', stripe_checkout_session_id: 'cs_test_FAKE_paid', status: 'paid', expires_at: now() - 1 });
    const r = await post({ id: eid('ce'), type: 'checkout.session.expired', data: { object: { id: 'cs_test_FAKE_exp1', object: 'checkout.session', metadata: { tenant_id: t, order_id: 'MS-EXPIR1' } } } });
    assert.equal(r.body.data.action, 'order_expired');
    assert.equal((await db.getStripeOrderById('MS-EXPIR1'))?.status, 'expired');
    const r2 = await post({ id: eid('ce2'), type: 'checkout.session.expired', data: { object: { id: 'cs_test_FAKE_paid', object: 'checkout.session', metadata: { tenant_id: t, order_id: 'MS-PAID01' } } } });
    assert.equal(r2.body.data.action, 'order_not_pending');
    assert.equal((await db.getStripeOrderById('MS-PAID01'))?.status, 'paid');
  });
});
