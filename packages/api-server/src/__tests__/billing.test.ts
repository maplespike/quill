/**
 * Billing Route Tests — MapleSpike API Server
 *
 * Tests the crypto billing module: plan listing, order creation with signing,
 * order status with tenant isolation + auto-expiry, and on-chain payment
 * verification with idempotency.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

/* ------------------------------------------------------------------ */
/*  Environment setup — MUST happen before billing module is imported  */
/*  (TREASURY map is built at module-eval time from process.env)        */
/* ------------------------------------------------------------------ */

const TREASURY_ETH = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEbe';
process.env.MAPLESPIKE_TREASURY_ETH = TREASURY_ETH;
// Setting ETH treasury is sufficient: getTreasuryAddress() falls back to
// TREASURY['ethereum'] for any chain whose own treasury is unconfigured.

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/v1/billing/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(url: string): Request {
  return new Request(url, { method: 'GET' });
}

/** A fake but valid-looking 32-byte tx hash (66 chars with 0x prefix). */
const FAKE_TX_HASH = '0x' + 'a1'.repeat(32);

/* ------------------------------------------------------------------ */
/*  Test contexts                                                      */
/* ------------------------------------------------------------------ */

const ctx = {
  tenant: { id: 'test-tenant', tier: 'free' as const },
  requestId: 'req-1',
  startTime: Date.now(),
} as unknown as import('../types.js').RouteContext;

const otherCtx = {
  tenant: { id: 'other-tenant', tier: 'free' as const },
  requestId: 'req-2',
  startTime: Date.now(),
} as unknown as import('../types.js').RouteContext;

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('Billing Routes', () => {
  let billingPlansHandler: import('../types.js').RouteHandler;
  let billingOrderHandler: import('../types.js').RouteHandler;
  let billingOrderStatusHandler: import('../types.js').RouteHandler;
  let billingVerifyHandler: import('../types.js').RouteHandler;

  before(async () => {
    const mod = await import('../routes/billing.js');
    billingPlansHandler = mod.billingPlansHandler;
    billingOrderHandler = mod.billingOrderHandler;
    billingOrderStatusHandler = mod.billingOrderStatusHandler;
    billingVerifyHandler = mod.billingVerifyHandler;
  });

  after(() => {
    // Clean up env so we don't leak into other test files sharing the process
    delete process.env.MAPLESPIKE_TREASURY_ETH;
  });

  /* --------------------------------------------------------------- */
  /*  GET /v1/billing/plans                                           */
  /* --------------------------------------------------------------- */

  describe('Plans handler', () => {
    it('returns 4 plans with correct fields', async () => {
      const resp = await billingPlansHandler(
        makeGetRequest('http://localhost/v1/billing/plans'),
        ctx,
        {},
      );
      assert.equal(resp.status, 200);
      const body = await resp.json();
      assert.ok(body.success, 'response should be successful');
      assert.ok(Array.isArray(body.data.plans), 'plans should be an array');
      assert.equal(body.data.plans.length, 4, 'should have exactly 4 plans');

      for (const plan of body.data.plans) {
        assert.ok(plan.id, 'plan should have id');
        assert.ok(plan.name, 'plan should have name');
        assert.equal(typeof plan.priceUsd, 'number');
        assert.equal(typeof plan.requests, 'number');
        assert.equal(typeof plan.rateLimit, 'number');
      }

      const ids = body.data.plans.map((p: { id: string }) => p.id);
      assert.ok(ids.includes('free'));
      assert.ok(ids.includes('pro'));
      assert.ok(ids.includes('business'));
      assert.ok(ids.includes('enterprise'));
    });

    it('returns chains with correct shape', async () => {
      const resp = await billingPlansHandler(
        makeGetRequest('http://localhost/v1/billing/plans'),
        ctx,
        {},
      );
      const body = await resp.json();
      assert.ok(Array.isArray(body.data.chains));
      // At least 10 chains defined (actually 19)
      assert.ok(body.data.chains.length >= 10, `expected >= 10 chains, got ${body.data.chains.length}`);

      for (const chain of body.data.chains) {
        assert.ok(chain.id, 'chain should have id');
        assert.ok(chain.name, 'chain should have name');
        assert.ok(chain.token, 'chain should have token');
        assert.ok(['evm', 'solana', 'tron', 'bitcoin'].includes(chain.kind));
        assert.equal(typeof chain.isStablecoin, 'boolean');
      }
    });

    it('includes ethereum chain', async () => {
      const resp = await billingPlansHandler(
        makeGetRequest('http://localhost/v1/billing/plans'),
        ctx,
        {},
      );
      const body = await resp.json();
      const ethereum = body.data.chains.find((c: { id: string }) => c.id === 'ethereum');
      assert.ok(ethereum, 'ethereum chain should be listed');
    });
  });

  /* --------------------------------------------------------------- */
  /*  POST /v1/billing/order                                          */
  /* --------------------------------------------------------------- */

  describe('Order creation', () => {
    it('creates order for valid pro plan + ethereum chain', async () => {
      const resp = await billingOrderHandler(
        makeRequest({ planId: 'pro', chainId: 'ethereum' }),
        ctx,
        {},
      );
      assert.equal(resp.status, 200);
      const body = await resp.json();
      assert.ok(body.success, 'response should be successful');

      assert.ok(body.data.orderId, 'should have orderId');
      assert.ok(body.data.orderId.startsWith('ord_'), 'orderId should start with ord_');
      assert.ok(body.data.treasuryAddress, 'should have treasuryAddress');
      assert.equal(body.data.treasuryAddress, TREASURY_ETH);
      assert.ok(body.data.reference, 'should have reference');
      assert.ok(body.data.reference.startsWith('maple_'), 'reference should start with maple_');
      assert.equal(body.data.plan, 'pro');
      assert.equal(body.data.planName, 'Pro');
      assert.equal(body.data.chain, 'ethereum');
      assert.equal(body.data.amount, 49);
      assert.equal(body.data.token, 'ETH');
      assert.equal(body.data.kind, 'evm');
      assert.ok(body.data.expiresAt, 'should have expiresAt');
      assert.ok(body.data.features, 'should have features array');
    });

    it('creates order for business plan with USDC chain', async () => {
      const resp = await billingOrderHandler(
        makeRequest({ planId: 'business', chainId: 'ethereum-usdc' }),
        ctx,
        {},
      );
      assert.equal(resp.status, 200);
      const body = await resp.json();
      assert.ok(body.success);
      assert.equal(body.data.plan, 'business');
      assert.equal(body.data.chain, 'ethereum-usdc');
      assert.equal(body.data.token, 'USDC');
      assert.equal(body.data.amount, 199);
      assert.ok(body.data.tokenContract, 'USDC chain should have tokenContract');
    });

    it('rejects free plan with error (price is 0)', async () => {
      const resp = await billingOrderHandler(
        makeRequest({ planId: 'free', chainId: 'ethereum' }),
        ctx,
        {},
      );
      assert.equal(resp.status, 400);
      const body = await resp.json();
      assert.ok(!body.success);
      // Free plan has priceUsd === 0, handler returns INVALID_PLAN
      assert.equal(body.error.code, 'INVALID_PLAN');
    });

    it('rejects unknown plan with INVALID_PLAN', async () => {
      const resp = await billingOrderHandler(
        makeRequest({ planId: 'nonexistent-plan', chainId: 'ethereum' }),
        ctx,
        {},
      );
      assert.equal(resp.status, 400);
      const body = await resp.json();
      assert.equal(body.error.code, 'INVALID_PLAN');
    });

    it('rejects invalid chain with INVALID_CHAIN', async () => {
      const resp = await billingOrderHandler(
        makeRequest({ planId: 'pro', chainId: 'dogechain-moon' }),
        ctx,
        {},
      );
      assert.equal(resp.status, 400);
      const body = await resp.json();
      assert.ok(!body.success);
      assert.equal(body.error.code, 'INVALID_CHAIN');
    });

    it('rejects missing fields with VALIDATION_ERROR', async () => {
      const resp = await billingOrderHandler(makeRequest({}), ctx, {});
      assert.equal(resp.status, 400);
      const body = await resp.json();
      assert.equal(body.error.code, 'VALIDATION_ERROR');
    });

    it('rejects malformed body with BAD_REQUEST', async () => {
      const req = new Request('http://localhost/v1/billing/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json at all {{{',
      });
      const resp = await billingOrderHandler(req, ctx, {});
      assert.equal(resp.status, 400);
      const body = await resp.json();
      assert.equal(body.error.code, 'BAD_REQUEST');
    });
  });

  /* --------------------------------------------------------------- */
  /*  Order lifecycle: status + verify                                */
  /*  Uses bitcoin chain for auto-confirm (no RPC mock needed)        */
  /* --------------------------------------------------------------- */

  describe('Order lifecycle', () => {
    let orderId: string;

    it('creates a bitcoin order for status/verify tests', async () => {
      const resp = await billingOrderHandler(
        makeRequest({ planId: 'pro', chainId: 'bitcoin' }),
        ctx,
        {},
      );
      assert.equal(resp.status, 200);
      const body = await resp.json();
      orderId = body.data.orderId;
      assert.ok(orderId, 'should have created an order');
    });

    it('order status returns pending for existing order', async () => {
      const resp = await billingOrderStatusHandler(
        makeGetRequest(`http://localhost/v1/billing/order/${orderId}`),
        ctx,
        [orderId] as unknown as Record<string, string>,
      );
      assert.equal(resp.status, 200);
      const body = await resp.json();
      assert.ok(body.success);
      assert.equal(body.data.status, 'pending');
      assert.equal(body.data.orderId, orderId);
      assert.equal(body.data.plan, 'pro');
      assert.equal(body.data.amount, 49);
      assert.equal(body.data.chain, 'bitcoin');
      assert.equal(body.data.txHash, null);
      assert.ok(body.data.createdAt);
      assert.ok(body.data.expiresAt);
    });

    it('order status returns 404 for unknown order', async () => {
      const resp = await billingOrderStatusHandler(
        makeGetRequest('http://localhost/v1/billing/order/ord_does_not_exist'),
        ctx,
        ['ord_does_not_exist'] as unknown as Record<string, string>,
      );
      assert.equal(resp.status, 404);
      const body = await resp.json();
      assert.equal(body.error.code, 'NOT_FOUND');
    });

    it('order status returns 403 for cross-tenant access', async () => {
      const resp = await billingOrderStatusHandler(
        makeGetRequest(`http://localhost/v1/billing/order/${orderId}`),
        otherCtx,
        [orderId] as unknown as Record<string, string>,
      );
      assert.equal(resp.status, 403);
      const body = await resp.json();
      assert.equal(body.error.code, 'FORBIDDEN');
    });

    it('verifies bitcoin order successfully (auto-confirm for non-EVM)', async () => {
      const resp = await billingVerifyHandler(
        makeRequest({ orderId, txHash: FAKE_TX_HASH }),
        ctx,
        {},
      );
      assert.equal(resp.status, 200);
      const body = await resp.json();
      assert.ok(body.success);
      assert.equal(body.data.status, 'verified');
      assert.equal(body.data.orderId, orderId);
      assert.equal(body.data.txHash, FAKE_TX_HASH);
      assert.ok(body.data.verifiedAt);
    });

    it('verified order status reflects verified state', async () => {
      const resp = await billingOrderStatusHandler(
        makeGetRequest(`http://localhost/v1/billing/order/${orderId}`),
        ctx,
        [orderId] as unknown as Record<string, string>,
      );
      assert.equal(resp.status, 200);
      const body = await resp.json();
      assert.equal(body.data.status, 'verified');
      assert.equal(body.data.txHash, FAKE_TX_HASH);
      assert.ok(body.data.verifiedAt);
    });
  });

  /* --------------------------------------------------------------- */
  /*  POST /v1/billing/verify                                         */
  /* --------------------------------------------------------------- */

  describe('Payment verification', () => {
    it('is idempotent: verified order stays verified', async () => {
      // Create a fresh bitcoin order (auto-confirms without RPC)
      const createResp = await billingOrderHandler(
        makeRequest({ planId: 'pro', chainId: 'bitcoin' }),
        ctx,
        {},
      );
      const createBody = await createResp.json();
      const orderId = createBody.data.orderId;

      // First verify — should succeed and mark as verified
      const resp1 = await billingVerifyHandler(
        makeRequest({ orderId, txHash: FAKE_TX_HASH }),
        ctx,
        {},
      );
      assert.equal(resp1.status, 200);
      const body1 = await resp1.json();
      assert.equal(body1.data.status, 'verified');

      // Second verify — should be idempotent (cached, not re-verified)
      const resp2 = await billingVerifyHandler(
        makeRequest({ orderId, txHash: FAKE_TX_HASH }),
        ctx,
        {},
      );
      assert.equal(resp2.status, 200);
      const body2 = await resp2.json();
      assert.equal(body2.data.status, 'verified');
      assert.ok(
        body2.data.message.toLowerCase().includes('already verified'),
        `expected idempotent message, got: ${body2.data.message}`,
      );
    });

    it('returns 404 for unknown order', async () => {
      const resp = await billingVerifyHandler(
        makeRequest({ orderId: 'ord_unknown_12345', txHash: FAKE_TX_HASH }),
        ctx,
        {},
      );
      assert.equal(resp.status, 404);
      const body = await resp.json();
      assert.equal(body.error.code, 'NOT_FOUND');
    });

    it('returns 403 for cross-tenant verify attempt', async () => {
      // Create order with test-tenant
      const createResp = await billingOrderHandler(
        makeRequest({ planId: 'pro', chainId: 'bitcoin' }),
        ctx,
        {},
      );
      const createBody = await createResp.json();
      const orderId = createBody.data.orderId;

      // Attempt verify from a different tenant
      const resp = await billingVerifyHandler(
        makeRequest({ orderId, txHash: FAKE_TX_HASH }),
        otherCtx,
        {},
      );
      assert.equal(resp.status, 403);
      const body = await resp.json();
      assert.equal(body.error.code, 'FORBIDDEN');
    });

    it('rejects missing fields with VALIDATION_ERROR', async () => {
      const resp = await billingVerifyHandler(makeRequest({}), ctx, {});
      assert.equal(resp.status, 400);
      const body = await resp.json();
      assert.equal(body.error.code, 'VALIDATION_ERROR');
    });

    it('rejects short txHash with VALIDATION_ERROR', async () => {
      // Create an order first so we pass the orderId check
      const createResp = await billingOrderHandler(
        makeRequest({ planId: 'pro', chainId: 'bitcoin' }),
        ctx,
        {},
      );
      const createBody = await createResp.json();
      const orderId = createBody.data.orderId;

      // txHash must be minLength 10
      const resp = await billingVerifyHandler(
        makeRequest({ orderId, txHash: 'short' }),
        ctx,
        {},
      );
      assert.equal(resp.status, 400);
      const body = await resp.json();
      assert.equal(body.error.code, 'VALIDATION_ERROR');
    });
  });
});
