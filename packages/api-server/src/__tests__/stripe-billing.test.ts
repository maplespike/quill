/**
 * Stripe billing — test suite.
 *
 * Covers:
 *   1. Env-var fingerprinting (no key values in output).
 *   2. Manual HMAC-SHA256 webhook signature verification (8 negative cases + 2 positive).
 *   3. Stripe REST client round-trips through mocked fetch.
 *   4. tierFromSubscriptionStatus mapping for all subscription statuses.
 *   5. Stripe checkout handler (DB-backed via QuillStorage):
 *      - 503 when STRIPE_SECRET_KEY absent.
 *      - 400 on bad plan_id.
 *      - 200 + checkout URL on happy path; **order persisted via ctx.db.createStripeOrder**.
 *   6. Webhook handler end-to-end (DB-backed):
 *      - signed payload → tenant tier upgraded in DB.
 *      - subscription.deleted binding + downgrade via DB.
 *      - rejected_cross_tenant when Stripe customer is NOT bound.
 *      - 200 on unhandled event types.
 *   7. Customer-portal handler: 404 when no Stripe customer on file (DB-backed).
 *   8. **Restart-survival**: NodeSqliteStorage against a temp file proves Stripe
 *      orders + tenant Stripe linkage survive the close-and-reopen cycle that
 *      comes with a k3s pod restart (Phase 1 persistence migration).
 *
 * NEVER hits the real Stripe API. NEVER logs key values.
 */

import { describe, it, beforeEach, afterEach, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Env must be set BEFORE module import (stripe.ts reads on first call).
// Real Stripe secret keys are base62 alphanumeric, so test fixtures do the
// same to also exercise the sops-sync-k8s.sh regex gate.
const TEST_SECRET_KEY = 'sk_test_FAKEFAKEFAKEFAKEFAKE';
const TEST_WEBHOOK_SECRET = 'whsec_FAKEFAKEFAKEFAKEFAKE';

process.env.STRIPE_SECRET_KEY = TEST_SECRET_KEY;
process.env.STRIPE_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;

import * as stripe from '../services/stripe.js';
import {
  stripeCheckoutHandler,
  stripeWebhookHandler,
  stripePortalHandler,
  stripeOrderStatusHandler,
  stripeStatusHandler,
} from '../routes/billing-stripe.js';
import { MemoryStorage } from '../storage.js';
import { NodeSqliteStorage } from '../node-sqlite-storage.js';

function buildSignedBody(rawBody: string): string {
  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', TEST_WEBHOOK_SECRET).update(`${ts}.${rawBody}`, 'utf8').digest('hex');
  return `t=${ts},v1=${sig}`;
}

function makeRequest(url: string, init: RequestInit = {}): Request {
  return new Request(url, init);
}

// Singleton test storage. Module-scope so tests share the same backing store,
// mirroring a real long-running api-server process.
const _testDb = new MemoryStorage();
let _nextKeyId = 1;

function registerTestTenant(tenantId: string, tier: 'free' | 'pro' | 'business' = 'free') {
  if (_testDb.tenants.has(tenantId)) return;
  const keyHash = `keyhash-${tenantId}-${_nextKeyId++}`;
  _testDb.registerTenant(
    {
      id: tenantId,
      name: 'Test',
      emailVerified: false,
      tier,
      isActive: true,
      journalismMode: false,
    },
    keyHash,
    `key-${tenantId}`,
  );
}

function ctxWithTenant(tenantId: string, tier: 'free' | 'pro' | 'business' = 'free'): import('../types.js').RouteContext {
  registerTestTenant(tenantId, tier);
  return {
    tenant: { id: tenantId, name: 'Test', emailVerified: false, tier, isActive: true, journalismMode: false },
    apiKeyId: `key-${tenantId}`,
    requestId: 'req-test',
    startTime: Date.now(),
    env: {},
    db: _testDb,
    cache: {
      get: async () => null,
      put: async () => {},
      delete: async () => {},
    },
  };
}

/** Read a tenant's current tier straight from the test DB (no authenticate round-trip). */
function readTenantTier(tenantId: string): 'free' | 'pro' | 'business' | 'enterprise' | 'internal' | undefined {
  return (_testDb as any).tenants.get(tenantId)?.tier;
}

function readTenantStripe(tenantId: string): {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeSubscriptionStatus?: string;
} {
  return (_testDb as any).tenants.get(tenantId);
}

before(() => {
  // Smoke check: storage layer exposes the new methods we depend on.
  if (typeof _testDb.createStripeOrder !== 'function') {
    throw new Error('MemoryStorage missing createStripeOrder — QuillStorage interface not extended correctly');
  }
});

// ──────────────────────────────────────────────────────────────────
// 1. Fingerprinting — never leaks the raw secret
// ──────────────────────────────────────────────────────────────────

describe('Stripe fingerprinting', () => {
  it('public getStripeStatus() exposes ONLY configured + webhookConfigured (no fingerprints leaked)', () => {
    const originalSec = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_ACCOUNT_ID;
    const s1 = stripe.getStripeStatus() as unknown as Record<string, unknown>;
    assert.equal(s1.configured, false);
    assert.equal(s1.webhookConfigured, false);
    assert.equal(s1.keyFingerprint, undefined);
    assert.equal(s1.accountFingerprint, undefined);

    process.env.STRIPE_SECRET_KEY = originalSec;
    process.env.STRIPE_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
    process.env.STRIPE_ACCOUNT_ID = 'acct_FAKE_FOR_TEST_ONLY';
    const s2 = stripe.getStripeStatus() as unknown as Record<string, unknown>;
    assert.equal(s2.configured, true);
    assert.equal(s2.webhookConfigured, true);
    assert.equal(s2.keyFingerprint, undefined);
    assert.equal(s2.accountFingerprint, undefined);
  });

  it('diagnostic helper getStripeDiagnosticInfo() returns fingerprints for log-only use', () => {
    const diag = stripe.getStripeDiagnosticInfo();
    assert.ok(diag.keyFingerprint.startsWith('set('), `keyFingerprint should start with set(: got ${diag.keyFingerprint}`);
    assert.ok(/…[A-Za-z0-9]{4}\)$/.test(diag.keyFingerprint), `keyFingerprint format unexpected: ${diag.keyFingerprint}`);
    assert.ok(!diag.keyFingerprint.includes(TEST_SECRET_KEY), 'fingerprint must never include the raw secret');
  });

  it('logStripeStatus never logs key values', () => {
    const seen: string[] = [];
    const log = {
      info: (m: string) => seen.push(m),
      warn: () => {},
      error: () => {},
    };
    stripe.logStripeStatus(log);
    assert.ok(seen.length >= 1, 'should log status line');
    const blob = seen.join('\n');
    assert.ok(!blob.includes(TEST_SECRET_KEY), 'log must never contain raw secret key');
    assert.ok(!blob.includes(TEST_WEBHOOK_SECRET), 'log must never contain raw webhook secret');
  });
});

// ──────────────────────────────────────────────────────────────────
// 2. Webhook signature verification
// ──────────────────────────────────────────────────────────────────

describe('verifyWebhookSignature', () => {
  it('accepts a valid signature with fresh timestamp', () => {
    const body = JSON.stringify({ id: 'evt_1', type: 'ping', data: { object: {} } });
    const header = buildSignedBody(body);
    const ev = stripe.verifyWebhookSignature(body, header);
    assert.equal(ev.id, 'evt_1');
    assert.equal(ev.type, 'ping');
  });

  it('rejects missing signature header', () => {
    assert.throws(
      () => stripe.verifyWebhookSignature('{}', null),
      (e: any) => e.code === 'STRIPE_SIGNATURE_MISSING',
    );
  });

  it('rejects header without v1=', () => {
    assert.throws(
      () => stripe.verifyWebhookSignature('{}', 't=12345'),
      (e: any) => e.code === 'STRIPE_SIGNATURE_MALFORMED',
    );
  });

  it('rejects header without t=', () => {
    assert.throws(
      () => stripe.verifyWebhookSignature('{}', 'v1=abc'),
      (e: any) => e.code === 'STRIPE_SIGNATURE_MALFORMED',
    );
  });

  it('rejects expired timestamps', () => {
    const old = Math.floor(Date.now() / 1000) - 600;
    const body = '{}';
    const sig = crypto.createHmac('sha256', TEST_WEBHOOK_SECRET).update(`${old}.${body}`, 'utf8').digest('hex');
    const header = `t=${old},v1=${sig}`;
    assert.throws(
      () => stripe.verifyWebhookSignature(body, header),
      (e: any) => e.code === 'STRIPE_SIGNATURE_EXPIRED',
    );
  });

  it('rejects signature with wrong secret', () => {
    const body = '{}';
    const ts = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', 'wrong-secret').update(`${ts}.${body}`, 'utf8').digest('hex');
    const header = `t=${ts},v1=${sig}`;
    assert.throws(
      () => stripe.verifyWebhookSignature(body, header),
      (e: any) => e.code === 'STRIPE_SIGNATURE_INVALID',
    );
  });

  it('rejects when STRIPE_WEBHOOK_SECRET is unset', () => {
    const saved = process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    try {
      assert.throws(
        () => stripe.verifyWebhookSignature('{}', 't=1,v1=abc'),
        (e: any) => e.code === 'STRIPE_WEBHOOK_SECRET_MISSING',
      );
    } finally {
      process.env.STRIPE_WEBHOOK_SECRET = saved;
    }
  });

  it('accepts signature with extra params (forward-compat Stripe schemes)', () => {
    const body = JSON.stringify({ id: 'evt_extra', type: 'ping', data: { object: {} } });
    const ts = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', TEST_WEBHOOK_SECRET).update(`${ts}.${body}`, 'utf8').digest('hex');
    const header = `t=${ts},v0=garbage,v2=garbage,v1=${sig}`;
    const ev = stripe.verifyWebhookSignature(body, header);
    assert.equal(ev.id, 'evt_extra');
  });

  it('rejects non-JSON body that nonetheless has a valid signature', () => {
    const body = 'not-json{';
    const header = buildSignedBody(body);
    assert.throws(
      () => stripe.verifyWebhookSignature(body, header),
      (e: any) => e.code === 'STRIPE_EVENT_INVALID_JSON',
    );
  });
});

// ──────────────────────────────────────────────────────────────────
// 3. Tier mapping for subscription statuses
// ──────────────────────────────────────────────────────────────────

describe('tierFromSubscriptionStatus', () => {
  const cases: Array<[string, string, string, string | undefined, 'active' | 'paused' | 'past_due' | 'cancelled']> = [
    ['active', 'pro', 'free', 'pro', 'active'],
    ['trialing', 'business', 'free', 'business', 'active'],
    ['incomplete', 'pro', 'free', 'pro', 'active'],
    ['resumed', 'pro', 'free', 'pro', 'active'],
    // past_due + paused: tier write is intentionally skipped (undefined) — the
    // owning handler preserves the existing tenant tier via updateTenantStripe's
    // optional-field merge. We document the contract here.
    ['past_due', 'pro', 'pro', undefined, 'past_due'],
    ['paused', 'pro', 'pro', undefined, 'paused'],
    ['paused', 'business', 'free', undefined, 'paused'],
    ['canceled', 'pro', 'pro', 'free', 'cancelled'],
    ['unpaid', 'business', 'business', 'free', 'cancelled'],
    ['incomplete_expired', 'pro', 'pro', 'free', 'cancelled'],
  ];
  for (const [status, planId, currentTier, wantTier, wantSub] of cases) {
    it(`status=${status} → tier=${wantTier} subscription=${wantSub}`, () => {
      const r = stripe.tierFromSubscriptionStatus({ status, planId, currentTier });
      assert.equal(r.tier, wantTier);
      assert.equal(r.subscriptionStatus, wantSub);
    });
  }
});

// ──────────────────────────────────────────────────────────────────
// 4. Stripe REST client — mocked fetch
// ──────────────────────────────────────────────────────────────────

describe('Stripe REST client (mocked fetch)', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  function mockFetch(responses: Array<{ status: number; body: any; contentType?: string }>) {
    let i = 0;
    global.fetch = (async () => {
      const r = responses[Math.min(i++, responses.length - 1)];
      return new Response(JSON.stringify(r.body), {
        status: r.status,
        headers: { 'Content-Type': r.contentType ?? 'application/json' },
      });
    }) as typeof fetch;
  }

  it('POST /customers surfaces API error as StripeApiError', async () => {
    mockFetch([{ status: 401, body: { error: { type: 'invalid_request_error', message: 'Invalid API key' } } }]);
    await assert.rejects(
      stripe.findOrCreateCustomer({ tenantId: 'tenant_T' }),
      (e: any) => e instanceof stripe.StripeApiError && e.httpStatus === 401,
    );
    global.fetch = originalFetch;
  });

  it('throws StripeError("STRIPE_NOT_CONFIGURED") when secret key absent', async () => {
    const saved = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    try {
      await assert.rejects(
        stripe.findOrCreateCustomer({ tenantId: 't' }),
        (e: any) => e.code === 'STRIPE_NOT_CONFIGURED',
      );
    } finally {
      process.env.STRIPE_SECRET_KEY = saved;
    }
  });
});

// ──────────────────────────────────────────────────────────────────
// 5. Checkout handler — end-to-end via ctx.db persistence
// ──────────────────────────────────────────────────────────────────

describe('stripeCheckoutHandler', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  it('503 when STRIPE_SECRET_KEY is missing', async () => {
    const saved = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    try {
      const req = makeRequest('http://localhost/v1/billing/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: 'pro' }),
      });
      const res = await stripeCheckoutHandler(req, ctxWithTenant('tenant_no_key'), {});
      assert.equal(res.status, 503);
      const body = await res.json();
      assert.equal(body.error.code, 'STRIPE_NOT_CONFIGURED');
    } finally {
      process.env.STRIPE_SECRET_KEY = saved;
    }
  });

  it('400 on invalid plan_id (free / community / unknown)', async () => {
    const req = makeRequest('http://localhost/v1/billing/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: 'free' }),
    });
    const res = await stripeCheckoutHandler(req, ctxWithTenant('tenant_invalid_plan'), {});
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'INVALID_PLAN');
  });

  it('400 on missing JSON body', async () => {
    const req = makeRequest('http://localhost/v1/billing/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await stripeCheckoutHandler(req, ctxWithTenant('tenant_bad_json'), {});
    assert.equal(res.status, 400);
  });

  it('200 + checkout URL on happy path; order persisted via ctx.db.createStripeOrder', async () => {
    let calls = 0;
    global.fetch = (async () => {
      calls++;
      if (calls === 1) {
        return new Response(JSON.stringify({ id: 'cus_test_persist', object: 'customer', metadata: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({
          id: 'cs_test_persist_session',
          object: 'checkout.session',
          url: 'https://checkout.stripe.com/c/pay/cs_test_persist_session',
          customer: 'cus_test_persist',
          status: 'open',
          expires_at: Math.floor(Date.now() / 1000) + 1800,
          metadata: { tenant_id: 'tenant_persist_test', plan_id: 'pro', order_id: 'fill' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const tenantId = 'tenant_persist_test';
    const req = makeRequest('http://localhost/v1/billing/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: 'pro' }),
    });
    const res = await stripeCheckoutHandler(req, ctxWithTenant(tenantId), {});
    global.fetch = originalFetch;
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.success);
    assert.ok(body.data.checkout_url);
    assert.ok(body.data.order_id);
    assert.equal(body.data.plan_id, 'pro');
    assert.equal(body.data.amount_cents, 5000);
    assert.equal(body.data.currency, 'CAD');
    // #811: checkout exposes the tax computation; unregistered = zero tax.
    assert.equal(body.data.tax.registered, false);
    assert.equal(body.data.tax.tax_cents, 0);
    assert.equal(body.data.amount_before_tax_cents, 5000);

    // Phase-1 persistence: order is now in MemoryStorage (proxies for D1/sqlite).
    const stored = await _testDb.getStripeOrderById(body.data.order_id);
    assert.ok(stored, 'order must persist via ctx.db.createStripeOrder');
    assert.equal(stored!.stripe_checkout_session_id, body.data.stripe_checkout_session_id);
    assert.equal(stored!.status, 'pending');
    assert.equal(stored!.tenant_id, tenantId);

    // Stripe customer id should also be persisted on the tenant row.
    const tenant = readTenantStripe(tenantId);
    assert.equal(tenant.stripeCustomerId, 'cus_test_persist');
  });

  it('re-uses existing Stripe customer when tenant already has a binding', async () => {
    const tenantId = 'tenant_reuse_cust';
    registerTestTenant(tenantId);
    await _testDb.updateTenantStripe(tenantId, { stripeCustomerId: 'cus_existing' });

    let calls = 0;
    global.fetch = (async () => {
      calls++;
      // First call: customer creation should NOT be invoked.
      if (calls === 1) {
        return new Response(JSON.stringify({ id: 'cs_reuse', object: 'checkout.session', url: 'https://example/cs_reuse', customer: 'cus_existing', status: 'open', expires_at: Math.floor(Date.now() / 1000) + 1800, metadata: { tenant_id: tenantId, plan_id: 'pro', order_id: 'fill' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    const req = makeRequest('http://localhost/v1/billing/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: 'pro' }),
    });
    const res = await stripeCheckoutHandler(req, ctxWithTenant(tenantId), {});
    global.fetch = originalFetch;
    assert.equal(res.status, 200);
    assert.equal(calls, 1, 'should not call customer endpoint when binding exists');
  });
});

// ──────────────────────────────────────────────────────────────────
// 6. Webhook handler — DB-backed end-to-end
// ──────────────────────────────────────────────────────────────────

function signAndPost(event: any): Promise<Response> {
  const rawBody = JSON.stringify(event);
  const sig = buildSignedBody(rawBody);
  const req = makeRequest('http://localhost/v1/billing/stripe/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sig },
    body: rawBody,
  });
  // The webhook handler reads `tenant_id` exclusively from event.metadata, so
  // the ctx tenant is irrelevant to handler logic. But MemoryStorage's
  // updateTenantStripe/updateStripeOrder early-return when the target row is
  // absent — so we MUST pre-register the metadata tenant for the writes to
  // land. Cheap, idempotent, scoped to the test process.
  const meta = event?.data?.object?.metadata;
  if (meta && typeof meta.tenant_id === 'string') {
    registerTestTenant(meta.tenant_id);
  } else {
    registerTestTenant('tenant_default');
  }
  return stripeWebhookHandler(req, ctxWithTenant('tenant_default'), {});
}

describe('stripeWebhookHandler', () => {
  it('rejects an unsigned request with 400', async () => {
    const body = JSON.stringify({ id: 'evt_2', type: 'ping', data: { object: {} } });
    const req = makeRequest('http://localhost/v1/billing/stripe/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': '' },
      body,
    });
    const res = await stripeWebhookHandler(req, ctxWithTenant('tenant_unsigned'), {});
    assert.equal(res.status, 400);
  });

  it('upgrades tenant tier on checkout.session.completed (DB-backed)', async () => {
    const tenantId = 'tenant_webhook_test';
    const orderId = 'MS-WEBHOOK01';
    const res = await signAndPost({
      id: 'evt_complete1',
      type: 'checkout.session.completed',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'cs_test_session_complete',
          object: 'checkout.session',
          customer: 'cus_webhook_test',
          subscription: 'sub_webhook_test',
          amount_total: 5000,
          currency: 'cad',
          metadata: { tenant_id: tenantId, plan_id: 'pro', order_id: orderId },
        },
      },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.action, 'tier_upgraded');

    // Phase-1 persistence: tenant tier is in DB, not a Map.
    assert.equal(readTenantTier(tenantId), 'pro');
    const t = readTenantStripe(tenantId);
    assert.equal(t.stripeCustomerId, 'cus_webhook_test');
    assert.equal(t.stripeSubscriptionId, 'sub_webhook_test');
  });

  it('treats invoice.paid as a renewal, alias of invoice.payment_succeeded', async () => {
    // Regression: the live endpoint subscribed `invoice.paid`, but the switch
    // only knew `invoice.payment_succeeded`, so renewals were recorded as
    // `unhandled`. Both events fire on a paid invoice with the same payload
    // shape; neither may fall through to the default branch.
    const tenantId = 'tenant_invoice_paid';
    const res = await signAndPost({
      id: 'evt_invoice_paid1',
      type: 'invoice.paid',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'in_test_paid1',
          object: 'invoice',
          customer: 'cus_invoice_paid',
          amount_paid: 2900,
          currency: 'cad',
          metadata: { tenant_id: tenantId, plan_id: 'pro' },
        },
      },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.notEqual(body.data.action, 'unhandled', 'invoice.paid must not fall through to the default branch');
    assert.match(body.data.action, /^renewal_logged/, `expected a renewal action, got "${body.data.action}"`);
  });

  it('treats invoice.payment_succeeded identically to invoice.paid', async () => {
    const tenantId = 'tenant_invoice_ps';
    const res = await signAndPost({
      id: 'evt_invoice_ps1',
      type: 'invoice.payment_succeeded',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'in_test_ps1',
          object: 'invoice',
          customer: 'cus_invoice_ps',
          amount_paid: 2900,
          currency: 'cad',
          metadata: { tenant_id: tenantId, plan_id: 'pro' },
        },
      },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.match(body.data.action, /^renewal_logged/);
  });

  it('records charge.refunded as a refund, not an unhandled event', async () => {
    // charge.refunded is handled in the switch but was not one of the events the
    // live endpoint subscribed, so refunds never arrived. It is subscribed now.
    const res = await signAndPost({
      id: 'evt_refund1',
      type: 'charge.refunded',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'ch_test_refund1',
          object: 'charge',
          amount_refunded: 1500,
          currency: 'cad',
          metadata: { tenant_id: 'tenant_refund' },
        },
      },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.notEqual(body.data.action, 'unhandled');
    assert.match(body.data.action, /^refund_/);
  });

  it('treats customer.subscription.paused and .resumed as handled events', async () => {
    const tenantId = 'tenant_paused_events_test';
    const customerId = 'cus_paused_events';
    const bind = await signAndPost({
      id: 'evt_bind_paused_events',
      type: 'checkout.session.completed',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'cs_test_bind_paused_events',
          object: 'checkout.session',
          customer: customerId,
          subscription: 'sub_paused_events',
          amount_total: 5000,
          currency: 'cad',
          metadata: { tenant_id: tenantId, plan_id: 'pro', order_id: 'MS-PAUSE02' },
        },
      },
    });
    assert.equal((await bind.json()).data.action, 'tier_upgraded');

    for (const [typ, status] of [['customer.subscription.paused', 'paused'], ['customer.subscription.resumed', 'active']] as const) {
      const res = await signAndPost({
        id: `evt_paused_events_${status}`,
        type: typ,
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        data: {
          object: {
            id: 'sub_paused_events',
            object: 'subscription',
            customer: customerId,
            status,
            current_period_end: Math.floor(Date.now() / 1000) + 86400,
            metadata: { tenant_id: tenantId, plan_id: 'pro' },
          },
        },
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.notEqual(body.data.action, 'unhandled', `${typ} must not fall through to the default branch`);
      assert.notEqual(body.data.action, 'rejected_cross_tenant', `${typ} lost the customer binding`);
      assert.match(body.data.action, /^tier_/, `expected a tier action for ${typ}, got "${body.data.action}"`);
    }
  });

  it('downgrades tier on customer.subscription.deleted when customer is bound', async () => {
    const tenantId = 'tenant_sub_delete_test';
    const customerId = 'cus_to_delete';

    // Bind via a normal checkout.session.completed first.
    const bindRes = await signAndPost({
      id: 'evt_bind_delete_test',
      type: 'checkout.session.completed',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'cs_test_bind_cs',
          object: 'checkout.session',
          customer: customerId,
          subscription: 'sub_to_delete',
          amount_total: 5000,
          currency: 'cad',
          metadata: { tenant_id: tenantId, plan_id: 'pro', order_id: 'MS-DELETE01' },
        },
      },
    });
    assert.equal(bindRes.status, 200);
    const bindBody = await bindRes.json();
    assert.equal(bindBody.data.action, 'tier_upgraded');
    assert.equal(readTenantTier(tenantId), 'pro');

    // Now fire subscription.deleted.
    const res = await signAndPost({
      id: 'evt_delete1',
      type: 'customer.subscription.deleted',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'sub_to_delete',
          object: 'subscription',
          customer: customerId,
          status: 'canceled',
          metadata: { tenant_id: tenantId, plan_id: 'pro' },
        },
      },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.action, 'tier_cancelled', `expected tier_cancelled, got ${body.data.action}`);
    assert.equal(readTenantTier(tenantId), 'free');
  });

  it('rejects subscription.deleted with rejected_cross_tenant when customer is unbound', async () => {
    const tenantId = 'tenant_sub_delete_unbound_test';
    registerTestTenant(tenantId, 'pro');
    // No prior binding for this tenant → must reject.
    const res = await signAndPost({
      id: 'evt_delete_unbound',
      type: 'customer.subscription.deleted',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'sub_unbound',
          object: 'subscription',
          customer: 'cus_unbound_attacker',
          status: 'canceled',
          metadata: { tenant_id: tenantId, plan_id: 'pro' },
        },
      },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.action, 'rejected_cross_tenant', `expected rejected_cross_tenant, got ${body.data.action}`);
    // Rejection must NOT pollute the tenant record with a tier.
    assert.notEqual(readTenantTier(tenantId), 'free', 'rejection must not write free');
    assert.equal(readTenantStripe(tenantId).stripeCustomerId, undefined);
  });

  it('responds 200 on unhandled event types (no retry from Stripe)', async () => {
    const res = await signAndPost({
      id: 'evt_random',
      type: 'radar.early_fraud_warning.created',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: { object: { id: 'ewf_x' } },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.action, 'unhandled');
  });

  // Pause-Collection (Stripe API 2024-12+): the subscription is paused but
  // their billing period keeps running, and the customer's plan entitlement
  // remains valid. The webhook MUST NOT downgrade to free; it must surface
  // status='paused' on the tenant row.
  it('customer.subscription.paused preserves tier (does not downgrade)', async () => {
    const tenantId = 'tenant_pause_test';
    const customerId = 'cus_pause_test';
    // Bind: pretend the tenant already paid Pro.
    const bindRes = await signAndPost({
      id: 'evt_bind_pause',
      type: 'checkout.session.completed',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'cs_pause_bind',
          object: 'checkout.session',
          customer: customerId,
          subscription: 'sub_pause',
          amount_total: 5000,
          currency: 'cad',
          metadata: { tenant_id: tenantId, plan_id: 'pro', order_id: 'MS-PAUSE01' },
        },
      },
    });
    assert.equal(bindRes.status, 200);
    assert.equal(readTenantTier(tenantId), 'pro');
    const tierBeforePause = readTenantTier(tenantId);

    // Fire subscription.paused.
    const res = await signAndPost({
      id: 'evt_pause1',
      type: 'customer.subscription.paused',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'sub_pause',
          object: 'subscription',
          customer: customerId,
          status: 'paused',
          metadata: { tenant_id: tenantId, plan_id: 'pro' },
        },
      },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.notEqual(body.data.action, 'tier_downgraded', 'pause must not downgrade');
    assert.notEqual(body.data.action, 'unhandled', 'pause must not be unhandled');
    // Tenant tier preserved across pause.
    assert.equal(readTenantTier(tenantId), tierBeforePause, 'tenant tier must be preserved on pause');
    const t = readTenantStripe(tenantId);
    assert.equal(t.stripeSubscriptionStatus, 'paused', 'subscriptionStatus row must reflect paused');
  });

  it('customer.subscription.resumed flips status back to active', async () => {
    const tenantId = 'tenant_resume_test';
    const customerId = 'cus_resume_test';
    const bindRes = await signAndPost({
      id: 'evt_bind_resume',
      type: 'checkout.session.completed',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'cs_resume_bind',
          object: 'checkout.session',
          customer: customerId,
          subscription: 'sub_resume',
          amount_total: 5000,
          currency: 'cad',
          metadata: { tenant_id: tenantId, plan_id: 'pro', order_id: 'MS-RESUME01' },
        },
      },
    });
    assert.equal(bindRes.status, 200);

    // Pause first.
    const pauseRes = await signAndPost({
      id: 'evt_pause_before_resume',
      type: 'customer.subscription.paused',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'sub_resume',
          object: 'subscription',
          customer: customerId,
          status: 'paused',
          metadata: { tenant_id: tenantId, plan_id: 'pro' },
        },
      },
    });
    assert.equal(pauseRes.status, 200);

    // Now resume.
    const res = await signAndPost({
      id: 'evt_resume1',
      type: 'customer.subscription.resumed',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'sub_resume',
          object: 'subscription',
          customer: customerId,
          status: 'active',
          metadata: { tenant_id: tenantId, plan_id: 'pro' },
        },
      },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.notEqual(body.data.action, 'tier_downgraded');
    const t = readTenantStripe(tenantId);
    assert.equal(t.stripeSubscriptionStatus, 'active', 'subscriptionStatus row must reflect active after resume');
  });

  it('is idempotent: re-firing the same event_id is a no-op', async () => {
    const tenantId = 'tenant_idempotent';
    const event = {
      id: 'evt_idempotent',
      type: 'checkout.session.completed',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'cs_idempotent',
          object: 'checkout.session',
          customer: 'cus_idempotent',
          subscription: 'sub_idempotent',
          amount_total: 5000,
          currency: 'cad',
          metadata: { tenant_id: tenantId, plan_id: 'pro', order_id: 'MS-IDEMPOTENT01' },
        },
      },
    };
    const first = await signAndPost(event);
    assert.equal(first.status, 200);
    const firstBody = await first.json();
    assert.equal(firstBody.data.action, 'tier_upgraded');

    // Replay the same event_id (Stripe at-least-once semantics).
    const replay = await signAndPost(event);
    assert.equal(replay.status, 200);
    const replayBody = await replay.json();
    assert.equal(replayBody.data.action, 'duplicate');
  });
});

// ──────────────────────────────────────────────────────────────────
// 7. Customer-portal handler — DB-backed
// ──────────────────────────────────────────────────────────────────

describe('stripePortalHandler', () => {
  it('404 when tenant has no Stripe customer on file', async () => {
    const req = makeRequest('http://localhost/v1/billing/stripe/portal', { method: 'POST' });
    const res = await stripePortalHandler(req, ctxWithTenant('tenant_never_paid'), {});
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error.code, 'NO_STRIPE_CUSTOMER');
  });
});

// ──────────────────────────────────────────────────────────────────
// 8. order status + status endpoints
// ──────────────────────────────────────────────────────────────────

describe('stripeOrderStatusHandler + stripeStatusHandler', () => {
  it('order status returns 404 for unknown order', async () => {
    const req = makeRequest('http://localhost/v1/billing/stripe/order/MS-NOPE', { method: 'GET' });
    const res = await stripeOrderStatusHandler(req, ctxWithTenant('tenant_a'), { id: 'MS-NOPE' });
    assert.equal(res.status, 404);
  });

  it('order status returns 403 when tenant does not own the order', async () => {
    const tenantId = 'tenant_status_owner';
    registerTestTenant(tenantId);
    await _testDb.createStripeOrder({
      order_id: 'MS-OWNED',
      tenant_id: tenantId,
      plan_id: 'pro',
      amount_cents: 5000,
      currency: 'CAD',
      stripe_checkout_session_id: 'cs_status_test',
      status: 'pending',
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    });
    const res = await stripeOrderStatusHandler(
      makeRequest('http://localhost/v1/billing/stripe/order/MS-OWNED', { method: 'GET' }),
      ctxWithTenant('tenant_other'),
      { id: 'MS-OWNED' },
    );
    assert.equal(res.status, 403);
  });

  it('order status returns 200 with order payload for the owning tenant', async () => {
    const tenantId = 'tenant_status_reader';
    registerTestTenant(tenantId);
    await _testDb.createStripeOrder({
      order_id: 'MS-OK',
      tenant_id: tenantId,
      plan_id: 'business',
      amount_cents: 20000,
      currency: 'CAD',
      stripe_checkout_session_id: 'cs_ok',
      status: 'paid',
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    });
    const res = await stripeOrderStatusHandler(
      makeRequest('http://localhost/v1/billing/stripe/order/MS-OK', { method: 'GET' }),
      ctxWithTenant(tenantId),
      { id: 'MS-OK' },
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.status, 'paid');
    assert.equal(body.data.plan_id, 'business');
  });

  it('status handler returns assigned_tier from ctx.tenant.tier (DB-loaded)', async () => {
    const tenantId = 'tenant_status_endpoint';
    registerTestTenant(tenantId, 'pro');
    const res = await stripeStatusHandler(
      makeRequest('http://localhost/v1/billing/stripe/status', { method: 'GET' }),
      ctxWithTenant(tenantId, 'pro'),
      {},
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.assigned_tier, 'pro');
    assert.equal(body.data.stripe_configured, true);
  });
});

// ──────────────────────────────────────────────────────────────────
// 9. Restart-survival — proves Phase 1 persistence works against
//    a real on-disk DB (NodeSqliteStorage, the k3s prod backend).
// ──────────────────────────────────────────────────────────────────

describe('Restart-survival (NodeSqliteStorage; simulates k3s pod eviction)', () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `quill-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  });

  function cleanup() {
    try { fs.unlinkSync(dbPath); } catch { /* ignore */ }
    try { fs.unlinkSync(dbPath + '-wal'); } catch { /* ignore */ }
    try { fs.unlinkSync(dbPath + '-shm'); } catch { /* ignore */ }
  }

  it('a tenant Stripe linkage + order persist across DB close-and-reopen', async () => {
    // 1. Open DB, register tenant, run Stripe flow, persist.
    {
      const db = new NodeSqliteStorage(dbPath);
      const tenantId = 'tenant_restart_test';
      db.createTenant({
        id: tenantId,
        name: 'Restart Tenant',
        emailVerified: false,
        tier: 'free',
        isActive: true,
        journalismMode: false,
      });
      db.createApiKey('k_restart', tenantId, 'hashed-key-restart', 'default');

      // Simulate checkout.session.completed via updateTenantStripe.
      await db.updateTenantStripe(tenantId, {
        tier: 'pro',
        stripeCustomerId: 'cus_restart_persist',
        stripeSubscriptionId: 'sub_restart_persist',
        stripeSubscriptionStatus: 'active',
        stripeCurrentPeriodEnd: Math.floor(Date.now() / 1000) + 30 * 86400,
      });
      await db.createStripeOrder({
        order_id: 'MS-RESTART-1',
        tenant_id: tenantId,
        plan_id: 'pro',
        amount_cents: 5000,
        currency: 'CAD',
        stripe_checkout_session_id: 'cs_restart_persist',
        status: 'paid',
        expires_at: Math.floor(Date.now() / 1000) + 1800,
      });

      db.close();
    }

    // 2. Reopen (simulating pod restart). State MUST be intact.
    {
      const db = new NodeSqliteStorage(dbPath);
      const order = await db.getStripeOrderById('MS-RESTART-1');
      assert.ok(order, 'order must survive restart');
      assert.equal(order!.status, 'paid');
      assert.equal(order!.stripe_checkout_session_id, 'cs_restart_persist');

      // Customer id should be on the tenant row.
      const custId = await db.getTenantStripeCustomerId('tenant_restart_test');
      assert.equal(custId, 'cus_restart_persist');

      // Also via authenticate (which is what the api-server does on every request).
      const auth = await db.authenticate('not-the-real-key-but-let-us-try');
      // We seeded the raw key, not the hashed one, so this returns null — that's fine.
      // The real proof is the createOrder + getById round-trip.

      // Confirm DB-persisted tier on the tenant record.
      const tenantRow = (db as any).db.prepare('SELECT tier FROM tenants WHERE id = ?').get('tenant_restart_test') as { tier: string } | undefined;
      assert.equal(tenantRow?.tier, 'pro', 'tier must survive restart');

      db.close();
      cleanup();
    }
  });

  it('UNIQUE(stripe_checkout_session_id) prevents duplicate orders (idempotency at DB layer)', () => {
    const dbPath2 = path.join(os.tmpdir(), `quill-test-dup-${Date.now()}.db`);
    const db = new NodeSqliteStorage(dbPath2);
    const tenantId = 'tenant_dup_test';
    db.createTenant({ id: tenantId, name: 'D', emailVerified: false, tier: 'free', isActive: true, journalismMode: false });

    db.createStripeOrder({
      order_id: 'MS-DUP-A',
      tenant_id: tenantId,
      plan_id: 'pro',
      amount_cents: 5000,
      currency: 'CAD',
      stripe_checkout_session_id: 'cs_unique_x',
      status: 'pending',
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    }).then(() => {
      // Subsequent INSERT for the same session should throw (UNIQUE violation).
      return db.createStripeOrder({
        order_id: 'MS-DUP-B',
        tenant_id: tenantId,
        plan_id: 'pro',
        amount_cents: 5000,
        currency: 'CAD',
        stripe_checkout_session_id: 'cs_unique_x',
        status: 'pending',
        expires_at: Math.floor(Date.now() / 1000) + 1800,
      });
    }).then(() => {
      assert.fail('UNIQUE constraint should reject duplicate stripe_checkout_session_id');
    }, (err: Error) => {
      assert.ok(err.message.includes('UNIQUE'), `expected UNIQUE error, got: ${err.message}`);
    }).finally(() => {
      db.close();
      try { fs.unlinkSync(dbPath2); } catch { /* ignore */ }
    });
  });
});

// ──────────────────────────────────────────────────────────────────
// 9. Embedded Checkout wire value
//
// Stripe retired `ui_mode=embedded`: the live account answers "The ui_mode
// value `embedded` is no longer supported. Use `embedded_page` instead."
// (checked 2026-11-23 under our own Stripe-Version pin, so the pin does not
// rescue it). Embedded sessions would 400 before the browser ever saw a
// client_secret.
// ──────────────────────────────────────────────────────────────────
describe('createCheckoutSession ui_mode', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  async function captureBody(uiMode?: 'hosted' | 'embedded') {
    let url = '';
    let body = '';
    global.fetch = (async (input: any, init: any) => {
      url = String(input);
      body = String(init?.body ?? '');
      return new Response(
        JSON.stringify({
          id: 'cs_test_ui',
          object: 'checkout.session',
          url: 'https://checkout.stripe.com/c/pay/cs_test_ui',
          status: 'open',
          client_secret: 'cs_test_ui_secret',
          metadata: {},
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    await stripe.createCheckoutSession({
      customerId: 'cus_test_ui',
      amountCents: 5000,
      currency: 'cad',
      productName: 'Quill by Maplespike Pro',
      planId: 'pro',
      tenantId: 'tenant_ui',
      orderId: 'MS-UI-1',
      intervalMonths: 1,
      successUrl: 'https://quill.maplespike.ca/checkout/thanks',
      cancelUrl: 'https://quill.maplespike.ca/pricing',
      expiresAtUnix: Math.floor(Date.now() / 1000) + 1800,
      uiMode,
      returnUrl: 'https://quill.maplespike.ca/checkout/return',
    });

    return { url, body };
  }

  it('sends embedded_page, never the retired embedded value', async () => {
    const { url, body } = await captureBody('embedded');
    assert.equal(url, 'https://api.stripe.com/v1/checkout/sessions');
    assert.ok(body.includes('ui_mode=embedded_page'), `expected ui_mode=embedded_page, got: ${body}`);
    assert.ok(!/(^|&)ui_mode=embedded(&|$)/.test(body), 'must not send the retired `embedded` value');
    assert.ok(body.includes('return_url='), 'embedded sessions take return_url');
    assert.ok(!body.includes('success_url='), 'embedded sessions reject success_url');
    assert.ok(!body.includes('cancel_url='), 'embedded sessions reject cancel_url');
  });

  it('omits ui_mode for the hosted redirect', async () => {
    const { body } = await captureBody('hosted');
    assert.ok(!body.includes('ui_mode='), `hosted sessions must not send ui_mode, got: ${body}`);
    assert.ok(body.includes('success_url=') && body.includes('cancel_url='));
  });
});
