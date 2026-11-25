/**
 * Billing operator cron surface:
 *  - operator routes are reachable with X-Billing-Secret alone (the k8s
 *    CronJobs carry no API key) — but only with the correct, non-empty secret;
 *  - GET /v1/billing/reconcile-subscriptions: read-only Stripe ↔ tenant drift.
 * Mocked fetch only; fake keys.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.STRIPE_SECRET_KEY = 'sk_test_FAKEFAKEFAKEFAKEFAKE';
const SECRET = 'FAKE'.repeat(8); // obvious fake billing secret
process.env.QUILL_BILLING_SECRET = SECRET;

import { handleRequest, operatorSecretPresented } from '../index.js';
import { subscriptionReconcileHandler } from '../routes/billing-stripe.js';
import { MemoryCache, MemoryStorage } from '../storage.js';
import type { RouteContext } from '../types.js';

const env = {
  // Obvious fake, not a credential: only has to differ from the default.
  JWT_SECRET: 'FAKE'.repeat(12),
  ENVIRONMENT: 'development',
  QUILL_BILLING_SECRET: SECRET,
};

describe('operator routes reachable with the billing secret only', () => {
  it('operatorSecretPresented: correct secret on operator routes only', () => {
    const req = (h: Record<string, string>) => new Request('http://x/', { headers: h });
    assert.equal(operatorSecretPresented('/v1/billing/reconcile-expiry', req({ 'X-Billing-Secret': SECRET }), env), true);
    assert.equal(operatorSecretPresented('/v1/billing/tax/status', req({ 'X-Billing-Secret': SECRET }), env), true);
    assert.equal(operatorSecretPresented('/v1/billing/reconcile-subscriptions', req({ 'X-Billing-Secret': SECRET }), env), true);
    assert.equal(operatorSecretPresented('/v1/billing/reconcile-expiry', req({ 'X-Billing-Secret': 'wrong' }), env), false);
    assert.equal(operatorSecretPresented('/v1/billing/reconcile-expiry', req({}), env), false);
    assert.equal(operatorSecretPresented('/v1/billing/stripe/checkout', req({ 'X-Billing-Secret': SECRET }), env), false);
    assert.equal(operatorSecretPresented('/v1/gov/search', req({ 'X-Billing-Secret': SECRET }), env), false);
  });

  it('an empty configured secret never opens the bypass', () => {
    const saved = process.env.QUILL_BILLING_SECRET;
    process.env.QUILL_BILLING_SECRET = '';
    try {
      const r = new Request('http://x/', { headers: { 'X-Billing-Secret': '' } });
      assert.equal(operatorSecretPresented('/v1/billing/reconcile-expiry', r, { QUILL_BILLING_SECRET: '' }), false);
    } finally {
      process.env.QUILL_BILLING_SECRET = saved;
    }
  });

  it('POST /v1/billing/reconcile-expiry: 200 with the secret and no API key; 401 without', async () => {
    const db = new MemoryStorage();
    const cache = new MemoryCache();
    const ok = await handleRequest(
      new Request('http://localhost/v1/billing/reconcile-expiry', { method: 'POST', headers: { 'X-Billing-Secret': SECRET } }),
      env, db, cache,
    );
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.equal(body.data.processed, 0);
    const wrong = await handleRequest(
      new Request('http://localhost/v1/billing/reconcile-expiry', { method: 'POST', headers: { 'X-Billing-Secret': 'nope' } }),
      env, db, cache,
    );
    assert.equal(wrong.status, 401);
    const none = await handleRequest(new Request('http://localhost/v1/billing/reconcile-expiry', { method: 'POST' }), env, db, cache);
    assert.equal(none.status, 401);
  });

  it('GET /v1/billing/tax/status: 200 with the secret and no API key', async () => {
    const res = await handleRequest(
      new Request('http://localhost/v1/billing/tax/status', { headers: { 'X-Billing-Secret': SECRET } }),
      env, new MemoryStorage(), new MemoryCache(),
    );
    assert.equal(res.status, 200);
  });
});

describe('GET /v1/billing/reconcile-subscriptions (read-only drift)', () => {
  let originalFetch: typeof global.fetch;
  let calls: Array<{ method: string; url: string }>;
  let errLines: string[];
  let origErr: typeof console.error;
  beforeEach(() => {
    originalFetch = global.fetch;
    calls = [];
    errLines = [];
    origErr = console.error;
    console.error = (...a: unknown[]) => { errLines.push(a.map(String).join(' ')); };
  });
  afterEach(() => {
    global.fetch = originalFetch;
    console.error = origErr;
  });

  function stripeSubs(pages: Array<Array<Record<string, unknown>>>) {
    let page = 0;
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ method: init?.method ?? 'GET', url: String(input) });
      const data = pages[page] ?? [];
      const has_more = page < pages.length - 1;
      page++;
      return new Response(JSON.stringify({ object: 'list', data, has_more }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
  }

  function ctxWith(db: MemoryStorage): RouteContext {
    return {
      tenant: { id: 'anon', name: 'Anonymous', emailVerified: false, tier: 'free', isActive: true, journalismMode: false },
      apiKeyId: '', requestId: 'req', startTime: Date.now(), env: {}, db,
      cache: { get: async () => null, put: async () => {}, delete: async () => {} },
    };
  }
  function tenant(db: MemoryStorage, id: string) {
    db.registerTenant({ id, name: 'T', emailVerified: false, tier: 'free', isActive: true, journalismMode: false }, `kh-${id}`, `k-${id}`);
  }
  const sub = (id: string, tenantId: string | null, customer: string, plan: string, end: number, status = 'active') => ({
    id, object: 'subscription', status, customer,
    metadata: tenantId ? { tenant_id: tenantId, plan_id: plan } : {},
    items: { data: [{ current_period_end: end }] },
  });
  const call = (db: MemoryStorage, secret = SECRET) =>
    subscriptionReconcileHandler(
      new Request('http://localhost/v1/billing/reconcile-subscriptions', { headers: { 'X-Billing-Secret': secret } }),
      ctxWith(db), {},
    );

  it('403 without the secret; never touches Stripe', async () => {
    stripeSubs([[]]);
    const res = await call(new MemoryStorage(), 'wrong');
    assert.equal(res.status, 403);
    assert.equal(calls.length, 0);
  });

  it('clean state: drift_count 0, only GETs, no alert', async () => {
    const db = new MemoryStorage();
    const end = Math.floor(Date.now() / 1000) + 20 * 86400;
    tenant(db, 't_ok');
    await db.updateTenantStripe('t_ok', { tier: 'pro', stripeCustomerId: 'cus_FAKE_ok', stripeCurrentPeriodEnd: end });
    stripeSubs([[sub('sub_FAKE_ok', 't_ok', 'cus_FAKE_ok', 'pro', end), sub('sub_FAKE_old', 't_ok', 'cus_FAKE_ok', 'pro', end - 90 * 86400, 'canceled')]]);
    const res = await call(db);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.drift_count, 0);
    assert.equal(body.data.truncated, false);
    assert.ok(calls.every((c) => c.method === 'GET'));
    assert.ok(calls[0].url.includes('/subscriptions?') && calls[0].url.includes('status=all'));
    assert.equal(errLines.length, 0);
  });

  it('reports every drift kind and alerts; makes no writes', async () => {
    const db = new MemoryStorage();
    const now = Math.floor(Date.now() / 1000);
    for (const id of ['t_free', 't_cust', 't_tier', 't_end', 't_orphan']) tenant(db, id);
    await db.updateTenantStripe('t_cust', { tier: 'pro', stripeCustomerId: 'cus_FAKE_mine', stripeCurrentPeriodEnd: now + 86400 });
    await db.updateTenantStripe('t_free', { stripeCustomerId: 'cus_FAKE_free' });
    await db.updateTenantStripe('t_tier', { tier: 'pro', stripeCustomerId: 'cus_FAKE_tier', stripeCurrentPeriodEnd: now + 86400 });
    await db.updateTenantStripe('t_end', { tier: 'business', stripeCustomerId: 'cus_FAKE_end', stripeCurrentPeriodEnd: now + 86400 });
    await db.updateTenantStripe('t_orphan', { tier: 'pro', stripeCustomerId: 'cus_FAKE_orphan', stripeCurrentPeriodEnd: now + 86400 });
    const before = JSON.stringify([...db.tenants.entries()]);
    // two pages to exercise pagination
    stripeSubs([
      [sub('sub_FAKE_1', null, 'cus_FAKE_x', 'pro', now), sub('sub_FAKE_2', 't_cust', 'cus_FAKE_other', 'pro', now + 86400)],
      [sub('sub_FAKE_3', 't_free', 'cus_FAKE_free', 'pro', now + 86400), sub('sub_FAKE_4', 't_tier', 'cus_FAKE_tier', 'business', now + 86400), sub('sub_FAKE_5', 't_end', 'cus_FAKE_end', 'business', now + 40 * 86400)],
    ]);
    const res = await call(db);
    const body = await res.json();
    const kinds = body.data.drift.map((d: { kind: string }) => d.kind).sort();
    assert.deepEqual(kinds, [
      'customer_mismatch',
      'period_end_mismatch',
      'stripe_paying_tenant_not_paid',
      'stripe_sub_without_tenant',
      'tenant_paid_without_stripe_sub',
      'tier_mismatch',
    ]);
    assert.equal(body.data.checked_subscriptions, 5);
    assert.equal(calls.length, 2);
    assert.ok(calls[1].url.includes('starting_after=sub_FAKE_2'));
    assert.ok(errLines.some((l) => l.includes('[BILLING-ALERT][subscription_drift]')));
    assert.equal(JSON.stringify([...db.tenants.entries()]), before, 'read-only: tenants unchanged');
  });
});
