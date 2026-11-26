/**
 * STRIPE_USE_LOOKUP_KEYS — catalog Price via lookup_key vs inline price_data.
 *
 * Mocked fetch only: NEVER hits the real Stripe API; fixtures are obvious fakes.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.STRIPE_SECRET_KEY = 'sk_test_FAKEFAKEFAKEFAKEFAKE';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_FAKEFAKEFAKEFAKEFAKE';

import { stripeCheckoutHandler, resolveLookupPrice } from '../routes/billing-stripe.js';
import { billingPlansHandler, stripePriceLookupForPlan, STRIPE_PRICE_LOOKUP_KEYS } from '../routes/billing.js';
import { useLookupKeys } from '../services/stripe.js';
import { MemoryStorage } from '../storage.js';
import type { RouteContext } from '../types.js';

const db = new MemoryStorage();
let n = 0;

function ctxFor(tenantId: string): RouteContext {
  if (!db.tenants.has(tenantId)) {
    db.registerTenant(
      { id: tenantId, name: 'Test', emailVerified: false, tier: 'free', isActive: true, journalismMode: false },
      `keyhash-${tenantId}-${n++}`,
      `key-${tenantId}`,
    );
  }
  return {
    tenant: { id: tenantId, name: 'Test', emailVerified: false, tier: 'free', isActive: true, journalismMode: false },
    apiKeyId: `key-${tenantId}`,
    requestId: 'req-test',
    startTime: Date.now(),
    env: {},
    db,
    cache: { get: async () => null, put: async () => {}, delete: async () => {} },
  };
}

type Call = { method: string; url: string; body: URLSearchParams };

function fakePrice(over: Record<string, unknown> = {}) {
  return {
    id: 'price_FAKE_pro_monthly',
    object: 'price',
    active: true,
    currency: 'cad',
    unit_amount: 5000,
    lookup_key: 'quill_pro_monthly',
    type: 'recurring',
    recurring: { interval: 'month', interval_count: 1 },
    ...over,
  };
}

function installFetch(calls: Call[], prices: unknown[]) {
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: new URLSearchParams(typeof init?.body === 'string' ? init.body : '') });
    const json = (o: unknown) =>
      new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (url.includes('/prices?')) return json({ object: 'list', data: prices });
    if (url.endsWith('/customers')) return json({ id: 'cus_test_FAKE_lookup', object: 'customer', metadata: {} });
    if (url.endsWith('/checkout/sessions')) {
      return json({
        id: `cs_test_FAKE_lookup_${calls.length}_${Date.now()}`,
        object: 'checkout.session',
        url: 'https://checkout.stripe.com/c/pay/cs_test_FAKE',
        customer: 'cus_test_FAKE_lookup',
        status: 'open',
        expires_at: Math.floor(Date.now() / 1000) + 1800,
        metadata: {},
      });
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;
}

async function checkout(planId: string, tenantId: string) {
  const req = new Request('http://localhost/v1/billing/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan_id: planId }),
  });
  return stripeCheckoutHandler(req, ctxFor(tenantId), {});
}

const sessionCall = (calls: Call[]) => calls.find((c) => c.url.endsWith('/checkout/sessions'));

describe('STRIPE_USE_LOOKUP_KEYS checkout', () => {
  let originalFetch: typeof global.fetch;
  let savedFlag: string | undefined;
  let savedTax: string | undefined;

  beforeEach(() => {
    originalFetch = global.fetch;
    savedFlag = process.env.STRIPE_USE_LOOKUP_KEYS;
    savedTax = process.env.GST_HST_REGISTERED;
    delete process.env.STRIPE_USE_LOOKUP_KEYS;
    delete process.env.GST_HST_REGISTERED;
  });
  afterEach(() => {
    global.fetch = originalFetch;
    if (savedFlag === undefined) delete process.env.STRIPE_USE_LOOKUP_KEYS;
    else process.env.STRIPE_USE_LOOKUP_KEYS = savedFlag;
    if (savedTax === undefined) delete process.env.GST_HST_REGISTERED;
    else process.env.GST_HST_REGISTERED = savedTax;
  });

  it('flag defaults OFF; only the literal "true" turns it on', () => {
    assert.equal(useLookupKeys(), false);
    for (const v of ['', '0', 'false', 'yes', '1']) {
      process.env.STRIPE_USE_LOOKUP_KEYS = v;
      assert.equal(useLookupKeys(), false, `value ${JSON.stringify(v)}`);
    }
    process.env.STRIPE_USE_LOOKUP_KEYS = 'true';
    assert.equal(useLookupKeys(), true);
  });

  it('flag off: inline price_data with the branded product name; prices never listed', async () => {
    const calls: Call[] = [];
    installFetch(calls, [fakePrice()]);
    const res = await checkout('pro', 'tenant_lookup_off');
    assert.equal(res.status, 200);
    assert.equal(calls.filter((c) => c.url.includes('/prices')).length, 0);
    const s = sessionCall(calls)!;
    assert.equal(s.body.get('line_items[0][price]'), null);
    assert.equal(s.body.get('line_items[0][price_data][currency]'), 'cad');
    assert.equal(s.body.get('line_items[0][price_data][unit_amount]'), '5000');
    assert.equal(s.body.get('line_items[0][price_data][product_data][name]'), 'Quill by Maplespike Pro');
  });

  it('flag off: Business inline product name is branded', async () => {
    const calls: Call[] = [];
    installFetch(calls, []);
    const res = await checkout('business', 'tenant_lookup_off_biz');
    assert.equal(res.status, 200);
    const s = sessionCall(calls)!;
    assert.equal(s.body.get('line_items[0][price_data][unit_amount]'), '20000');
    assert.equal(s.body.get('line_items[0][price_data][product_data][name]'), 'Quill by Maplespike Business');
  });

  it('flag on: uses the looked-up price id and sends no price_data', async () => {
    process.env.STRIPE_USE_LOOKUP_KEYS = 'true';
    const calls: Call[] = [];
    installFetch(calls, [fakePrice()]);
    const res = await checkout('pro', 'tenant_lookup_on');
    assert.equal(res.status, 200);
    const list = calls.find((c) => c.url.includes('/prices?'))!;
    assert.equal(list.method, 'GET');
    const q = new URL(list.url).searchParams;
    assert.deepEqual(q.getAll('lookup_keys[]'), ['quill_pro_monthly']);
    assert.equal(q.get('active'), 'true');
    const s = sessionCall(calls)!;
    assert.equal(s.body.get('line_items[0][price]'), 'price_FAKE_pro_monthly');
    for (const k of s.body.keys()) assert.ok(!k.includes('price_data'), `unexpected ${k}`);
  });

  it('flag on: Business looks up quill_business_monthly at 20000 CAD', async () => {
    process.env.STRIPE_USE_LOOKUP_KEYS = 'true';
    const calls: Call[] = [];
    installFetch(calls, [
      fakePrice({ id: 'price_FAKE_business_monthly', lookup_key: 'quill_business_monthly', unit_amount: 20000 }),
    ]);
    const res = await checkout('business', 'tenant_lookup_on_biz');
    assert.equal(res.status, 200);
    assert.equal(sessionCall(calls)!.body.get('line_items[0][price]'), 'price_FAKE_business_monthly');
  });

  const failClosed: Array<[string, unknown[]]> = [
    ['missing lookup key (no prices returned)', []],
    ['inactive price only', [fakePrice({ active: false })]],
    ['mismatched amount', [fakePrice({ unit_amount: 4999 })]],
    ['mismatched currency', [fakePrice({ currency: 'usd' })]],
    ['wrong interval', [fakePrice({ recurring: { interval: 'year', interval_count: 1 } })]],
    ['one-time price', [fakePrice({ recurring: null, type: 'one_time' })]],
    ['different lookup_key returned', [fakePrice({ lookup_key: 'quill_business_monthly' })]],
    ['ambiguous (two active prices)', [fakePrice(), fakePrice({ id: 'price_FAKE_dupe' })]],
  ];
  for (const [label, prices] of failClosed) {
    it(`flag on: fails closed on ${label} — 503, no session, no inline fallback`, async () => {
      process.env.STRIPE_USE_LOOKUP_KEYS = 'true';
      const calls: Call[] = [];
      installFetch(calls, prices);
      const res = await checkout('pro', `tenant_lookup_fail_${label.replace(/\W+/g, '_')}`);
      assert.equal(res.status, 503);
      const body = await res.json();
      assert.equal(body.error.code, 'PRICE_UNAVAILABLE');
      assert.equal(sessionCall(calls), undefined, 'no checkout session may be created');
    });
  }

  it('flag on + GST_HST_REGISTERED=true: fails closed (fixed price cannot carry manual HST)', async () => {
    process.env.STRIPE_USE_LOOKUP_KEYS = 'true';
    process.env.GST_HST_REGISTERED = 'true';
    const calls: Call[] = [];
    installFetch(calls, [fakePrice()]);
    const res = await checkout('pro', 'tenant_lookup_taxed');
    assert.equal(res.status, 503);
    assert.equal(sessionCall(calls), undefined);
  });
});

describe('plan → lookup_key contract (billing.ts)', () => {
  it('maps pro/business to the agreed lookup keys and backend amounts', () => {
    assert.deepEqual({ ...STRIPE_PRICE_LOOKUP_KEYS }, { pro: 'quill_pro_monthly', business: 'quill_business_monthly' });
    assert.deepEqual(stripePriceLookupForPlan('pro'), {
      plan_id: 'pro', lookup_key: 'quill_pro_monthly', amount_cents: 5000, currency: 'cad', interval: 'month', interval_count: 1,
    });
    assert.deepEqual(stripePriceLookupForPlan('business'), {
      plan_id: 'business', lookup_key: 'quill_business_monthly', amount_cents: 20000, currency: 'cad', interval: 'month', interval_count: 1,
    });
    for (const p of ['free', 'community', 'enterprise', 'bogus']) assert.equal(stripePriceLookupForPlan(p), null);
  });

  it('no price_... ids are hardcoded in the lookup contract', () => {
    assert.ok(!JSON.stringify(STRIPE_PRICE_LOOKUP_KEYS).includes('price_'));
  });

  it('resolveLookupPrice refuses when the checkout amount drifts from billing.ts', async () => {
    const r = await resolveLookupPrice('pro', 4000);
    assert.deepEqual(r, { ok: false, reason: 'plan_catalog_drift' });
  });

  it('plan display names carry no legacy "MapleSpike" casing', async () => {
    const res = await billingPlansHandler(new Request('http://localhost/v1/billing/plans'), ctxFor('tenant_plans_names'), {});
    const body = await res.json();
    const names = body.data.plans.map((p: { name: string }) => p.name);
    assert.deepEqual(names, ['Community', 'Free', 'Pro', 'Business', 'Enterprise']);
    assert.ok(!JSON.stringify(body.data.plans).includes('MapleSpike'));
  });
});
