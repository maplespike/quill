/**
 * Billing Routes
 *
 * Handles order creation, status checking, and payment reconciliation for
 * Interac e-Transfer payments.
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
};

const PLANS: Record<string, Plan> = {
  free: {
    plan_id: 'free',
    name: 'Free',
    price_cents: 0,
    credits_per_month: 1000,
    rate_limit_per_min: 10,
    features: ['Basic MCP tools', 'Public data'],
  },
  pro: {
    plan_id: 'pro',
    name: 'Pro',
    price_cents: 5000,
    credits_per_month: 50000,
    rate_limit_per_min: 60,
    features: ['All MCP tools', 'RAG', 'Entity resolution', 'API access'],
  },
};

// ─── Utilities ───────────────────────────────────────────────────────────

function generateOrderId(): string {
  return `MS-${nanoid(6).toUpperCase()}`;
}

function signOrder(orderId: string, tenantId: string): string {
  const secret = process.env.MAPLESPIKE_BILLING_SECRET || 'dev-secret';
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
  if (secret !== process.env.MAPLESPIKE_BILLING_SECRET) {
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

    if (plan_id !== 'free' && plan_id !== 'pro') {
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
        email: process.env.MAPLESPIKE_BILLING_EMAIL || 'billing@maplespike.lan',
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

  // In-memory mock - replace with database query
  return jsonResponse(buildSuccess({
    order_id: orderId,
    status: 'pending',
    created_at: Math.floor(Date.now() / 1000),
  }, bc));
};

export const billingReconcileHandler: RouteHandler = async (request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  const secret = request.headers.get('X-Billing-Secret');
  if (secret !== process.env.MAPLESPIKE_BILLING_SECRET) {
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

export const billingVerifyHandler: RouteHandler = async (request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  const secret = request.headers.get('X-Billing-Secret');
  if (secret !== process.env.MAPLESPIKE_BILLING_SECRET) {
    return jsonResponse(buildError('UNAUTHORIZED', 'Unauthorized', bc), 401);
  }

  // Payment verification will be added later
  return jsonResponse(buildSuccess({
    verified: false,
    message: 'Payment verification not yet implemented',
  }, bc));
};