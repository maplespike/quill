/**
 * MapleSpike — Billing Routes
 *
 * GET  /v1/billing/plans — List available pricing plans
 * POST /v1/billing/checkout — Create a checkout session
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';
import { validateBody } from '../validate.js';
import { billingStore } from './billing-store.js';

export const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'CAD',
    interval: 'month',
    requests: 1_000,
    rateLimit: 2,
    description: 'For trying out MapleSpike',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 4900, // $49 in cents
    currency: 'CAD',
    interval: 'month',
    requests: 100_000,
    rateLimit: 25,
    description: 'For journalists and researchers',
  },
  {
    id: 'business',
    name: 'Business',
    price: 19900, // $199 in cents
    currency: 'CAD',
    interval: 'month',
    requests: 500_000,
    rateLimit: 100,
    description: 'For newsrooms and production apps',
  },
];

export const billingPlansHandler: RouteHandler = async (_request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  return jsonResponse(buildSuccess({ plans: PLANS }, bc));
};

export const billingCheckoutHandler: RouteHandler = async (request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };

  try {
    const body = await request.json() as Record<string, unknown>;
    const errs = validateBody(body, {
      planId: { type: 'string', required: true, minLength: 1 },
      successUrl: { type: 'string', maxLength: 2000 },
      cancelUrl: { type: 'string', maxLength: 2000 },
    });
    if (errs.length > 0) {
      return jsonResponse(buildError('VALIDATION_ERROR', errs.map((e: { field: string; message: string }) => e.message).join('; '), bc), 400);
    }
    const plan = PLANS.find(p => p.id === body.planId);

    if (!plan) {
      return jsonResponse(buildError('INVALID_PLAN', `Plan "${body.planId}" not found. Available: ${PLANS.map(p => p.id).join(', ')}`, bc), 400);
    }

    const provider = (body.provider as string) || 'stripe';

    if (provider === 'stripe') {
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
        checkoutUrl: sessionUrl,
        sessionId,
        plan: plan.id,
        amount: plan.price,
        currency: plan.currency,
        provider,
      }, bc));
    }

    return jsonResponse(buildSuccess({
      checkoutUrl: null,
      plan: plan.id,
      amount: plan.price,
      currency: plan.currency,
      provider,
      message: `Use the dedicated /v1/billing/${provider}/... endpoint for this payment method.`,
    }, bc));
  } catch {
    return jsonResponse(buildError('BAD_REQUEST', 'Invalid request body. Expected { planId }', bc), 400);
  }
};
