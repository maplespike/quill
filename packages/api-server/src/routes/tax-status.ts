// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Tax Ledger Routes (#811)
 *
 * Operator-facing endpoints for the GST/HST taxable-revenue tracker.
 * Auth: X-Billing-Secret header (same shared-secret pattern as the
 * reconcile/verify routes in billing.ts) — operator/cron only, never tenants.
 *
 *  GET  /v1/billing/tax/status      → rolling-window summary + threshold assessment
 *  POST /v1/billing/tax/adjustment  → signed correction entry (operator audit trail)
 *
 * The alert fires on status escalation (ok → approaching → breached) inside
 * assessAndAlert() — log-based alerting (A7) picks it up; a cron or the
 * status poll keeps it armed after pod restarts.
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';
import {
  GST_HST_THRESHOLD_CENTS,
  GST_HST_ALERT_CENTS,
  GST_HST_WINDOW_DAYS,
  taxWindowStartUnix,
  assessAndAlert,
  resetTaxAlertState,
  isTaxRegistered,
} from '../tax-ledger.js';

function buildBc(ctx: { tenant: unknown; requestId: string; startTime: number }): BuildContext {
  return { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime } as unknown as BuildContext;
}

/** Shared-secret gate — mirrors requireBillingSecret() in routes/billing.ts. */
function requireBillingSecret(request: Request): boolean {
  const secret = request.headers.get('X-Billing-Secret');
  return secret !== undefined && secret !== null && secret === process.env.QUILL_BILLING_SECRET;
}

/**
 * GET /v1/billing/tax/status
 *
 * Rolling-4-quarter taxable revenue summary + threshold assessment.
 * Records the (deduped) alert so escalation notifications fire exactly once
 * per status change per pod lifetime.
 */
export const taxStatusHandler: RouteHandler = async (_request, ctx) => {
  const bc = buildBc(ctx);
  if (!requireBillingSecret(_request)) {
    return jsonResponse(buildError('UNAUTHORIZED', 'X-Billing-Secret header required', bc), 401);
  }

  try {
    const windowStart = taxWindowStartUnix();
    const summary = await ctx.db.getTaxLedgerSummary(windowStart);
    const assessment = assessAndAlert(summary);
    return jsonResponse(
      buildSuccess(
        {
          summary,
          assessment,
          registered: isTaxRegistered(),
          config: {
            thresholdCad: GST_HST_THRESHOLD_CENTS / 100,
            alertCad: GST_HST_ALERT_CENTS / 100,
            windowDays: GST_HST_WINDOW_DAYS,
          },
          hint:
            'Alerts fire on status escalation (ok → approaching → breached). ' +
            'Poll this endpoint from a cron to keep alerting armed across restarts.',
        },
        bc,
      ),
    );
  } catch (e) {
    return jsonResponse(
      buildError('TAX_LEDGER_ERROR', `Failed to compute tax status: ${(e as Error).message}`, bc),
      500,
    );
  }
};

/**
 * POST /v1/billing/tax/adjustment
 *
 * Operator-inserted signed correction (manual refund reconciliation,
 * offline charge, prior-period fix). Idempotent by id.
 * Body: { id, amount_cents (signed), note, order_id? }
 */
export const taxAdjustmentHandler: RouteHandler = async (request, ctx) => {
  const bc = buildBc(ctx);
  if (!requireBillingSecret(request)) {
    return jsonResponse(buildError('UNAUTHORIZED', 'X-Billing-Secret header required', bc), 401);
  }

  let body: { id?: string; amount_cents?: number; note?: string; order_id?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse(
      buildError('BAD_REQUEST', 'Invalid request body — expected { id, amount_cents (signed), note, order_id? }', bc),
      400,
    );
  }

  const id = typeof body.id === 'string' && body.id.trim().length > 0 ? body.id.trim() : null;
  const amountCents = typeof body.amount_cents === 'number' ? Math.round(body.amount_cents) : null;
  if (!id || amountCents === null || amountCents === 0) {
    return jsonResponse(
      buildError('INVALID_ADJUSTMENT', 'id (non-empty) and amount_cents (non-zero signed integer) are required', bc),
      400,
    );
  }

  try {
    const existing = await ctx.db.hasTaxLedgerEntry(id);
    if (existing) {
      return jsonResponse(
        buildSuccess({ id, recorded: false, reason: 'duplicate — adjustment already exists' }, bc),
      );
    }
    await ctx.db.insertTaxLedgerEntry({
      id,
      entryType: 'adjustment',
      amountCents,
      currency: 'CAD',
      orderId: body.order_id ?? null,
      tenantId: null,
      stripeEventId: null,
      note: body.note ?? 'operator adjustment',
    });
    // Re-assess so an operator correction that crosses a boundary alerts immediately.
    const summary = await ctx.db.getTaxLedgerSummary(taxWindowStartUnix());
    const assessment = assessAndAlert(summary);
    return jsonResponse(
      buildSuccess({ id, recorded: true, amount_cents: amountCents, assessment }, bc),
    );
  } catch (e) {
    return jsonResponse(
      buildError('TAX_LEDGER_ERROR', `Failed to record adjustment: ${(e as Error).message}`, bc),
      500,
    );
  }
};

/** Test hook — reset the escalation alert state (re-exported for convenience). */
export { resetTaxAlertState };
