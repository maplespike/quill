/**
 * Billing Routes
 *
 * Handles plan discovery + Interac e-Transfer order endpoints.
 *
 * Phase 1 Stripe migration note (2026-07):
 *   The previous in-memory `tenantTiers` Map + `getAssignedTier()` override
 *   that index.ts used to layer on top of authenticate() is gone. Both
 *   Stripe webhooks (routes/billing-stripe.ts) AND this module's verify
 *   path now persist tier changes directly via ctx.db.updateTenantStripe.
 *   Auth middleware reads the DB tier; there is no in-memory override layer.
 *
 *   The `verifiedOrders` Map still exists so the e-Transfer order status
 *   endpoint can answer "did the IMAP poller reconcile my order yet?".
 *   RETIRED under Decision 0002: the IMAP poller was removed because email
 *   bodies are PII (see docs/decisions/0002-pii-avoidance.md), so this map
 *   stays empty in prod by design — no in-flight order reconciliation.
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

// ─── Plan Definitions ─────────────────────────────────────────────────────

type Plan = {
  plan_id: string;
  name: string;
  price_cents: number;
  credits_per_month: number;
  rate_limit_per_min: number;
  features: string[];
  tier: 'free' | 'pro' | 'business' | 'enterprise';
  /** Human-readable description for the billing page */
  description: string;
};

const PLANS: Record<string, Plan> = {
  community: {
    plan_id: 'community',
    tier: 'free',
    name: 'Community',
    description: 'Self-hosted — git clone + docker compose up. Full pipeline, all 198 modules, all 164 MCP tools. You run the infra.',
    price_cents: 0,
    credits_per_month: Infinity,
    rate_limit_per_min: Infinity,
    features: [
      'All 198 data modules',
      'All 164 MCP tools',
      'Entity resolution engine',
      'Cross-reference queries',
      'SQLite-backed local database',
      'API key auth (single-tenant)',
      'Docker Compose deployment',
      'Community support (GitHub Issues)',
    ],
  },
  free: {
    plan_id: 'free',
    tier: 'free',
    name: 'Free',
    description: 'Hosted API — try Quill with no credit card. 1,000 calls/month, public data modules only.',
    price_cents: 0,
    credits_per_month: 1000,
    rate_limit_per_min: 10,
    features: [
      'Public data modules',
      'Basic MCP tools',
      'Citation + provenance',
      'Community support',
    ],
  },
  pro: {
    plan_id: 'pro',
    tier: 'pro',
    name: 'Pro',
    description: 'For independent researchers, journalists, and small teams. RAG-powered AI queries, full tool access.',
    price_cents: 5000,
    credits_per_month: 50000,
    rate_limit_per_min: 60,
    features: [
      'All MCP tools (164)',
      'RAG-powered AI queries',
      'Entity resolution',
      'Full REST API access',
      'Developer console',
      'Email support (< 48h)',
      '30-day data freshness SLA',
    ],
  },
  business: {
    plan_id: 'business',
    tier: 'business',
    name: 'Business',
    description: 'For think tanks, NGOs, newsrooms, and lobbying firms. SSO, team seats, journalism mode, cross-reference reports.',
    price_cents: 20000,
    credits_per_month: 250000,
    rate_limit_per_min: 300,
    features: [
      'Everything in Pro',
      'SSO (GitHub, Google OAuth)',
      '5 team seats',
      'Journalism mode (verified press)',
      'Cross-reference reports',
      'Usage analytics dashboard',
      'Priority support (< 8h)',
      '7-day data freshness SLA',
    ],
  },
  enterprise: {
    plan_id: 'enterprise',
    tier: 'enterprise',
    name: 'Enterprise',
    description: 'For government agencies, large news organizations, financial compliance teams. Dedicated infra, SAML, SOC2, custom modules.',
    price_cents: 0, // custom pricing — contact sales
    credits_per_month: 1000000,
    rate_limit_per_min: 1000,
    features: [
      'Everything in Business',
      'SAML/OIDC SSO',
      'RBAC + audit logs',
      'SOC2 compliance package',
      'Dedicated infrastructure (single-tenant K3s)',
      'Custom data modules',
      'White-label portal',
      'On-premise deployment option',
      'Legacy commercialLicense feature flag (does not grant software rights)',
      'SLA (99.9% uptime, < 1h response)',
    ],
  },
};

// ─── Stripe Price lookup keys ─────────────────────────────────────────────
//
// When STRIPE_USE_LOOKUP_KEYS=true, Stripe Checkout uses a catalog Price found
// by lookup_key instead of inline price_data. The expected amount/currency come
// from PLANS above, so a catalog Price that drifts from the advertised plan
// fails closed. No price_... ids live in code: the lookup_key is the contract.

export type StripePriceLookup = {
  plan_id: 'pro' | 'business';
  lookup_key: string;
  amount_cents: number;
  currency: 'cad';
  interval: 'month';
  interval_count: 1;
};

export const STRIPE_PRICE_LOOKUP_KEYS: Readonly<Record<'pro' | 'business', string>> = Object.freeze({
  pro: 'quill_pro_monthly',
  business: 'quill_business_monthly',
});

/** Lookup-key contract for a Stripe-purchasable plan, or null for free/custom plans. */
export function stripePriceLookupForPlan(planId: string): StripePriceLookup | null {
  if (planId !== 'pro' && planId !== 'business') return null;
  const plan = PLANS[planId];
  return {
    plan_id: planId,
    lookup_key: STRIPE_PRICE_LOOKUP_KEYS[planId],
    amount_cents: plan.price_cents,
    currency: 'cad',
    interval: 'month',
    interval_count: 1,
  };
}

// ─── Verified Order Store (in-memory; pending IMAP poller integration) ───
//
// Phase 1 (Stripe migration): the tenant tier is no longer mirrored here.
// The e-Transfer verify path persists to tenants.tier via ctx.db (see
// billingVerifyHandler below). The Map keeps the orderId → VerifiedOrder
// lookup so /v1/billing/orders/:id can answer "did the IMAP poller pick
// up my e-Transfer yet?". Once Stripe replaces e-Transfer end-to-end, this
// Map can be retired.

interface VerifiedOrder {
  order_id: string;
  tenant_id: string;
  plan_id: string;
  tier: 'free' | 'pro' | 'business' | 'enterprise';
  verified_at: number;
}

const verifiedOrders = new Map<string, VerifiedOrder>();

/** Look up a verified order by order_id. Returns null if not found or expired. */
export function getVerifiedOrder(orderId: string): VerifiedOrder | null {
  const order = verifiedOrders.get(orderId);
  if (!order) return null;
  // Orders expire after 24 hours
  if (Date.now() / 1000 - order.verified_at > 86400) {
    verifiedOrders.delete(orderId);
    return null;
  }
  return order;
}

// ─── Utilities ───────────────────────────────────────────────────────────

function generateOrderId(): string {
  return `MS-${nanoid(6).toUpperCase()}`;
}

function signOrder(orderId: string, tenantId: string): string {
  const secret = process.env.QUILL_BILLING_SECRET || 'dev-secret';
  const payload = `${orderId}:${tenantId}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

// ─── Handlers ─────────────────────────────────────────────────────────────

export const billingPlansHandler: RouteHandler = async (_request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  return jsonResponse(buildSuccess({
    plans: Object.values(PLANS),
    currency: 'CAD',
  }, bc));
};

export const billingSeedPlansHandler: RouteHandler = async (request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  const secret = request.headers.get('X-Billing-Secret');
  if (secret !== process.env.QUILL_BILLING_SECRET) {
    return jsonResponse(buildError('UNAUTHORIZED', 'Unauthorized', bc), 401);
  }

  return jsonResponse(buildSuccess({
    message: 'Plans are defined in code (PLANS constant)',
    plans: Object.values(PLANS),
  }, bc));
};

export const billingOrderHandler: RouteHandler = async (request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse(buildError('UNAUTHORIZED', 'Missing Authorization header', bc), 401);
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const plan_id = String(body.plan_id);

    if (!['free', 'pro', 'business'].includes(plan_id)) {
      if (plan_id === 'enterprise') {
        return jsonResponse(buildError('CONTACT_SALES', 'Enterprise plans require a custom contract. Contact billing@maplespike.ca.', bc), 400);
      }
      return jsonResponse(buildError('BAD_REQUEST', 'Invalid plan', bc), 400);
    }

    const plan = PLANS[plan_id];
    const token = authHeader.slice(7);
    const tenantId = `tenant_${token.slice(0, 8)}`;
    const orderId = generateOrderId();
    const signature = signOrder(orderId, tenantId);
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + 15 * 60; // 15 minutes

    return jsonResponse(buildSuccess({
      order_id: orderId,
      tenant_id: tenantId,
      plan_id: plan.plan_id,
      amount_cents: plan.price_cents,
      currency: 'CAD',
      payment_method: 'etransfer',
      status: 'pending',
      expires_at: expiresAt,
      signature,
      instructions: {
        email: process.env.MAPLESPIKE_BILLING_EMAIL || 'billing@maplespike.ca',
        amount: (plan.price_cents / 100).toFixed(2),
        message: orderId,
      },
    }, bc));
  } catch {
    return jsonResponse(buildError('BAD_REQUEST', 'Invalid request body', bc), 400);
  }
};

export const billingOrderStatusHandler: RouteHandler = async (request, ctx, params) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  const orderId = params?.[0];

  const verified = getVerifiedOrder(orderId || '');
  return jsonResponse(buildSuccess({
    order_id: orderId,
    status: verified ? 'completed' : 'pending',
    tier: verified?.tier || null,
    plan_id: verified?.plan_id || null,
    created_at: verified?.verified_at || Math.floor(Date.now() / 1000),
  }, bc));
};

export const billingReconcileHandler: RouteHandler = async (request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  const secret = request.headers.get('X-Billing-Secret');
  if (secret !== process.env.QUILL_BILLING_SECRET) {
    return jsonResponse(buildError('UNAUTHORIZED', 'Unauthorized', bc), 401);
  }

  // IMAP poller will be added later with proper database integration
  return jsonResponse(buildSuccess({
    processed: 0,
    credited: 0,
    failed: 0,
    errors: [],
    message: 'IMAP reconciliation not yet implemented',
  }, bc));
};

/**
 * Phase-1 e-Transfer verify path. This endpoint is called by the (future)
 * IMAP poller behind the QUILL_BILLING_SECRET shared key. After Phase 1, the
 * persistence target is the DB (tenants.tier + stripe_orders) — not an
 * in-memory cache. We mirror the Stripe webhook pattern so behaviour is
 * identical for any other tenant that signs up via the Canadian channel.
 */
export const billingVerifyHandler: RouteHandler = async (request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  const secret = request.headers.get('X-Billing-Secret');
  if (secret !== process.env.QUILL_BILLING_SECRET) {
    return jsonResponse(buildError('UNAUTHORIZED', 'Unauthorized', bc), 401);
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const orderId = String(body.order_id || '');
    const tenantId = String(body.tenant_id || '');
    const planId = String(body.plan_id || '');

    if (!orderId || !tenantId || !planId) {
      return jsonResponse(buildError('BAD_REQUEST', 'order_id, tenant_id, and plan_id are required', bc), 400);
    }

    const plan = PLANS[planId];
    if (!plan) {
      return jsonResponse(buildError('BAD_REQUEST', `Unknown plan: ${planId}`, bc), 400);
    }

    const verified: VerifiedOrder = {
      order_id: orderId,
      tenant_id: tenantId,
      plan_id: planId,
      tier: plan.tier,
      verified_at: Math.floor(Date.now() / 1000),
    };
    verifiedOrders.set(orderId, verified);

    // Persist tier to DB so the next authenticated API call reflects the
    // upgrade — symmetrical with the Stripe webhook's ctx.db.updateTenantStripe.
    // We DO NOT touch stripe_customer_id / stripe_subscription_id here — that's
    // Stripe's side of the world. The two channels can co-exist (a tenant may
    // upgrade via e-Transfer once and switch to Stripe later, or vice versa).
    await ctx.db.updateTenantStripe(tenantId, { tier: plan.tier });
    await ctx.db.logAudit({
      tenantId,
      apiKeyId: undefined,
      operation: 'billing_etransfer_verified',
      endpoint: '/v1/billing/verify',
      inputPreview: `order=${orderId},plan=${planId}`,
      outputSummary: `tier=${plan.tier}`,
      success: true,
      durationMs: 0,
    });

    return jsonResponse(buildSuccess({
      verified: true,
      order_id: orderId,
      tenant_id: tenantId,
      plan_id: planId,
      tier: plan.tier,
      message: `Payment verified. Tenant ${tenantId} upgraded to ${plan.tier} tier.`,
    }, bc));
  } catch {
    return jsonResponse(buildError('BAD_REQUEST', 'Invalid request body', bc), 400);
  }
};
