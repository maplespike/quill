/**
 * Stripe REST client + manual webhook signature verification.
 *
 * Why no `stripe` npm SDK? The api-server runs on Cloudflare Workers in prod and
 * Node.js in dev; the official Stripe SDK targets Node and bundles `crypto` and
 * Node-only APIs that don't survive Workers. The REST API is well-documented at
 * https://stripe.com/docs/api and signature verification is a one-shot HMAC-SHA256,
 * so a 200-line bespoke client is simpler and matches the existing constraint
 * that billing works on the Workers runtime (cf. viem dep, which is Workers-safe).
 *
 * SECURITY: This module NEVER logs the secret key, publishable key, or webhook
 * secret. Log helpers report only "set" / "missing" or the key SHA-256 prefix
 * (8 chars) for cross-environment sanity checks.
 */

import crypto from 'node:crypto';
import type { Tier } from '../types.js';

// ─── Configuration (env-var-only; never persisted in code) ────────────────

const STRIPE_API_BASE = 'https://api.stripe.com/v1';
const STRIPE_API_VERSION = '2026-06-24.dahlia';
const SIG_TOLERANCE_SEC = 300; // reject events older than 5 min

function readSecretKey(): string | null {
  const v = process.env.STRIPE_SECRET_KEY;
  return v && v.length > 0 ? v : null;
}

function readWebhookSecret(): string | null {
  const v = process.env.STRIPE_WEBHOOK_SECRET;
  return v && v.length > 0 ? v : null;
}

function readAccountId(): string | null {
  const v = process.env.STRIPE_ACCOUNT_ID;
  return v && v.length > 0 ? v : null;
}

/** Distinguish keys safely for log output. NEVER logs the raw value. */
function fingerprint(value: string | null): string {
  if (!value) return 'missing';
  const suffix = value.slice(-4); // e.g. "...HQT0050G4KC02"
  const hash = crypto.createHash('sha256').update(value).digest('hex').slice(0, 6);
  return `set(${hash}…${suffix})`;
}

export function getStripeStatus(): {
  configured: boolean;
  webhookConfigured: boolean;
} {
  const sk = readSecretKey();
  const wh = readWebhookSecret();
  return {
    configured: sk !== null,
    webhookConfigured: wh !== null,
  };
}

/**
 * Build a per-process fingerprint object (NEVER returned to API callers; only
 * used by `logStripeStatus()` for operator-side diagnostics). Exported as a
 * separate function so it stays out of the public surface of getStripeStatus().
 */
export function getStripeDiagnosticInfo(): {
  keyFingerprint: string;
  accountFingerprint: string;
} {
  return {
    keyFingerprint: fingerprint(readSecretKey()),
    accountFingerprint: fingerprint(readAccountId()),
  };
}

// ─── Errors ──────────────────────────────────────────────────────────────

export class StripeError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'StripeError';
  }
}

export class StripeApiError extends StripeError {
  constructor(public httpStatus: number, public responseBody: string, public requestId?: string) {
    super('STRIPE_API_ERROR', `Stripe API returned ${httpStatus}: ${responseBody.slice(0, 200)}`);
    this.name = 'StripeApiError';
  }
}

// ─── Logging façade ─────────────────────────────────────────────────────

type Logger = { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };

export function logStripeStatus(log: Logger): void {
  const s = getStripeStatus();
  const diag = getStripeDiagnosticInfo();
  log.info(
    `stripe.status: configured=${s.configured} webhook=${s.webhookConfigured} ` +
      `key_fp=${diag.keyFingerprint} account_fp=${diag.accountFingerprint}`,
  );
  if (!s.configured) {
    log.warn('stripe.status: STRIPE_SECRET_KEY is missing — checkout endpoints will return 503');
  }
  if (!s.webhookConfigured) {
    log.warn('stripe.status: STRIPE_WEBHOOK_SECRET is missing — webhook events cannot be verified');
  }
}

// ─── REST client (form-urlencoded per Stripe convention) ─────────────────

function stripEmpty(obj: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.length === 0) continue;
    out[k] = String(v);
  }
  return out;
}

async function stripeFetch<T = Record<string, unknown>>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  formBody?: Record<string, unknown>,
): Promise<T> {
  const sk = readSecretKey();
  if (!sk) throw new StripeError('STRIPE_NOT_CONFIGURED', 'STRIPE_SECRET_KEY is not set');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${sk}`,
    'Stripe-Version': STRIPE_API_VERSION,
    'User-Agent': 'MapleSpike/MapleStripe/0.1',
  };
  let body: string | undefined;
  if (formBody && method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(stripEmpty(formBody)).toString();
  }

  const resp = await fetch(`${STRIPE_API_BASE}${path}`, { method, headers, body });
  const text = await resp.text();
  if (!resp.ok) {
    const requestId = resp.headers.get('request-id') ?? undefined;
    throw new StripeApiError(resp.status, text, requestId);
  }
  return text.length > 0 ? (JSON.parse(text) as T) : ({} as T);
}

// ─── Customer + Checkout Session APIs ───────────────────────────────────

export interface StripeCustomer {
  id: string;
  object: 'customer';
  email?: string | null;
  metadata: Record<string, string>;
}

export async function findOrCreateCustomer(args: {
  tenantId: string;
  emailHash?: string;
}): Promise<StripeCustomer> {
  // Look up by metadata first (idempotent). Stripe search isn't cheap;
  // we create once and store the ID on the user — subsequent calls reuse it.
  return stripeFetch<StripeCustomer>('POST', '/customers', {
    'metadata[tenant_id]': args.tenantId,
    'metadata[email_hash]': args.emailHash ?? '',
  });
}

export interface StripeCheckoutSession {
  id: string;
  object: 'checkout.session';
  url: string;
  customer: string;
  subscription?: string;
  status: 'open' | 'complete' | 'expired';
  expires_at: number;
  metadata: Record<string, string>;
  /** Present only for embedded sessions — the browser needs it to mount the form. */
  client_secret?: string | null;
}

export async function createCheckoutSession(args: {
  customerId: string;
  amountCents: number;
  currency: string; // ISO 4217 lower-case, e.g. "cad"
  productName: string;
  description?: string;
  planId: string;
  tenantId: string;
  orderId: string;
  intervalMonths: number;
  successUrl: string;
  cancelUrl: string;
  expiresAtUnix: number;
  /**
   * 'embedded' mounts Stripe's payment form inside our own page (needs the
   * publishable key in the browser). Embedded sessions take `return_url` and
   * reject `success_url`/`cancel_url`, so the three are mutually exclusive.
   *
   * The wire value is `embedded_page`, not `embedded`: Stripe retired the old
   * enum and now answers "The ui_mode value `embedded` is no longer supported.
   * Use `embedded_page` instead." — checked against the live account on
   * 2026-11-23 *under our own Stripe-Version pin*, so the pin does not rescue
   * it. The option keeps the local name 'embedded' because it describes what
   * the portal does, not which API enum Stripe currently accepts.
   */
  uiMode?: 'hosted' | 'embedded';
  returnUrl?: string;
}): Promise<StripeCheckoutSession> {
  const embedded = args.uiMode === 'embedded';
  return stripeFetch<StripeCheckoutSession>('POST', '/checkout/sessions', {
    mode: 'subscription',
    ...(embedded
      ? { ui_mode: 'embedded_page', return_url: args.returnUrl ?? args.successUrl }
      : { success_url: args.successUrl, cancel_url: args.cancelUrl }),
    customer: args.customerId,
    'line_items[0][quantity]': 1,
    'line_items[0][price_data][currency]': args.currency,
    'line_items[0][price_data][unit_amount]': args.amountCents,
    'line_items[0][price_data][recurring][interval]': 'month',
    'line_items[0][price_data][recurring][interval_count]': args.intervalMonths,
    'line_items[0][price_data][product_data][name]': args.productName,
    ...(args.description
      ? { 'line_items[0][price_data][product_data][description]': args.description }
      : {}),
    expires_at: args.expiresAtUnix,
    'metadata[tenant_id]': args.tenantId,
    'metadata[plan_id]': args.planId,
    'metadata[order_id]': args.orderId,
    // Allow promotional codes by default — Canadian SMBs expect this
    allow_promotion_codes: 'true',
    // Capture payment_method on subscription so renewals work
    payment_method_collection: 'always',
  });
}

/**
 * Billing-period end of a subscription object.
 *
 * We pin Stripe-Version 2026-06-24.dahlia. Since 2025-03-31.basil the period
 * fields live on each subscription item (`items.data[0].current_period_end`),
 * not the subscription root. Webhook endpoints use the account-default
 * version (api_version: null), so the legacy root field is kept as a fallback
 * for older payloads only. Returns undefined when neither is a positive int.
 */
export function subscriptionCurrentPeriodEnd(sub: unknown): number | undefined {
  if (!sub || typeof sub !== 'object') return undefined;
  const o = sub as Record<string, any>;
  const item = Array.isArray(o.items?.data) ? o.items.data[0] : undefined;
  const fromItem = item && typeof item.current_period_end === 'number' ? item.current_period_end : undefined;
  if (fromItem !== undefined && Number.isInteger(fromItem) && fromItem > 0) return fromItem;
  const legacy = typeof o.current_period_end === 'number' ? o.current_period_end : undefined;
  if (legacy !== undefined && Number.isInteger(legacy) && legacy > 0) return legacy;
  return undefined;
}

export interface StripeSubscription {
  id: string;
  object: 'subscription';
  status: string;
  customer: string | { id: string };
  metadata?: Record<string, string>;
  items?: { data: Array<{ current_period_end?: number; current_period_start?: number }> };
  current_period_end?: number;
}

/** GET /v1/subscriptions/:id (read-only). */
export async function retrieveSubscription(subscriptionId: string): Promise<StripeSubscription> {
  if (!/^sub_[A-Za-z0-9_]+$/.test(subscriptionId)) {
    throw new StripeError('INVALID_SUBSCRIPTION_ID', 'Invalid Stripe subscription id');
  }
  return stripeFetch<StripeSubscription>('GET', `/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

/**
 * Customer Portal session — lets users manage subscription, update card,
 * cancel, download invoices. Requires `customer` and at least one configured
 * portal feature in the Stripe dashboard.
 */
export async function createPortalSession(args: {
  customerId: string;
  returnUrl: string;
}): Promise<{ id: string; url: string }> {
  return stripeFetch<{ id: string; url: string }>('POST', '/billing_portal/sessions', {
    customer: args.customerId,
    return_url: args.returnUrl,
  });
}

// ─── Webhook signature verification (Stripe scheme) ──────────────────────
//
// Header format: "Stripe-Signature: t=1492774577,v1=abc...,v0=..."
// v1 signing scheme: HMAC-SHA256(${timestamp}.${rawBody}, webhook_secret), hex.
//
// Stripe rotates signing schemes (v0/v1/etc.); we accept any v1 signature. A
// request is valid if AT LEAST ONE listed v1 signature matches (per Stripe's
// recommendation for key rotation). Timestamp must be within toleranceSec of
// "now" to defeat replays.
//
// ALL of these codes are recoverable errors — the webhook listener should
// 4xx and not retry on them; only 5xx triggers Stripe to retry.

export type VerifiedStripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
  created: number;
  livemode: boolean;
  api_version?: string;
};

export class WebhookVerificationError extends StripeError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = 'WebhookVerificationError';
  }
}

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  opts: { toleranceSec?: number } = {},
): VerifiedStripeEvent {
  if (!signatureHeader) {
    throw new WebhookVerificationError('STRIPE_SIGNATURE_MISSING', 'Stripe-Signature header absent');
  }
  const wh = readWebhookSecret();
  if (!wh) {
    throw new WebhookVerificationError(
      'STRIPE_WEBHOOK_SECRET_MISSING',
      'STRIPE_WEBHOOK_SECRET is not set on this server; cannot verify events',
    );
  }
  const toleranceSec = opts.toleranceSec ?? SIG_TOLERANCE_SEC;

  // Parse comma-separated k=v pairs
  const parts: Record<string, string[]> = {};
  for (const segment of signatureHeader.split(',')) {
    const idx = segment.indexOf('=');
    if (idx <= 0) continue;
    const key = segment.slice(0, idx).trim();
    const value = segment.slice(idx + 1).trim();
    (parts[key] ??= []).push(value);
  }
  const v1Sigs = parts.v1 ?? [];
  if (v1Sigs.length === 0) {
    throw new WebhookVerificationError('STRIPE_SIGNATURE_MALFORMED', 'no v1 signature found in Stripe-Signature');
  }
  const timestampStr = (parts.t ?? [])[0];
  const timestamp = parseInt(timestampStr ?? '', 10);
  if (!Number.isFinite(timestamp)) {
    throw new WebhookVerificationError('STRIPE_SIGNATURE_MALFORMED', 'invalid timestamp in Stripe-Signature');
  }
  const skew = Math.floor(Date.now() / 1000) - timestamp;
  if (Math.abs(skew) > toleranceSec) {
    throw new WebhookVerificationError(
      'STRIPE_SIGNATURE_EXPIRED',
      `timestamp out of tolerance (skew=${skew}s, tolerance=${toleranceSec}s)`,
    );
  }

  // Compute the expected v1 sig
  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', wh).update(signedPayload, 'utf8').digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  let matched = false;
  for (const candidate of v1Sigs) {
    const a = Buffer.from(candidate, 'utf8');
    if (a.length === expectedBuf.length && crypto.timingSafeEqual(a, expectedBuf)) {
      matched = true;
      break;
    }
  }
  if (!matched) {
    throw new WebhookVerificationError('STRIPE_SIGNATURE_INVALID', 'no v1 signature matched');
  }

  // Signature passes — safe to parse the body.
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch (e) {
    throw new WebhookVerificationError('STRIPE_EVENT_INVALID_JSON', `failed to parse event body: ${(e as Error).message}`);
  }
  if (!parsed || typeof parsed !== 'object' || !('type' in parsed) || !('data' in parsed)) {
    throw new WebhookVerificationError('STRIPE_EVENT_MALFORMED', 'event missing required fields (type, data)');
  }
  return parsed as VerifiedStripeEvent;
}

// ─── Plan mapping (Stripe subscription price → MapleSpike tier) ─────────

/**
 * Decide which MapleSpike plan a Stripe subscription belongs to.
 * We rely on the metadata we set at checkout (planId) so we never have to
 * mirror Stripe Price IDs in code — the price is bound to the orderId at
 * session creation, and the webhook gets the planId in `event.data.object.metadata`.
 */
export function planIdFromMetadata(meta: Record<string, string> | undefined): string | null {
  if (!meta) return null;
  const v = meta.plan_id ?? meta.planId;
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export function tenantIdFromMetadata(meta: Record<string, string> | undefined): string | null {
  if (!meta) return null;
  const v = meta.tenant_id ?? meta.tenantId;
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export function orderIdFromMetadata(meta: Record<string, string> | undefined): string | null {
  if (!meta) return null;
  const v = meta.order_id ?? meta.orderId;
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Map Stripe subscription status → MapleSpike tier.
 *
 * "active", "trialing" → keep current tier
 * "past_due" → keep current tier (Stripe will retry; don't punish for transient failure)
 * "canceled", "unpaid", "incomplete_expired" → downgrade to 'free'
 * "incomplete" → keep current tier (first payment hasn't cleared)
 */
export type StripeSubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

/**
 * Outcome returned to handlers. `subscriptionStatus` mirrors Stripe but with a
 * 3-state union Quill uses for the dashboard ("active" | "paused" | "cancelled" | "past_due").
 * We collapse some Stripe statuses to those four to keep the UI vocabulary tight.
 */
export type TierSubscriptionStatus = 'active' | 'paused' | 'past_due' | 'cancelled';

export function tierFromSubscriptionStatus(args: {
  status: StripeSubscriptionStatus | string;
  planId: Tier;
}): { tier?: Tier; subscriptionStatus: TierSubscriptionStatus } {
  const { status, planId } = args;
  if (status === 'active' || status === 'trialing' || status === 'incomplete' || status === 'resumed') {
    return { tier: planId, subscriptionStatus: 'active' };
  }
  if (status === 'past_due') {
    // Stripe will retry; user keeps access. Do NOT modify tier.
    return { subscriptionStatus: 'past_due' };
  }
  if (status === 'paused') {
    // Pause-Collection (Stripe API 2024-12+): keep access, surface paused flag.
    return { subscriptionStatus: 'paused' };
  }
  // canceled, unpaid, incomplete_expired → downgrade to free
  return { tier: 'free', subscriptionStatus: 'cancelled' };
}
