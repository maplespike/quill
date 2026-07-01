/**
 * Billing Routes
 *
 * Handles order creation, status checking, and payment reconciliation for
 * Interac e-Transfer payments.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import crypto from 'crypto';
import { db } from '../db.js';
import {
  users,
  plans,
  orders,
  payment_reconciliations,
} from '@maplespike/database/schema';
import { eq, and, sql } from 'drizzle-orm';

const billing = new Hono();

// ─── Schemas ─────────────────────────────────────────────────────────────

const createOrderSchema = z.object({
  plan_id: z.enum(['free', 'pro']),
});

// ─── Routes ───────────────────────────────────────────────────────────────

/**
 * POST /v1/billing/orders
 *
 * Create a new order for plan upgrade.
 *
 * Request body:
 * {
 *   "plan_id": "pro"
 * }
 *
 * Response:
 * {
 *   "order_id": "MS-123456",
 *   "tenant_id": "tenant_abc123",
 *   "plan_id": "pro",
 *   "amount_cents": 5000,
 *   "currency": "CAD",
 *   "status": "pending",
 *   "expires_at": 1751347200,
 *   "payment_instructions": {
 *     "email": "billing@maplespike.lan",
 *     "reference": "MS-123456",
 *     "amount": "$50.00"
 *   }
 * }
 */
billing.post('/orders', async (c) => {
  const tenantId = c.get('tenantId'); // Set by auth middleware

  try {
    const body = await c.req.json();
    const { plan_id } = createOrderSchema.parse(body);

    // Get plan details
    const plan = await db
      .select()
      .from(plans)
      .where(eq(plans.planId, plan_id))
      .limit(1);

    if (!plan.length) {
      return c.json({ error: 'Plan not found' }, 404);
    }

    const planData = plan[0];

    // Check for existing pending order
    const existingOrder = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          eq(orders.planId, plan_id),
          eq(orders.status, 'pending'),
          sql`${orders.expiresAt} > ${Math.floor(Date.now() / 1000)}`
        )
      )
      .limit(1);

    if (existingOrder.length) {
      return c.json({
        order_id: existingOrder[0].orderId,
        status: existingOrder[0].status,
        payment_instructions: {
          email: process.env.MAPLESPIKE_BILLING_EMAIL || 'billing@maplespike.lan',
          reference: existingOrder[0].orderId,
          amount: `$${(existingOrder[0].amountCents / 100).toFixed(2)}`,
        },
      });
    }

    // Generate order ID (MS-XXXXXX format)
    const orderId = `MS-${nanoid(6).toUpperCase()}`;

    // Order expires in 30 days
    const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

    // Create order
    await db.insert(orders).values({
      orderId,
      tenantId,
      planId: plan_id,
      amountCents: planData.priceCents,
      currency: planData.currency,
      paymentMethod: 'etransfer',
      status: 'pending',
      expiresAt,
    });

    return c.json({
      order_id: orderId,
      tenant_id: tenantId,
      plan_id: plan_id,
      amount_cents: planData.priceCents,
      currency: planData.currency,
      status: 'pending',
      expires_at: expiresAt,
      payment_instructions: {
        email: process.env.MAPLESPIKE_BILLING_EMAIL || 'billing@maplespike.lan',
        reference: orderId,
        amount: `$${(planData.priceCents / 100).toFixed(2)}`,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request body', details: error.errors }, 400);
    }
    console.error('Billing order creation error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /v1/billing/orders/:id
 *
 * Check order status.
 */
billing.get('/orders/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const orderId = c.req.param('id');

  try {
    const order = await db
      .select()
      .from(orders)
      .where(and(eq(orders.orderId, orderId), eq(orders.tenantId, tenantId)))
      .limit(1);

    if (!order.length) {
      return c.json({ error: 'Order not found' }, 404);
    }

    const orderData = order[0];

    return c.json({
      order_id: orderData.orderId,
      status: orderData.status,
      plan_id: orderData.planId,
      amount_cents: orderData.amountCents,
      currency: orderData.currency,
      created_at: orderData.createdAt,
      paid_at: orderData.paidAt,
      expires_at: orderData.expiresAt,
    });
  } catch (error) {
    console.error('Billing order status error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /v1/billing/reconcile
 *
 * Manual reconciliation endpoint (admin only).
 * Triggers IMAP poller manually.
 */
billing.post('/reconcile', async (c) => {
  // Admin check via header
  const adminSecret = c.req.header('X-Billing-Secret');
  if (adminSecret !== process.env.MAPLESPIKE_BILLING_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // Import and run IMAP poller (will be implemented separately)
    const { pollPayments } = await import('../billing/imap-poller.js');
    const result = await pollPayments();

    return c.json({
      processed: result.processed,
      credited: result.credited,
      failed: result.failed,
    });
  } catch (error) {
    console.error('Billing reconcile error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /v1/billing/seed-plans
 *
 * Seed plans table with Free, Pro, Enterprise tiers.
 * Run once during migration.
 */
billing.post('/seed-plans', async (c) => {
  const adminSecret = c.req.header('X-Billing-Secret');
  if (adminSecret !== process.env.MAPLESPIKE_BILLING_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const plansToSeed = [
      {
        planId: 'free',
        name: 'Free',
        priceCents: 0,
        currency: 'CAD',
        creditsPerMonth: 1000,
        rateLimitPerMin: 10,
        features: JSON.stringify([
          'Basic MCP tools',
          'Public data access',
          '10 req/min',
        ]),
      },
      {
        planId: 'pro',
        name: 'Pro',
        priceCents: 5000,
        currency: 'CAD',
        creditsPerMonth: 50000,
        rateLimitPerMin: 60,
        features: JSON.stringify([
          'All MCP tools',
          'RAG support',
          'Entity resolution',
          'API access',
          '60 req/min',
        ]),
      },
      {
        planId: 'enterprise',
        name: 'Enterprise',
        priceCents: 0, // Custom pricing
        currency: 'CAD',
        creditsPerMonth: 999999,
        rateLimitPerMin: 999,
        features: JSON.stringify([
          'Unlimited credits',
          'Dedicated support',
          'SLA guarantee',
          'White-label',
          'Private data sources',
        ]),
      },
    ];

    let seeded = 0;
    for (const plan of plansToSeed) {
      const existing = await db
        .select()
        .from(plans)
        .where(eq(plans.planId, plan.planId))
        .limit(1);

      if (!existing.length) {
        await db.insert(plans).values(plan);
        seeded++;
      }
    }

    return c.json({ seeded });
  } catch (error) {
    console.error('Seed plans error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default billing;