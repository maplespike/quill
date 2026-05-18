/**
 * MapleSpike — Billing Routes (Stub)
 *
 * GET  /v1/billing/plans — List available pricing plans
 * POST /v1/billing/checkout — Create a checkout session
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';
import { validateBody, billingCheckoutSchema } from '../validation.js';

const PLANS = [
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

  const parsed = await validateBody(request, billingCheckoutSchema);
  if ('error' in parsed) {
    return jsonResponse(buildError('VALIDATION_ERROR', parsed.error, ctx), parsed.status);
  }
  const body = parsed.data;

  const plan = PLANS.find(p => p.id === body.planId);

  if (!plan) {
    return jsonResponse(buildError('INVALID_PLAN', `Plan "${body.planId}" not found. Available: ${PLANS.map(p => p.id).join(', ')}`, bc), 400);
  }

  return jsonResponse(buildSuccess({
    plan,
    checkoutUrl: null,
    successUrl: body.successUrl,
    cancelUrl: body.cancelUrl,
    message: 'Billing integration not yet active. Contact support@maplespike.ca for enterprise setup.',
  }, bc));
};
