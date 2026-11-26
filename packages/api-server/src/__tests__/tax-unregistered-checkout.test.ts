/**
 * Audit item 7: while GST_HST_REGISTERED is not exactly 'true', checkout must
 * charge the plan price with 0% tax — no HST added, no Stripe tax params.
 * (CRA small-supplier: charging GST/HST while unregistered is non-compliant.)
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.STRIPE_SECRET_KEY = 'sk_test_FAKEFAKEFAKEFAKEFAKE';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_FAKEFAKEFAKEFAKEFAKE';

import { computeHst, isTaxRegistered, HST_RATE_ON } from '../tax-ledger.js';
import { stripeCheckoutHandler } from '../routes/billing-stripe.js';
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
  } as RouteContext;
}

/** Values that must NOT count as registered (only the literal 'true' does). */
const NOT_REGISTERED: Array<string | undefined> = [undefined, '', 'false', 'FALSE', '0', '1', 'yes', 'TRUE', 'True', ' true', 'true '];

const originalFetch = global.fetch;
let saved: string | undefined;
beforeEach(() => {
  saved = process.env.GST_HST_REGISTERED;
});
afterEach(() => {
  if (saved === undefined) delete process.env.GST_HST_REGISTERED;
  else process.env.GST_HST_REGISTERED = saved;
  global.fetch = originalFetch;
});

function setFlag(v: string | undefined) {
  if (v === undefined) delete process.env.GST_HST_REGISTERED;
  else process.env.GST_HST_REGISTERED = v;
}

describe('computeHst stays at 0% while GST_HST_REGISTERED is false', () => {
  for (const v of NOT_REGISTERED) {
    it(`GST_HST_REGISTERED=${JSON.stringify(v)} → unregistered, 0 tax on Pro and Business`, () => {
      setFlag(v);
      assert.equal(isTaxRegistered(), false);
      for (const cents of [5000, 20000]) {
        const r = computeHst(cents);
        assert.deepEqual([r.registered, r.taxCents, r.totalCents], [false, 0, cents]);
      }
    });
  }

  it('a rate override cannot add tax while unregistered', () => {
    setFlag('false');
    const r = computeHst(5000, { rate: 0.12 });
    assert.equal(r.taxCents, 0);
    assert.equal(r.totalCents, 5000);
  });

  it('only the literal "true" registers (control: the 13% path still exists, unchanged)', () => {
    setFlag('true');
    assert.equal(isTaxRegistered(), true);
    assert.equal(HST_RATE_ON, 0.13);
    assert.equal(computeHst(5000).taxCents, 650);
  });
});

describe('checkout charges exactly the plan price while unregistered', () => {
  for (const [planId, cents] of [['pro', 5000], ['business', 20000]] as const) {
    for (const v of [undefined, 'false']) {
      it(`${planId}, GST_HST_REGISTERED=${JSON.stringify(v)}: unit_amount ${cents}, no tax params, response tax 0`, async () => {
        setFlag(v);
        const tenantId = `tenant_tax0_${planId}_${String(v)}`;
        const ctx = ctxFor(tenantId);
        await db.updateTenantStripe(tenantId, { stripeCustomerId: `cus_FAKE_${planId}` });
        const bodies: string[] = [];
        global.fetch = (async (_url: unknown, init?: RequestInit) => {
          bodies.push(String(init?.body ?? ''));
          return new Response(
            JSON.stringify({ id: 'cs_test_FAKE', object: 'checkout.session', url: 'https://example/cs', customer: `cus_FAKE_${planId}`, status: 'open', expires_at: Math.floor(Date.now() / 1000) + 1800, metadata: {} }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }) as typeof fetch;
        const res = await stripeCheckoutHandler(
          new Request('http://localhost/v1/billing/stripe/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan_id: planId }),
          }),
          ctx,
          {},
        );
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.data.amount_cents, cents);
        assert.equal(body.data.amount_before_tax_cents, cents);
        assert.equal(body.data.tax.registered, false);
        assert.equal(body.data.tax.tax_cents, 0);

        const session = bodies.map((b) => new URLSearchParams(b)).find((p) => p.has('mode'));
        assert.ok(session, 'a Checkout Session was created');
        assert.equal(session!.get('line_items[0][price_data][unit_amount]'), String(cents));
        for (const key of session!.keys()) {
          assert.doesNotMatch(key, /automatic_tax|tax_rates|tax_behavior|tax_id_collection/, `no tax param (${key})`);
        }
      });
    }
  }
});
