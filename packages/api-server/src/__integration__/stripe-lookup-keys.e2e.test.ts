/**
 * Staging e2e: Checkout Session creation with STRIPE_USE_LOOKUP_KEYS=true
 * against Stripe TEST mode.
 *
 * Runs ONLY when STRIPE_TEST_SECRET_KEY holds an `sk_test_` key. Skips cleanly
 * when it's unset. A live-mode key (sk_live_/rk_live_) in it, or in
 * STRIPE_SECRET_KEY, is refused: the suite fails before any network call. The
 * key is never logged, printed or put in an assertion message.
 *
 * Side effects (test mode only): creates one customer per run and one
 * Checkout Session per plan, then expires the sessions and deletes the customer.
 *
 * Env (see docs/billing-stripe-lookup-keys.md):
 *   STRIPE_TEST_SECRET_KEY            required, sk_test_…
 *   STRIPE_E2E_PRO_PRICE_ID           optional, pin the expected test price id
 *   STRIPE_E2E_BUSINESS_PRICE_ID      optional, pin the expected test price id
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

const KEY = (process.env.STRIPE_TEST_SECRET_KEY ?? '').trim();
const LIVE_RE = /^(sk|rk)_live_/;

const skipReason = KEY ? false : 'STRIPE_TEST_SECRET_KEY not set — Stripe test-mode e2e skipped';

import * as stripe from '../services/stripe.js';
import { stripeCheckoutHandler } from '../routes/billing-stripe.js';
import { stripePriceLookupForPlan } from '../routes/billing.js';
import { MemoryStorage } from '../storage.js';
import type { RouteContext } from '../types.js';

const API = 'https://api.stripe.com/v1';

async function stripeTest<T>(method: 'GET' | 'POST' | 'DELETE', path: string): Promise<T> {
  // Direct read/cleanup calls for assertions. Same test key; never logged.
  const r = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${KEY}` } });
  assert.ok(r.ok, `Stripe test-mode ${method} ${path.split('?')[0]} → ${r.status}`);
  return (await r.json()) as T;
}

describe('Stripe TEST-mode e2e: lookup_key checkout', { skip: skipReason || undefined }, () => {
  const saved: Record<string, string | undefined> = {};
  const db = new MemoryStorage();
  const sessions: string[] = [];
  let customerId: string | undefined;

  before(() => {
    // Refuse anything but a test-mode secret key, before any network call.
    if (LIVE_RE.test(KEY) || !KEY.startsWith('sk_test_')) {
      throw new Error('STRIPE_TEST_SECRET_KEY must be an sk_test_ key; refusing to run (live keys are never used)');
    }
    if (LIVE_RE.test((process.env.STRIPE_SECRET_KEY ?? '').trim())) {
      throw new Error('STRIPE_SECRET_KEY holds a live key in this environment; refusing to run the e2e');
    }
    for (const k of ['STRIPE_SECRET_KEY', 'STRIPE_USE_LOOKUP_KEYS', 'STRIPE_ENV', 'GST_HST_REGISTERED']) saved[k] = process.env[k];
    process.env.STRIPE_SECRET_KEY = KEY;
    process.env.STRIPE_USE_LOOKUP_KEYS = 'true';
    process.env.STRIPE_ENV = 'test';
    delete process.env.GST_HST_REGISTERED;
  });

  after(async () => {
    try {
      for (const id of sessions) await stripeTest('POST', `/checkout/sessions/${id}/expire`).catch(() => {});
      if (customerId) await stripeTest('DELETE', `/customers/${customerId}`).catch(() => {});
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });

  for (const plan of ['pro', 'business'] as const) {
    it(`${plan}: catalog price matches the plan (cad, monthly, ${plan === 'pro' ? 5000 : 20000}, exclusive, test mode)`, async () => {
      const lookup = stripePriceLookupForPlan(plan)!;
      const prices = await stripe.listPricesByLookupKeys([lookup.lookup_key]);
      const active = prices.filter((p) => p.active && p.lookup_key === lookup.lookup_key);
      assert.equal(active.length, 1, `exactly one active price for ${lookup.lookup_key}`);
      const p = active[0] as stripe.StripePrice & { livemode?: boolean; tax_behavior?: string };
      assert.equal(p.livemode, false);
      assert.equal(p.currency, 'cad');
      assert.equal(p.recurring?.interval, 'month');
      assert.equal(p.recurring?.interval_count, 1);
      assert.equal(p.unit_amount, plan === 'pro' ? 5000 : 20000);
      assert.equal(p.tax_behavior, 'exclusive');
      const pinned = plan === 'pro' ? process.env.STRIPE_E2E_PRO_PRICE_ID : process.env.STRIPE_E2E_BUSINESS_PRICE_ID;
      if (pinned) assert.equal(p.id, pinned);
    });

    it(`${plan}: checkout session uses the looked-up price (no inline price_data)`, async () => {
      const tenantId = `e2e_lookup_${plan}`;
      if (!db.tenants.has(tenantId)) {
        db.registerTenant(
          { id: tenantId, name: 'E2E', emailVerified: false, tier: 'free', isActive: true, journalismMode: false },
          `keyhash-${tenantId}`,
          `key-${tenantId}`,
        );
      }
      if (customerId) await db.updateTenantStripe(tenantId, { stripeCustomerId: customerId });
      const ctx: RouteContext = {
        tenant: { id: tenantId, name: 'E2E', emailVerified: false, tier: 'free', isActive: true, journalismMode: false },
        apiKeyId: `key-${tenantId}`,
        requestId: 'req-e2e',
        startTime: Date.now(),
        env: {},
        db,
        cache: { get: async () => null, put: async () => {}, delete: async () => {} },
      };
      const res = await stripeCheckoutHandler(
        new Request('http://localhost/v1/billing/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan_id: plan }),
        }),
        ctx,
        {},
      );
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: { stripe_checkout_session_id: string } };
      const sessionId = body.data.stripe_checkout_session_id;
      assert.match(sessionId, /^cs_test_/);
      sessions.push(sessionId);
      customerId = customerId ?? (await db.getTenantStripeCustomerId(tenantId)) ?? undefined;

      const lookup = stripePriceLookupForPlan(plan)!;
      const [expected] = (await stripe.listPricesByLookupKeys([lookup.lookup_key])).filter((p) => p.active);
      const items = await stripeTest<{ data: Array<{ price: { id: string; lookup_key: string | null } }> }>(
        'GET',
        `/checkout/sessions/${sessionId}/line_items?limit=5`,
      );
      assert.equal(items.data.length, 1);
      assert.equal(items.data[0].price.id, expected.id);
      assert.equal(items.data[0].price.lookup_key, lookup.lookup_key);
    });
  }
});
