/**
 * Stripe — Checkout / Webhook / Customer Portal routes.
 *
 * Lives alongside `routes/billing.ts` (which keeps Interac e-Transfer
 * semantics). This module handles Stripe-side billing only:
 *
 *  - POST /v1/billing/stripe/checkout   → create a Stripe Checkout Session
 *  - POST /v1/billing/stripe/webhook    → receive signed Stripe events
 *  - POST /v1/billing/stripe/portal     → Customer-managed portal link
 *  - GET  /v1/billing/stripe/order/:id  → order status (for success-page polling)
 *  - GET  /v1/billing/stripe/status     → authenticated diagnostics
 *
 * Persistence (Phase 1): all order state + tenant Stripe linkage lives in
 * QuillStorage (k3s: NodeSqliteStorage; CF Workers: D1Storage). Maps that
 * died on pod restart are gone. Only `processedStripeEvents` stays in-memory
 * because its operations are idempotent at the DB layer (UPSERT on tenants,
 * UNIQUE constraint on orders.stripe_checkout_session_id).
 */

import type { RouteHandler, PaymentReconciliationInsert } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';
import { nanoid } from 'nanoid';
import * as stripe from '../services/stripe.js';
import { recordTaxEvent, computeHst } from '../tax-ledger.js';
import type { StripeOrder } from '../types.js';

// ──────────────────────────────────────────────────────────────────────────
// Plan catalog (Stripe-purchasable tiers only — community/free are no-cost)
// ──────────────────────────────────────────────────────────────────────────

const STRIPE_PLANS: Record<
  string,
  { amount_cents: number; currency: string; product_name: string; description: string; tier: 'pro' | 'business'; interval_months: number }
> = {
  pro: {
    amount_cents: 5000,
    currency: 'cad',
    product_name: 'MapleSpike Pro',
    description: 'For independent researchers, journalists, and small teams',
    tier: 'pro',
    interval_months: 1,
  },
  business: {
    amount_cents: 20000,
    currency: 'cad',
    product_name: 'MapleSpike Business',
    description: 'For think tanks, NGOs, newsrooms, and lobbying firms',
    tier: 'business',
    interval_months: 1,
  },
};

// ──────────────────────────────────────────────────────────────────────────
// Webhook idempotency — Stripe occasionally retries on 5xx; we track event
// IDs in-memory to short-circuit exact replays. Operations are idempotent
// at the DB layer (UNIQUE on stripe_checkout_session_id, UPSERT on tenants)
// so a pod restart losing the Set is safe — at worst we re-process an event
// whose state changes are no-ops.
// ──────────────────────────────────────────────────────────────────────────

const processedStripeEvents = new Set<string>();
const MAX_PROCESSED_EVENTS = 10_000;

function isDuplicateEvent(eventId: string): boolean {
  if (processedStripeEvents.has(eventId)) return true;
  if (processedStripeEvents.size >= MAX_PROCESSED_EVENTS) {
    // FIFO rotation: drop oldest half so we don't grow forever.
    const dropCount = Math.floor(MAX_PROCESSED_EVENTS / 2);
    let i = 0;
    for (const id of processedStripeEvents) {
      if (i++ >= dropCount) break;
      processedStripeEvents.delete(id);
    }
  }
  processedStripeEvents.add(eventId);
  return false;
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function generateOrderId(): string {
  return `MS-${nanoid(6).toUpperCase()}`;
}

function buildBc(ctx: { tenant: any; requestId: string; startTime: number }): BuildContext {
  return { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
}

function appBaseUrl(): string {
  return process.env.APP_URL || process.env.MAPLESPIKE_PUBLIC_URL || 'http://localhost:8082';
}

function toTier(value: string): 'free' | 'pro' | 'business' | null {
  return value === 'free' || value === 'pro' || value === 'business' ? value : null;
}

/**
 * Extract a Stripe customer id from obj.customer which may be string OR
 * a Customer object with an .id field (rare on subscription events).
 */
function extractCustomerId(raw: unknown): string | undefined {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && 'id' in raw && typeof (raw as any).id === 'string') {
    return (raw as any).id as string;
  }
  return undefined;
}

/**
 * Cross-tenant authorization with orderId-match fallback.
 *
 * Strict path: Stripe customer already bound to the tenant in DB
 * (checkout.session.completed fired first and persisted the binding).
 *
 * Fallback path: event carries an orderId we created for THIS tenant that
 * already references the same Stripe customer. orderId is opaque to anyone
 * except our checkout handler, so its presence + DB match proves the event
 * originated from a session WE created. Guards against Stripe event-delivery
 * reordering (where subscription.* events arrive before
 * checkout.session.completed on rare retries / batching).
 *
 * On a successful fallback authorization we persist the binding so future
 * events without orderId succeed via the strict path.
 */
async function authorizeEvent(
  tenantId: string | null,
  customerId: string | undefined,
  orderId: string | null,
  db: import('../types.js').QuillStorage,
): Promise<boolean> {
  if (!tenantId || !customerId) return false;
  const bound = await db.getTenantStripeCustomerId(tenantId);
  if (bound === customerId) return true;
  if (orderId) {
    const order = await db.getStripeOrderById(orderId);
    if (order && order.tenant_id === tenantId && order.stripe_customer_id === customerId) {
      // Persist the binding for future strict-path checks.
      await db.updateTenantStripe(tenantId, { stripeCustomerId: customerId });
      return true;
    }
  }
  return false;
}

/**
 * Stripe customer id of a tenant, sourced from DB.
 */
async function getCustomerIdForTenant(
  tenantId: string,
  db: import('../types.js').QuillStorage,
): Promise<string | undefined> {
  const c = await db.getTenantStripeCustomerId(tenantId);
  return c ?? undefined;
}

// pino logger — the api-server already imports pino at root; mirror its pattern
// so server-side error logging is consistent. Falls back to console.error in
// environments where pino isn't initialized (test paths).
import pino from 'pino';
const webhookLog = pino({
  level: process.env.QUILL_LOG_LEVEL || 'info',
  name: 'stripe-webhook',
}).child({ component: 'stripe-billing' });

// ──────────────────────────────────────────────────────────────────────────
// POST /v1/billing/stripe/checkout
// ──────────────────────────────────────────────────────────────────────────

export const stripeCheckoutHandler: RouteHandler = async (request, ctx) => {
  const bc = buildBc(ctx);
  if (!stripe.getStripeStatus().configured) {
    return jsonResponse(
      buildError('STRIPE_NOT_CONFIGURED', 'Stripe is not configured on this server (STRIPE_SECRET_KEY missing).', bc),
      503,
    );
  }

  let body: { plan_id?: string; customer_id?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse(buildError('BAD_REQUEST', 'Invalid request body — expected { plan_id: "pro" | "business" }', bc), 400);
  }
  const planId = String(body.plan_id ?? '');
  const plan = STRIPE_PLANS[planId];
  if (!plan) {
    return jsonResponse(
      buildError(
        'INVALID_PLAN',
        'Stripe checkout is available for Pro and Business plans. Community / Free are no-cost.',
        bc,
      ),
      400,
    );
  }

  const tenantId = ctx.tenant.id;
  const orderId = generateOrderId();
  const nowUnix = Math.floor(Date.now() / 1000);
  const expiresAt = nowUnix + 30 * 60; // 30 min to complete checkout

  try {
    // Reuse the tenant's existing Stripe customer if one is bound (DB-sourced).
    let customerId = body.customer_id || (await getCustomerIdForTenant(tenantId, ctx.db));
    if (!customerId) {
      const customer = await stripe.findOrCreateCustomer({ tenantId });
      customerId = customer.id;
      await ctx.db.updateTenantStripe(tenantId, { stripeCustomerId: customerId });
    }

    const baseUrl = appBaseUrl().replace(/\/$/, '');
    // #811: GST/HST is ONLY added once the operator flips GST_HST_REGISTERED=true.
    // While unregistered the charged amount is exactly the plan price — charging
    // tax unregistered is non-compliant (CRA small-supplier rules).
    const tax = computeHst(plan.amount_cents);
    const session = await stripe.createCheckoutSession({
      customerId,
      amountCents: tax.totalCents,
      currency: plan.currency,
      productName: plan.product_name,
      description: plan.description,
      planId: plan.tier,
      tenantId,
      orderId,
      intervalMonths: plan.interval_months,
      successUrl: `${baseUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}&order=${orderId}`,
      cancelUrl: `${baseUrl}/pricing?checkout=cancel&order=${orderId}`,
      expiresAtUnix: expiresAt,
      // Embedded Checkout (the portal mounts Stripe's form in-page). The session
      // then carries client_secret instead of a redirect url, and returns via
      // return_url — success_url/cancel_url are invalid alongside it.
      ...(body.embedded === true
        ? {
            uiMode: 'embedded' as const,
            returnUrl: `${baseUrl}/checkout/return?session_id={CHECKOUT_SESSION_ID}&order=${orderId}`,
          }
        : {}),
    });

    // Persist the order. UNIQUE(stripe_checkout_session_id) is the authoritative
    // dedupe boundary — a duplicate INSERT will throw and we'll surface that
    // as a 502 to the caller (it shouldn't happen because we just generated
    // a new session, but the constraint guarantees correctness).
    try {
      await ctx.db.createStripeOrder({
        order_id: orderId,
        tenant_id: tenantId,
        plan_id: plan.tier,
        amount_cents: plan.amount_cents,
        currency: plan.currency.toUpperCase(),
        stripe_checkout_session_id: session.id,
        status: 'pending',
        expires_at: expiresAt,
      });
    } catch (e) {
      webhookLog.warn({ err: (e as Error).message, orderId, sessionId: session.id }, 'createStripeOrder threw (likely UNIQUE collision)');
      // Don't fail the user-visible flow; the order is recoverable from
      // the checkout.session.completed webhook's metadata (orderId).
    }

    return jsonResponse(
      buildSuccess(
        {
          order_id: orderId,
          ...(session.client_secret ? { client_secret: session.client_secret } : {}),
          plan_id: plan.tier,
          amount_cents: tax.totalCents,
          amount_before_tax_cents: plan.amount_cents,
          tax: { registered: tax.registered, rate: tax.rate, tax_cents: tax.taxCents },
          currency: plan.currency.toUpperCase(),
          checkout_url: session.url,
          stripe_checkout_session_id: session.id,
          expires_at: expiresAt,
          instructions: 'Open checkout_url in a browser to complete payment on Stripe.',
        },
        bc,
      ),
    );
  } catch (e) {
    if (e instanceof stripe.StripeApiError) {
      // Server-side log retains full Stripe body for debugging; client-side
      // error is intentionally generic so we don't echo provider hints,
      // account IDs, or request-format probes back to callers.
      webhookLog.error(
        { httpStatus: e.httpStatus, body: e.responseBody.slice(0, 500) },
        'stripe checkout api error',
      );
      return jsonResponse(
        buildError('PAYMENT_PROVIDER_ERROR', `Payment provider returned ${e.httpStatus}. Please try again.`, bc),
        502,
      );
    }
    if (e instanceof stripe.StripeError) {
      webhookLog.warn({ code: e.code, msg: e.message }, 'stripe checkout non-api error');
      return jsonResponse(buildError(e.code, e.message, bc), 500);
    }
    webhookLog.error({ err: (e as Error).message }, 'stripe checkout failed');
    return jsonResponse(buildError('CHECKOUT_FAILED', 'Failed to create Stripe Checkout session.', bc), 500);
  }
};

// ──────────────────────────────────────────────────────────────────────────
// POST /v1/billing/stripe/webhook  — Stripe → our server, NO auth header,
// signature verified by HMAC. Registered via route that is authExempt.
// ──────────────────────────────────────────────────────────────────────────

export const stripeWebhookHandler: RouteHandler = async (request, _ctx) => {
  const bc: BuildContext = {
    tenant: { id: 'anon', name: 'Anonymous', emailVerified: false, tier: 'free', isActive: true, journalismMode: false },
    requestId: 'stripe-webhook',
    startTime: Date.now(),
  };

  const sig = request.headers.get('Stripe-Signature');
  const rawBody = await request.text();

  let event: stripe.VerifiedStripeEvent;
  try {
    event = stripe.verifyWebhookSignature(rawBody, sig);
  } catch (e) {
    if (e instanceof stripe.WebhookVerificationError) {
      return jsonResponse(buildError(e.code, 'Webhook signature verification failed.', bc), 400);
    }
    return jsonResponse(buildError('WEBHOOK_IDENTITY_ERROR', (e as Error).message, bc), 400);
  }

  // Idempotency: short-circuit replays (Stripe retries on 5xx, but also
  // for at-least-once semantics). DB writes below are idempotent via
  // UPSERT semantics so a cache miss after pod restart is safe.
  if (isDuplicateEvent(event.id)) {
    return jsonResponse(
      buildSuccess(
        { event_id: event.id, type: event.type, processed: true, action: 'duplicate' },
        bc,
      ),
    );
  }

  // AUDIT-LOG-3 — write a durable payment_reconciliations row for the
  // event id BEFORE handler dispatch. UNIQUE(transaction_uid) protects
  // against duplicate writes from concurrent retries; DB-layer
  // dedupe supersedes the in-memory Set above.
  try {
    const objForReconciliation = event.data.object as Record<string, any>;
    const reconciliation: PaymentReconciliationInsert = {
      transactionUid: event.id,
      channel: 'stripe',
      orderId: stripe.orderIdFromMetadata(objForReconciliation?.metadata) ?? undefined,
      amountCents: typeof objForReconciliation?.amount_total === 'number' ? objForReconciliation.amount_total : undefined,
      reference: typeof objForReconciliation?.id === 'string' ? objForReconciliation.id : undefined,
    };
    await _ctx.db.createPaymentReconciliation(reconciliation);
  } catch (e) {
    if (e instanceof Error && /UNIQUE|unique/i.test(e.message)) {
      return jsonResponse(
        buildSuccess({ event_id: event.id, type: event.type, processed: true, action: 'duplicate_db' }, bc),
      );
    }
    webhookLog.warn({ err: (e as Error).message, eventId: event.id }, 'createPaymentReconciliation failed; continuing');
  }

  const result: { event_id: string; type: string; processed: boolean; action: string | null } = {
    event_id: event.id,
    type: event.type,
    processed: false,
    action: null,
  };

  try {
    const obj = event.data.object as Record<string, any>;

    switch (event.type) {
      case 'checkout.session.completed': {
        const tenantId = stripe.tenantIdFromMetadata(obj.metadata);
        const planId = stripe.planIdFromMetadata(obj.metadata);
        const orderId = stripe.orderIdFromMetadata(obj.metadata);
        const customerId = extractCustomerId(obj.customer);
        const subscriptionId = typeof obj.subscription === 'string' ? obj.subscription : undefined;

        if (tenantId && planId) {
          const validTier = toTier(planId);
          if (!validTier) {
            result.processed = true;
            result.action = 'rejected_invalid_plan';
            webhookLog.warn({ tenantId, planId, type: event.type }, 'rejected: invalid planId');
            break;
          }
          // Persist the binding so future subscription.* events pass strict auth.
          await _ctx.db.updateTenantStripe(tenantId, {
            tier: validTier,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
          });

          if (orderId) {
            const existing = await _ctx.db.getStripeOrderById(orderId);
            if (existing) {
              await _ctx.db.updateStripeOrder(orderId, {
                status: 'paid',
                paid_at: Math.floor(Date.now() / 1000),
                stripe_customer_id: customerId ?? existing.stripe_customer_id,
                stripe_subscription_id: subscriptionId ?? existing.stripe_subscription_id,
              });
            } else if (customerId) {
              // Stripe fired before our checkout call returned and persisted
              // the order — back-fill it from the event payload. Uses
              // INSERT (UNIQUE on stripe_checkout_session_id protects
              // against duplicates).
              try {
                await _ctx.db.createStripeOrder({
                  order_id: orderId,
                  tenant_id: tenantId,
                  plan_id: validTier,
                  amount_cents: obj.amount_total ?? 0,
                  currency: (obj.currency ?? 'cad').toUpperCase(),
                  stripe_checkout_session_id: obj.id,
                  status: 'paid',
                  expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
                });
                await _ctx.db.updateStripeOrder(orderId, {
                  paid_at: Math.floor(Date.now() / 1000),
                  stripe_customer_id: customerId,
                  stripe_subscription_id: subscriptionId,
                });
              } catch (e) {
                webhookLog.warn({ err: (e as Error).message, orderId }, 'back-fill order failed (likely UNIQUE collision)');
              }
            }
          }
          result.processed = true;
          result.action = 'tier_upgraded';
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.resumed':
      case 'customer.subscription.paused': {
        const tenantId = stripe.tenantIdFromMetadata(obj.metadata);
        const planId = stripe.planIdFromMetadata(obj.metadata);
        const status = obj.status as stripe.StripeSubscriptionStatus;
        const customerId = extractCustomerId(obj.customer);
        const orderId = stripe.orderIdFromMetadata(obj.metadata);
        const currentPeriodEnd =
          typeof obj.current_period_end === 'number' ? obj.current_period_end : undefined;

        // Defense-in-depth + delivery-reorder tolerance: see authorizeEvent.
        if (!tenantId || !planId || !(await authorizeEvent(tenantId, customerId, orderId, _ctx.db))) {
          result.processed = true;
          result.action = 'rejected_cross_tenant';
          webhookLog.warn(
            { tenantId, customerId, planId, orderId, type: event.type },
            'rejected subscription event: customer not bound to tenant',
          );
          break;
        }

        const validTier = toTier(planId);
        if (!validTier) {
          result.processed = true;
          result.action = 'rejected_invalid_plan';
          webhookLog.warn({ tenantId, planId, type: event.type }, 'rejected: invalid planId');
          break;
        }

        const mapped = stripe.tierFromSubscriptionStatus({ status, planId: validTier });
        await _ctx.db.updateTenantStripe(tenantId, {
          tier: mapped.tier,
          stripeSubscriptionStatus: status,
          stripeCurrentPeriodEnd: currentPeriodEnd,
          stripeSubscriptionId: typeof obj.id === 'string' ? obj.id : undefined,
        });

        // Reflect status on any matching DB orders. Snapshotted IDs avoid
        // mutating-during-iteration undefined behaviour if QuillStorage
        // implementations iterate internally during updateStripeOrder.
        if (typeof obj.id === 'string') {
          const subId = obj.id;
          // We don't have a list-by-tenant method yet; the orderId fallback
          // covers our schema (only one open order per active subscription).
          if (orderId) {
            const order = await _ctx.db.getStripeOrderById(orderId);
            if (order && order.tenant_id === tenantId && order.stripe_subscription_id === undefined) {
              await _ctx.db.updateStripeOrder(orderId, { stripe_subscription_id: subId });
            }
          }
        }
        result.processed = true;
        result.action = mapped.subscriptionStatus === 'cancelled' ? 'tier_downgraded' : 'tier_renewed';
        break;
      }

      case 'customer.subscription.deleted': {
        const tenantId = stripe.tenantIdFromMetadata(obj.metadata);
        const customerId = extractCustomerId(obj.customer);
        const orderId = stripe.orderIdFromMetadata(obj.metadata);

        if (!tenantId || !(await authorizeEvent(tenantId, customerId, orderId, _ctx.db))) {
          result.processed = true;
          result.action = 'rejected_cross_tenant';
          webhookLog.warn(
            { tenantId, customerId, orderId, type: event.type },
            'rejected subscription.deleted: customer not bound to tenant',
          );
          break;
        }

        await _ctx.db.updateTenantStripe(tenantId, {
          tier: 'free',
          stripeSubscriptionStatus: 'canceled',
          stripeSubscriptionId: undefined,
        });
        if (orderId) {
          const order = await _ctx.db.getStripeOrderById(orderId);
          if (order && order.tenant_id === tenantId) {
            await _ctx.db.updateStripeOrder(orderId, {
              status: 'cancelled',
              cancelled_at: Math.floor(Date.now() / 1000),
            });
          }
        }
        result.processed = true;
        result.action = 'tier_cancelled';
        break;
      }

      case 'invoice.payment_succeeded': {
        // Renewal confirmation — tier is already set by subscription.updated.
        // #811: this is also the canonical charge event for the tax ledger —
        // subscriptions bill via invoices, so recording checkout sessions here
        // too would double-count the first period.
        try {
          const amountTotal = typeof obj.amount_paid === 'number' ? obj.amount_paid : undefined;
          if (amountTotal !== undefined && amountTotal > 0) {
            const ledgerResult = await recordTaxEvent(_ctx.db, {
              eventId: event.id,
              entryType: 'charge',
              amountCents: amountTotal,
              currency: (obj.currency ?? 'cad').toUpperCase(),
              tenantId: stripe.tenantIdFromMetadata(obj.metadata) ?? null,
            });
            result.action = `renewal_logged;tax_${ledgerResult}`;
          } else {
            result.action = 'renewal_logged';
          }
        } catch (e) {
          webhookLog.warn({ err: (e as Error).message, eventId: event.id }, 'tax ledger charge recording failed');
          result.action = 'renewal_logged;tax_error';
        }
        result.processed = true;
        break;
      }

      case 'charge.refunded': {
        // #811: net refunds out of taxable revenue. Idempotent by event ID.
        try {
          const refundedCents = typeof obj.amount_refunded === 'number' ? obj.amount_refunded : undefined;
          if (refundedCents !== undefined && refundedCents > 0) {
            const ledgerResult = await recordTaxEvent(_ctx.db, {
              eventId: event.id,
              entryType: 'refund',
              amountCents: -refundedCents,
              currency: (obj.currency ?? 'cad').toUpperCase(),
            });
            result.action = `refund_${ledgerResult}`;
          } else {
            result.action = 'refund_skipped';
          }
        } catch (e) {
          webhookLog.warn({ err: (e as Error).message, eventId: event.id }, 'tax ledger refund recording failed');
          result.action = 'refund_error';
        }
        result.processed = true;
        break;
      }

      case 'invoice.payment_failed': {
        // Surface via subscription.updated; Stripe will retry; if all
        // retries fail, customer.subscription.deleted fires.
        result.processed = true;
        result.action = 'payment_failed_logged';
        break;
      }

      default: {
        result.processed = true;
        result.action = 'unhandled';
        break;
      }
    }
  } catch (e) {
    webhookLog.error({ err: (e as Error).message, eventId: event.id }, 'webhook processing error');
    return jsonResponse(
      buildError('WEBHOOK_PROCESSING_ERROR', `Failed to process ${event.type}: ${(e as Error).message}`, bc),
      500,
    );
  }

  return jsonResponse(buildSuccess(result, bc));
};

// ──────────────────────────────────────────────────────────────────────────
// GET /v1/billing/stripe/order/:id  — for checkout success-page polling
// ──────────────────────────────────────────────────────────────────────────

export const stripeOrderStatusHandler: RouteHandler = async (request, ctx, params) => {
  const bc = buildBc(ctx);
  // RouteContext was historically fed either an object (route-matcher puts named
  // captures here as `params.id`) or an array (legacy `:id`-style where
  // `params[0]` is the first capture). Accept both so tests + production agree.
  const orderId = String((params as any)?.id ?? params?.[0] ?? '');
  const order: StripeOrder | null = await ctx.db.getStripeOrderById(orderId);

  if (!order) {
    return jsonResponse(buildError('NOT_FOUND', `Order ${orderId || '<empty>'} not found.`, bc), 404);
  }
  // Tenant isolation — only the order owner may read it.
  if (order.tenant_id !== ctx.tenant.id) {
    return jsonResponse(buildError('FORBIDDEN', 'You do not have access to this order.', bc), 403);
  }

  return jsonResponse(
    buildSuccess(
      {
        order_id: order.order_id,
        plan_id: order.plan_id,
        amount_cents: order.amount_cents,
        currency: order.currency,
        status: order.status,
        created_at: order.created_at,
        expires_at: order.expires_at,
        stripe_checkout_session_id: order.stripe_checkout_session_id,
        stripe_subscription_id: order.stripe_subscription_id ?? null,
      },
      bc,
    ),
  );
};

// ──────────────────────────────────────────────────────────────────────────
// POST /v1/billing/stripe/portal  — Customer-managed billing portal
// ──────────────────────────────────────────────────────────────────────────

export const stripePortalHandler: RouteHandler = async (request, ctx) => {
  const bc = buildBc(ctx);

  if (!stripe.getStripeStatus().configured) {
    return jsonResponse(
      buildError('STRIPE_NOT_CONFIGURED', 'Stripe is not configured on this server.', bc),
      503,
    );
  }

  const customerId = await getCustomerIdForTenant(ctx.tenant.id, ctx.db);
  if (!customerId) {
    return jsonResponse(
      buildError(
        'NO_STRIPE_CUSTOMER',
        'No Stripe customer record found for this tenant. Subscribe to a paid plan first.',
        bc,
      ),
      404,
    );
  }

  try {
    const baseUrl = appBaseUrl().replace(/\/$/, '');
    const session = await stripe.createPortalSession({
      customerId,
      returnUrl: `${baseUrl}/dashboard/billing?portal=return`,
    });

    return jsonResponse(
      buildSuccess(
        {
          portal_url: session.url,
          expires_in_seconds: 3600,
        },
        bc,
      ),
    );
  } catch (e) {
    if (e instanceof stripe.StripeApiError) {
      webhookLog.error(
        { httpStatus: e.httpStatus, body: e.responseBody.slice(0, 500) },
        'stripe portal api error',
      );
      return jsonResponse(buildError('PAYMENT_PROVIDER_ERROR', `Payment provider returned ${e.httpStatus}.`, bc), 502);
    }
    webhookLog.error({ err: (e as Error).message }, 'stripe portal failed');
    return jsonResponse(buildError('PORTAL_FAILED', 'Failed to create Stripe Customer Portal session.', bc), 500);
  }
};

// ──────────────────────────────────────────────────────────────────────────
// GET /v1/billing/stripe/status  — authenticated diagnostics. Intentionally
// NOT authExempt: account fingerprints must not be served to anonymous callers.
// Operators diagnose via dev tools / kubectl logs.
// ──────────────────────────────────────────────────────────────────────────


// ──────────────────────────────────────────────────────────────────────────
// POST /v1/billing/reconcile-expiry — STRIPE-1 cron handler. Shared-secret
// auth via X-Billing-Secret (also used by /v1/billing/verify et al). The
// k3s CronJob in quill/k8s/kanban-cronjob.yaml triggers this hourly.
// Returns { processed, downgraded: [{tenant_id, from, to}, ...] }.
// ──────────────────────────────────────────────────────────────────────────

export const reconcileExpiryHandler: RouteHandler = async (request, ctx) => {
  const bc = buildBc(ctx);
  const secret = request.headers.get('X-Billing-Secret') || request.headers.get('x-billing-secret');
  const expected = process.env.QUILL_BILLING_SECRET;
  if (!expected || secret !== expected) {
    return jsonResponse(buildError('FORBIDDEN', 'Invalid or missing X-Billing-Secret', bc), 403);
  }

  const nowUnix = Math.floor(Date.now() / 1000);
  const expired = await ctx.db.findTenantsForTierExpiry(nowUnix);
  const downgraded: Array<{ tenant_id: string; from: string; to: 'free' }> = [];

  for (const e of expired) {
    try {
      await ctx.db.updateTenantStripe(e.tenant_id, {
        tier: 'free',
        stripeSubscriptionStatus: 'canceled',
      });
      await ctx.db.logAudit({
        tenantId: e.tenant_id,
        operation: 'billing_tier_expired',
        endpoint: '/v1/billing/reconcile-expiry',
        inputPreview: `period_end=${e.stripe_current_period_end}`,
        outputSummary: `tier=${e.tier}->free`,
        success: true,
        durationMs: 0,
      });
      downgraded.push({ tenant_id: e.tenant_id, from: e.tier, to: 'free' });
    } catch (err) {
      webhookLog.error({ err: (err as Error).message, tenantId: e.tenant_id }, 'reconcile-expiry: tenant downgrade failed');
    }
  }

  return jsonResponse(buildSuccess({ processed: expired.length, downgraded }, bc));
};

export const stripeStatusHandler: RouteHandler = async (_request, ctx) => {
  const bc = buildBc(ctx);
  const s = stripe.getStripeStatus();
  const t = ctx.tenant;
  return jsonResponse(
    buildSuccess(
      {
        // Operational booleans only. NO fingerprint / key / account-id exposed.
        stripe_configured: s.configured,
        stripe_webhook_configured: s.webhookConfigured,
        tenant_id: t.id ?? 'anon',
        // ctx.tenant.tier is loaded from DB on every request via authenticate(),
        // so webhook-driven upgrades take effect on the very next API call.
        assigned_tier: t.tier ?? 'free',
        stripe_customer_bound: !!t.stripeCustomerId,
        stripe_subscription_active:
          t.stripeSubscriptionStatus === 'active' || t.stripeSubscriptionStatus === 'trialing',
        stripe_current_period_end: t.stripeCurrentPeriodEnd ?? null,
      },
      bc,
    ),
  );
};
