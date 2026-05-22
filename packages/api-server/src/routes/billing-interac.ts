/**
 * MapleSpike — Interac e-Transfer Billing Routes
 *
 * POST /v1/billing/interac/generate — Generate Interac transfer details
 * POST /v1/billing/interac/confirm — Confirm receipt of Interac transfer
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';
import { validateBody } from '../validate.js';
import { billingStore } from './billing-store.js';
import { PLANS } from './billing.js';

function generateReference(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let ref = 'INT-';
  for (let i = 0; i < 8; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
}

export const interacGenerateHandler: RouteHandler = async (request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };

  try {
    const body = await request.json() as Record<string, unknown>;
    const errs = validateBody(body, {
      planId: { type: 'string', required: true, minLength: 1 },
      email: { type: 'string', required: true, minLength: 5, maxLength: 254 },
    });
    if (errs.length > 0) {
      return jsonResponse(buildError('VALIDATION_ERROR', errs.map((e) => e.message).join('; '), bc), 400);
    }

    const plan = PLANS.find((p) => p.id === body.planId);
    if (!plan) {
      return jsonResponse(buildError('INVALID_PLAN', `Plan "${body.planId}" not found. Available: ${PLANS.map((p) => p.id).join(', ')}`, bc), 400);
    }

    const email = body.email as string;
    const reference = generateReference();
    const transferId = 'interac_' + crypto.randomUUID().replace(/-/g, '');

    billingStore.interacTransfers.push({
      id: transferId,
      tenantId: ctx.tenant.id,
      planId: plan.id,
      recipientEmail: email,
      reference,
      amount: plan.price,
      currency: plan.currency,
      status: 'pending',
      securityQuestion: 'What is the name of our service?',
      note: `MapleSpike ${plan.name} plan payment`,
      createdAt: new Date().toISOString(),
      confirmedAt: null,
    });

    return jsonResponse(buildSuccess({
      transferId,
      reference,
      recipientEmail: email,
      amount: plan.price,
      currency: plan.currency,
      planId: plan.id,
      planName: plan.name,
      securityQuestion: 'What is the name of our service?',
      securityAnswer: 'MapleSpike',
      instructions: `Send ${(plan.price / 100).toFixed(2)} ${plan.currency} via Interac e-Transfer to ${email}. Use reference ${reference} in the message field. Answer the security question with "MapleSpike".`,
      expiresAt: new Date(Date.now() + 48 * 3600_000).toISOString(),
    }, bc));
  } catch {
    return jsonResponse(buildError('BAD_REQUEST', 'Invalid request body. Expected { planId, email }', bc), 400);
  }
};

export const interacConfirmHandler: RouteHandler = async (request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };

  try {
    const body = await request.json() as Record<string, unknown>;
    const errs = validateBody(body, {
      reference: { type: 'string', required: true, minLength: 1, maxLength: 32 },
      amount: { type: 'number', required: true, min: 1 },
    });
    if (errs.length > 0) {
      return jsonResponse(buildError('VALIDATION_ERROR', errs.map((e) => e.message).join('; '), bc), 400);
    }

    const reference = body.reference as string;
    const amount = body.amount as number;

    const transfer = billingStore.interacTransfers.find((t) => t.reference === reference);
    if (!transfer) {
      return jsonResponse(buildError('NOT_FOUND', `Transfer with reference "${reference}" not found.`, bc), 404);
    }

    if (transfer.tenantId !== ctx.tenant.id) {
      return jsonResponse(buildError('FORBIDDEN', 'This transfer does not belong to your account.', bc), 403);
    }

    if (transfer.status === 'confirmed') {
      return jsonResponse(buildSuccess({
        reference: transfer.reference,
        status: transfer.status,
        confirmedAt: transfer.confirmedAt,
        message: 'Transfer was already confirmed.',
      }, bc));
    }

    if (transfer.status === 'expired') {
      return jsonResponse(buildError('TRANSFER_EXPIRED', 'This transfer reference has expired. Generate a new one.', bc), 400);
    }

    if (amount !== transfer.amount) {
      return jsonResponse(buildError('AMOUNT_MISMATCH', `Expected amount ${transfer.amount} but got ${amount}`, bc), 400);
    }

    transfer.status = 'confirmed';
    transfer.confirmedAt = new Date().toISOString();

    billingStore.subscriptions.push({
      id: 'sub_' + crypto.randomUUID().replace(/-/g, ''),
      tenantId: transfer.tenantId,
      planId: transfer.planId,
      status: 'active',
      provider: 'interac',
      providerId: transfer.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400_000).toISOString(),
    });

    return jsonResponse(buildSuccess({
      reference: transfer.reference,
      status: transfer.status,
      confirmedAt: transfer.confirmedAt,
      planId: transfer.planId,
      amount: transfer.amount,
      message: 'Interac e-Transfer confirmed. Your plan is now active.',
    }, bc));
  } catch {
    return jsonResponse(buildError('BAD_REQUEST', 'Invalid request body. Expected { reference, amount }', bc), 400);
  }
};
