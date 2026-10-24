// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Taxable-Revenue Tracker (#811)
 *
 * Event-sourced GST/HST ledger for the go-live legal gate (grilling #804):
 *  - Track taxable CAD revenue: charges net of refunds, idempotent per
 *    Stripe event ID (Stripe retries webhooks; replays must not double-count).
 *  - Alert the operator before the ~$30k rolling-4-quarter small-supplier
 *    threshold so CRA registration is never missed.
 *  - Checkout adds NO GST/HST line while the operator is unregistered
 *    (config flag); flips on registration. Non-compliant to charge tax
 *    unregistered; non-compliant to skip registration past the threshold.
 *
 * Ledger semantics:
 *  - `charge`     → positive amount_cents (checkout.session.completed,
 *                   invoice.payment_succeeded renewals)
 *  - `refund`     → negative amount_cents (charge.refunded)
 *  - `adjustment` → signed, operator-inserted corrections
 *  - Idempotency: UNIQUE ledger id / stripe_event_id per backend.
 *
 * Threshold basis: CRA small-supplier threshold is $30,000 over four
 * consecutive calendar quarters. The ledger is append-only; the rolling
 * window is computed by the storage layer over created_at >= cutoff.
 */

// ─── Constants ────────────────────────────────────────────────────────────

/** $30,000 small-supplier threshold over a rolling 4-quarter window, in cents. */
export const GST_HST_THRESHOLD_CENTS = 3_000_000;

/** Fire the operator alert at 80% of the threshold (per #811 acceptance). */
export const GST_HST_ALERT_RATIO = 0.8;

/** Alert checkpoint in cents (80% of $30k = $24,000). */
export const GST_HST_ALERT_CENTS = Math.floor(GST_HST_THRESHOLD_CENTS * GST_HST_ALERT_RATIO);

/** Rolling window: 4 quarters ≈ 366 days (keeps the window open across quarter ends). */
export const GST_HST_WINDOW_DAYS = 366;

/** HST rate applied at checkout once registered (Ontario HST, 13%). */
export const HST_RATE_ON = 0.13;

// ─── Types (re-exported from canonical types.ts) ──────────────────────────

import type { TaxLedgerEntryInsert, TaxLedgerSummary, TaxLedgerEntryType, QuillStorage } from './types.js';
export type { TaxLedgerEntryInsert, TaxLedgerSummary };

export type TaxThresholdStatus = 'ok' | 'approaching' | 'breached';

export interface TaxThresholdAssessment {
  status: TaxThresholdStatus;
  /** True the first time the net crosses the alert checkpoint / threshold. */
  alert: boolean;
  message: string;
  netCents: number;
  thresholdCents: number;
  alertCents: number;
}

// ─── Config flags ─────────────────────────────────────────────────────────

/**
 * True once the operator has registered for GST/HST. Until then checkout
 * MUST NOT add a tax line (#811: "do NOT charge GST/HST" while unregistered).
 * Flip by setting GST_HST_REGISTERED=true in the deployment env.
 */
export function isTaxRegistered(): boolean {
  return process.env.GST_HST_REGISTERED === 'true';
}

/**
 * Compute the tax component of a checkout amount.
 * Unregistered → zero tax (total unchanged). Registered → 13% ON HST.
 */
export function computeHst(
  amountCents: number,
  opts?: { registered?: boolean; rate?: number },
): { taxCents: number; totalCents: number; registered: boolean; rate: number } {
  const registered = opts?.registered ?? isTaxRegistered();
  const rate = opts?.rate ?? HST_RATE_ON;
  if (!registered) return { taxCents: 0, totalCents: amountCents, registered, rate };
  const taxCents = Math.round(amountCents * rate);
  return { taxCents, totalCents: amountCents + taxCents, registered, rate };
}

/** Unix-seconds cutoff for the rolling 4-quarter window. */
export function taxWindowStartUnix(nowUnix = Math.floor(Date.now() / 1000)): number {
  return nowUnix - GST_HST_WINDOW_DAYS * 24 * 60 * 60;
}

// ─── Threshold assessment ─────────────────────────────────────────────────

const STATUS_ORDER: TaxThresholdStatus[] = ['ok', 'approaching', 'breached'];

/** Module-level last-assessed status — pod-local; re-alerts once on restart (acceptable for a high-signal, rare event). */
let lastAssessedStatus: TaxThresholdStatus = 'ok';

/**
 * Pure assessment of the ledger summary against the threshold.
 * No side effects; `alert` is false unless the caller provides previousNetCents
 * (use assessAndAlert for transition-deduped alerting).
 */
export function assessTaxThreshold(summary: TaxLedgerSummary, previousNetCents?: number): TaxThresholdAssessment {
  const base = {
    netCents: summary.netCents,
    thresholdCents: GST_HST_THRESHOLD_CENTS,
    alertCents: GST_HST_ALERT_CENTS,
  };

  if (summary.netCents >= GST_HST_THRESHOLD_CENTS) {
    return {
      ...base,
      status: 'breached',
      alert: previousNetCents !== undefined && previousNetCents < GST_HST_THRESHOLD_CENTS,
      message:
        `Taxable CAD revenue has reached the $30,000 small-supplier threshold ` +
        `($${(summary.netCents / 100).toFixed(2)} net in the rolling window). ` +
        `You MUST register for GST/HST before charging further taxable revenue.`,
    };
  }

  if (summary.netCents >= GST_HST_ALERT_CENTS) {
    return {
      ...base,
      status: 'approaching',
      alert: previousNetCents !== undefined && previousNetCents < GST_HST_ALERT_CENTS,
      message:
        `Taxable CAD revenue is at ${Math.round((summary.netCents / GST_HST_THRESHOLD_CENTS) * 100)}% ` +
        `of the $30,000 GST/HST small-supplier threshold ` +
        `($${(summary.netCents / 100).toFixed(2)} net). ` +
        `Plan registration now — charging past the threshold unregistered is non-compliant.`,
    };
  }

  return {
    ...base,
    status: 'ok',
    alert: false,
    message:
      `Taxable CAD revenue $${(summary.netCents / 100).toFixed(2)} of $30,000 ` +
      `rolling-4-quarter threshold (${GST_HST_ALERT_RATIO * 100}% checkpoint at ` +
      `$${(GST_HST_ALERT_CENTS / 100).toFixed(2)}).`,
  };
}

/**
 * Operator alert sink. Logs at error level so k8s log-based alerting
 * (A7 PrometheusRule pattern) can route it to Telegram without new wiring.
 * Returns the message so callers can include it in API responses.
 */
export function fireTaxAlert(assessment: TaxThresholdAssessment): string {
  console.error(`[TAX-ALERT][${assessment.status}] ${assessment.message}`);
  return assessment.message;
}

/**
 * Assess + fire the alert ONLY on status escalation (ok→approaching→breached),
 * so repeated webhook events or cron polls don't spam the operator. Restarts
 * re-arm at the current status (at-most-one duplicate alert per pod lifetime).
 */
export function assessAndAlert(summary: TaxLedgerSummary): TaxThresholdAssessment {
  const prevIdx = STATUS_ORDER.indexOf(lastAssessedStatus);
  const assessment = assessTaxThreshold(summary);
  const newIdx = STATUS_ORDER.indexOf(assessment.status);
  assessment.alert = assessment.status !== 'ok' && newIdx > prevIdx;
  if (assessment.alert) fireTaxAlert(assessment);
  if (newIdx > prevIdx) lastAssessedStatus = assessment.status;
  return assessment;
}

/** Test hook — reset the module-level alert state. */
export function resetTaxAlertState(): void {
  lastAssessedStatus = 'ok';
}

// ─── Webhook capture (called from billing-stripe.ts) ─────────────────────

export type TaxEventRecordResult = 'recorded' | 'duplicate' | 'skipped';

/**
 * Record a Stripe revenue event into the tax ledger, idempotently.
 *
 * Revenue mapping (see #811 + docs/billing.md):
 *  - Subscriptions bill via invoices → `invoice.payment_succeeded` is the
 *    canonical charge event. Do NOT also record checkout.session.completed
 *    for subscription mode — it would double-count the first period.
 *  - `charge.refunded` → negative entry (refund).
 *  - Idempotency: ledger id = Stripe event ID; UNIQUE at the storage layer
 *    plus a pre-check for a clean 'duplicate' signal.
 */
export async function recordTaxEvent(
  db: QuillStorage,
  ev: {
    eventId: string;
    entryType: TaxLedgerEntryType;
    amountCents: number;
    currency: string;
    orderId?: string | null;
    tenantId?: string | null;
  },
): Promise<TaxEventRecordResult> {
  if (!Number.isFinite(ev.amountCents) || ev.amountCents === 0) return 'skipped';
  if (await db.hasTaxLedgerEntry(ev.eventId)) return 'duplicate';
  try {
    await db.insertTaxLedgerEntry({
      id: ev.eventId,
      entryType: ev.entryType,
      amountCents: ev.amountCents,
      currency: ev.currency || 'CAD',
      orderId: ev.orderId ?? null,
      tenantId: ev.tenantId ?? null,
      stripeEventId: ev.eventId,
      note: `stripe:${ev.entryType}`,
    });
    return 'recorded';
  } catch {
    // UNIQUE race (concurrent webhook deliveries) — treat as replay.
    return 'duplicate';
  }
}
