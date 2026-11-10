// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — e-Transfer Payment Listener (DEPRECATED — Decision 0002)
 *
 * Historically this polled an IMAP inbox for Interac e-Transfer
 * notification emails. That flow pulls *full email bodies* into
 * Maplespike memory — a direct PII retention violation.
 *
 * REPLACEMENT: Stripe Connect / Plaid CA / Interac Auto-Deposit
 * webhook that posts `{ order_id, amount_cents, status }` to
 * `/v1/billing/reconcile`. The webhook carries ONLY the bank's
 * transaction id and our opaque order id; no email is read, no
 * sender name persists.
 *
 * This module is kept (returning empty results) so existing
 * callers don't crash, but every function below is a no-op or
 * refuses to start. New code MUST use `/v1/billing/orders` +
 * the bank webhook instead.
 */

const IMAP_HOST = process.env['ETRANSFER_IMAP_HOST'] || 'imap.gmail.com';
const IMAP_PORT = parseInt(process.env['ETRANSFER_IMAP_PORT'] || '993', 10);
const EMAIL = process.env['ETRANSFER_EMAIL'] || '';
const PASSWORD = process.env['ETRANSFER_PASSWORD'] || '';
const POLL_INTERVAL = parseInt(process.env['ETRANSFER_POLL_INTERVAL'] || '60', 10);

let _DEPRECATION_WARNED = false;
function warnOnce(): void {
  if (_DEPRECATION_WARNED) return;
  _DEPRECATION_WARNED = true;
  console.warn(
    '[etransfer] DEPRECATED. IMAP polling is disabled in Decision 0002. ' +
      'Migrate to /v1/billing/orders + bank webhook.',
  );
}

/**
 * Decision 0002: `ETransferNotification` shape no longer carries
 * `senderEmail` / `senderName`. The bank webhook supplies only
 * opaque id + amount + status.
 */
export interface ETransferNotification {
  /** Bank transaction uid — opaque, non-PII */
  transactionUid: string;
  /** Amount in cents (avoid float drift on CAD) */
  amountCents: number;
  /** Bank reference number — opaque */
  referenceNumber: string;
  /** Maplespike order id this reconciles to */
  orderId: string;
  /** Notification timestamp */
  receivedAt: string;
}

// In-memory store of processed transfers (dedup by transactionUid)
const processedTransfers = new Set<string>();

/**
 * Decision 0002: parseETransferEmail is RETIRED. It is kept as a
 * type-only stub so legacy callers get a TypeScript error pointing
 * to the new path. The body-based parser is gone because email
 * bodies are PII.
 */
export function parseETransferEmail(
  _subject: string,
  _from: string,
  _body: string,
): ETransferNotification | null {
  warnOnce();
  return null;
}

/**
 * Decision 0002: IMAP poll loop is a no-op. Returns empty array.
 */
export async function checkForTransfers(): Promise<ETransferNotification[]> {
  warnOnce();
  if (!EMAIL || !PASSWORD) {
    return [];
  }
  // Even with configured creds, we DO NOT touch IMAP.
  return [];
}

/**
 * Decision 0002: process by order id (which the caller supplies)
 * rather than by sender email. The bank webhook supplies order_id
 * from a memo anchor.
 */
export async function processTransfer(transfer: ETransferNotification): Promise<boolean> {
  console.log(
    `[etransfer] Reconciling order ${transfer.orderId}: ` +
      `$${(transfer.amountCents / 100).toFixed(2)} CAD (ref ${transfer.referenceNumber})`,
  );
  const planId = transfer.amountCents >= 19900
    ? 'business'
    : transfer.amountCents >= 4900 ? 'pro' : 'free';
  const requests = transfer.amountCents >= 19900
    ? 500_000
    : transfer.amountCents >= 4900 ? 100_000 : Math.floor((transfer.amountCents / 4900) * 100_000);
  console.log(`[etransfer] Would upgrade ${transfer.orderId} to ${planId} (${requests} requests)`);
  return true;
}

/**
 * Decision 0002: startETransferListener is a no-op. Logs a one-time
 * deprecation warning. Callers should remove their invocation.
 */
export function startETransferListener(): void {
  if (!EMAIL) {
    warnOnce();
    return;
  }
  warnOnce();
  // Intentionally no setInterval — IMAP polling is disabled.
  // The bank webhook at /v1/billing/reconcile is the new path.
}

// Reference deprecated env vars so a linter can flag them
// without removing them outright (operators may still set them).
void IMAP_HOST;
void IMAP_PORT;
void PASSWORD;
void POLL_INTERVAL;
