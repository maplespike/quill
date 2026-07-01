/**
 * Billing Routes
 *
 * Handles order creation, status checking, and payment reconciliation for
 * Interac e-Transfer payments.
 *
 * Uses NodeSqliteStorage (node:sqlite built-in) - no Drizzle ORM.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

const billing = new Hono();

// ─── Schemas ─────────────────────────────────────────────────────────────

const createOrderSchema = z.object({
  plan_id: z.enum(['free', 'pro']),
});

// ─── Plan Definitions ─────────────────────────────────────────────────────

const PLANS = {
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
} as const;

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

export const billingPlansHandler = billing.get('/plans', (c) => {
  return c.json({
    plans: Object.values(PLANS),
    currency: 'CAD',
  });
});

export const billingSeedPlansHandler = billing.post('/seed-plans', (c) => {
  const secret = c.req.header('X-Billing-Secret');
  if (secret !== process.env.MAPLESPIKE_BILLING_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // In NodeSqliteStorage, plans are not persisted - they're defined in code
  // This endpoint is for future migration to persistent plans
  return c.json({
    message: 'Plans are defined in code (PLANS constant)',
    plans: Object.values(PLANS),
  });
});

export const billingOrderHandler = billing.post(
  '/orders',
  zValidator('json', createOrderSchema),
  async (c) => {
    const { plan_id } = c.req.valid('json');
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing Authorization header' }, 401);
    }

    // Extract tenant_id from auth (simplified - in production, use full auth flow)
    const token = authHeader.slice(7);
    const tenantId = `tenant_${token.slice(0, 8)}`;

    const plan = PLANS[plan_id];
    if (!plan) {
      return c.json({ error: 'Invalid plan' }, 400);
    }

    const orderId = generateOrderId();
    const signature = signOrder(orderId, tenantId);
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + 15 * 60; // 15 minutes

    // In-memory order storage (replace with database in production)
    // For now, return order details without persistence
    return c.json({
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
    });
  }
);

export const billingOrderStatusHandler = billing.get('/orders/:id', (c) => {
  const orderId = c.req.param('id');
  // In-memory mock - replace with database query
  return c.json({
    order_id: orderId,
    status: 'pending',
    created_at: Math.floor(Date.now() / 1000),
  });
});

export const billingReconcileHandler = billing.post('/reconcile', (c) => {
  const secret = c.req.header('X-Billing-Secret');
  if (secret !== process.env.MAPLESPIKE_BILLING_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // IMAP poller will be added later with proper database integration
  return c.json({
    processed: 0,
    credited: 0,
    failed: 0,
    errors: [],
    message: 'IMAP reconciliation not yet implemented',
  });
});

export const billingVerifyHandler = billing.post('/verify', (c) => {
  const secret = c.req.header('X-Billing-Secret');
  if (secret !== process.env.MAPLESPIKE_BILLING_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Payment verification will be added later
  return c.json({
    verified: false,
    message: 'Payment verification not yet implemented',
  });
});

export default billing;