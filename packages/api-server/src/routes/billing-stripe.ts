/**
 * MapleSpike — Stripe Billing Routes
 *
 * POST /v1/billing/stripe/checkout — Create Stripe Checkout Session
 * POST /v1/billing/stripe/webhook — Handle Stripe webhook events
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';
import { validateBody } from '../validate.js';
import { billingStore } from './billing-store.js';
import { PLANS } from './billing.js';

export const stripeCheckoutHandler: RouteHandler = async (request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };

  try {
    const body = await request.json() as Record<string, unknown>;
    const errs = validateBody(body, {
      planId: { type: 'string', required: true, minLength: 1 },
      successUrl: { type: 'string', maxLength: 2000 },
      cancelUrl: { type: 'string', maxLength: 2000 },
    });
    if (errs.length > 0) {
      return jsonResponse(buildError('VALIDATION_ERROR', errs.map((e) => e.message).join('; '), bc), 400);
    }
    const plan = PLANS.find((p) => p.id === body.planId);
    if (!plan) {
      return jsonResponse(buildError('INVALID_PLAN', `Plan "${body.planId}" not found. Available: ${PLANS.map((p) => p.id).join(', ')}`, bc), 400);
    }

    const sessionId = 'cs_' + crypto.randomUUID().replace(/-/g, '');
    const sessionUrl = `https://checkout.stripe.com/pay/${sessionId}`;

    billingStore.checkoutSessions.push({
      id: sessionId,
      tenantId: ctx.tenant.id,
      planId: plan.id,
      status: 'pending',
      url: sessionUrl,
      amount: plan.price,
      currency: plan.currency,
      createdAt: new Date().toISOString(),
    });

    return jsonResponse(buildSuccess({
      sessionId,
      url: sessionUrl,
      amount: plan.price,
      currency: plan.currency,
      planId: plan.id,
      planName: plan.name,
      mode: 'payment',
      status: 'pending',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    }, bc));
  } catch {
    return jsonResponse(buildError('BAD_REQUEST', 'Invalid request body. Expected { planId, successUrl, cancelUrl }', bc), 400);
  }
};

export const stripeWebhookHandler: RouteHandler = async (request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };

  try {
    const body = await request.json() as Record<string, unknown>;
    const errs = validateBody(body, {
      type: { type: 'string', required: true, minLength: 1 },
      data: { type: 'object', required: true },
    });
    if (errs.length > 0) {
      return jsonResponse(buildError('VALIDATION_ERROR', errs.map((e) => e.message).join('; '), bc), 400);
    }

    const eventType = body.type as string;
    const eventData = body.data as Record<string, unknown>;
    const eventId = 'evt_' + crypto.randomUUID().replace(/-/g, '');

    billingStore.webhookEvents.push({
      id: eventId,
      type: eventType,
      data: eventData,
      status: 'received',
      receivedAt: new Date().toISOString(),
    });

    const validEvents = ['checkout.session.completed', 'invoice.paid', 'invoice.payment_failed'];
    if (!validEvents.includes(eventType)) {
      return jsonResponse(buildSuccess({
        received: true,
        eventId,
        type: eventType,
        warning: `Unknown event type "${eventType}". Known types: ${validEvents.join(', ')}`,
      }, bc));
    }

    if (eventType === 'checkout.session.completed') {
      const sessionId = (eventData.sessionId as string) || (eventData.id as string) || '';
      if (sessionId) {
        const session = billingStore.checkoutSessions.find((s) => s.id === sessionId);
        if (session) {
          session.status = 'completed';
          billingStore.subscriptions.push({
            id: 'sub_' + crypto.randomUUID().replace(/-/g, ''),
            tenantId: session.tenantId,
            planId: session.planId,
            status: 'active',
            provider: 'stripe',
            providerId: sessionId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            currentPeriodStart: new Date().toISOString(),
            currentPeriodEnd: new Date(Date.now() + 30 * 86400_000).toISOString(),
          });
        }
      }
    }

    if (eventType === 'invoice.paid') {
      const subscriptionId = (eventData.subscriptionId as string) || (eventData.subscription as string) || '';
      if (subscriptionId) {
        const sub = billingStore.subscriptions.find((s) => s.providerId === subscriptionId);
        if (sub) {
          sub.status = 'active';
          sub.updatedAt = new Date().toISOString();
          sub.currentPeriodStart = new Date().toISOString();
          sub.currentPeriodEnd = new Date(Date.now() + 30 * 86400_000).toISOString();
        }
      }
    }

    const event = billingStore.webhookEvents.find((e) => e.id === eventId);
    if (event) event.status = 'processed';

    return jsonResponse(buildSuccess({
      received: true,
      eventId,
      type: eventType,
      status: 'processed',
    }, bc));
  } catch {
    return jsonResponse(buildError('BAD_REQUEST', 'Invalid webhook payload. Expected { type, data }', bc), 400);
  }
};
