/**
 * Quill — API Server Types
 *
 * Shared types for the multi-tenant API gateway.
 * MapleSpike-quality response envelope with quality, citation, and token optimization.
 */

/* ------------------------------------------------------------------ */
/*  Tenant / Auth                                                      */
/* ------------------------------------------------------------------ */

export type Tier = 'free' | 'pro' | 'business' | 'enterprise' | 'internal';

export interface Tenant {
  id: string;
  name: string;
  /**
   * HMAC-SHA256(`QUILL_PII_HASH_SECRET`, plaintext-email).
   * Decision 0002: Maplespike never retains plaintext PII.
   * The plaintext is consumed in-flight by the transactional
   * mailer; only the hash is persisted.
   */
  emailHash?: string;
  emailVerified: boolean;
  verificationToken?: string;
  tier: Tier;
  isActive: boolean;
  journalismMode: boolean;
  /**
   * Stripe-side linkage (post-checkout only). All nullable so that free-tier
   * tenants created before Stripe integration don't carry dead columns.
   * These are loaded by the QuillStorage.authenticate() call so handlers can
   * assume they're current (within the request's read-after-write window).
   */
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeSubscriptionStatus?: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'paused' | 'disputed';
  /**
   * Unix-seconds. Used to gate tier expiry on next request.
   */
  stripeCurrentPeriodEnd?: number;
}

export interface ApiKeyRecord {
  id: string;
  tenantId: string;
  keyHash: string;
  name: string;
  isActive: boolean;
}

/* ------------------------------------------------------------------ */
/*  User Accounts (for JWT/GitHub OAuth)                               */
/* ------------------------------------------------------------------ */

export interface GitHubProfile {
  id: number;
  login: string;
  name: string | null;
  /** Plaintext at the OAuth provider — must be hashed before storage. */
  email: string | null;
  avatar_url: string | null;
  [key: string]: unknown;
}

export interface User {
  id: string;
  /** HMAC-SHA256 of plaintext email — never the plaintext (Decision 0002). */
  emailHash: string | null;
  githubId: string;
  githubLogin: string;
  githubName: string | null;
  avatarUrl: string | null;
  tier: Tier;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Usage / Rate Limits                                                */
/* ------------------------------------------------------------------ */

/**
 * TIER_LIMITS — quota axis for the Stripe subscription tiers (#803).
 *
 * TWO-AXIS MODEL (resolved by #803 — do not conflate):
 *   Axis 1 (this): Stripe subscription quotas — monthly/daily call caps per
 *   tier, enforced by enforceRateLimit() against storage-backed counters.
 *   Axis 2: x402 per-call pricing (pricing.ts in quill-mcp) — the agent-native
 *   pay-per-call rail. A tenant can be Free on axis 1 and still pay x402 per
 *   call on axis 2; they are independent surfaces.
 */
export const TIER_LIMITS: Record<Tier, { monthly: number; daily: number }> = {
  free:      { monthly: 1_000,  daily: 35 },
  pro:       { monthly: 50_000, daily: 1_700 },
  business:  { monthly: 250_000, daily: 8_500 },
  enterprise:{ monthly: 1_000_000, daily: 35_000 },
  internal:  { monthly: 1_000_000, daily: 35_000 },
};

/* ------------------------------------------------------------------ */
/*  Query Options (Token Optimization Params)                          */
/* ------------------------------------------------------------------ */

export interface QueryOptions {
  /** Return only these top-level fields (e.g. ['data','meta']) */
  _fields?: string[];
  /** 'full' (default) or 'compact' — compact strips null/empty fields */
  _format?: 'full' | 'compact';
  /** Cap array results to N items */
  _limit?: number;
  /** Pagination offset */
  _page?: number;
  /** Normalize field names across sources */
  _normalize?: boolean;
  /** Unit conversion: 'metric' | 'imperial' */
  _units?: 'metric' | 'imperial';
  /** Return aggregate summary instead of rows */
  _summary?: boolean;
  /** Developer preview data — returns sample responses without live pipeline. For testing/development only. */
  _mock?: boolean;
}

export function parseQueryOptions(url: URL): QueryOptions {
  const opts: QueryOptions = {};

  const fields = url.searchParams.get('_fields');
  if (fields) {
    opts._fields = fields.split(',').map((f) => f.trim()).filter(Boolean);
  }

  const format = url.searchParams.get('_format');
  if (format === 'compact' || format === 'full') {
    opts._format = format;
  }

  const limit = url.searchParams.get('_limit');
  if (limit) {
    const n = parseInt(limit, 10);
    if (!isNaN(n) && n > 0) opts._limit = n;
  }

  const page = url.searchParams.get('_page');
  if (page) {
    const n = parseInt(page, 10);
    if (!isNaN(n) && n > 0) opts._page = n;
  }

  const normalize = url.searchParams.get('_normalize');
  if (normalize === 'true' || normalize === '1') opts._normalize = true;

  const units = url.searchParams.get('_units');
  if (units === 'metric' || units === 'imperial') opts._units = units;

  const summary = url.searchParams.get('_summary');
  if (summary === 'true' || summary === '1') opts._summary = true;

  const mock = url.searchParams.get('_mock');
  if (mock === 'true' || mock === '1') opts._mock = true;

  return opts;
}

/* ------------------------------------------------------------------ */
/*  Response Envelope (MapleSpike-compatible)                            */
/* ------------------------------------------------------------------ */

export interface ApiError {
  code: string;
  /** English message (always present) */
  message: string;
  /** French message (always present for bilingual support) */
  message_fr?: string;
  details?: unknown[];
}

export interface CitationMeta {
  source_name: string;
  source_url: string;
  retrieved_at: string | null;
  data_hash: string;
  license: string;
  license_url?: string;
  license_basis?: 'publisher-metadata' | 'source-configuration' | 'no-publisher-declaration';
  attribution_text?: string;
  update_frequency: string;
  original_format?: string;
  citation_text?: string;
  citation_footnote?: string;
}

export interface QualityMeta {
  freshness_seconds: number;
  source_uptime_7d: number;
  confidence: 'high' | 'medium' | 'low';
  certainty_score: number;
  /** Time when a verification check occurred, if measured; not source retrieval time. */
  last_verified?: string;
  /** Completeness indicator: 'complete' | 'partial' | 'estimated' */
  data_completeness?: string;
}

export interface UsageMeta {
  periodCalls: number;
  periodLimit: number;
  tier: Tier;
}

export interface ResponseMeta {
  requestId: string;
  timestamp: string;
  version: string;
  usage: UsageMeta;
  agent: string;
  action: string;
  authMethod: string;
  creditsCharged: number;
  cacheStatus: 'hit' | 'miss' | 'mock';
  durationMs: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  text: string | null;
  error: ApiError | null;
  meta: ResponseMeta;
  quality: QualityMeta | null;
  citation: CitationMeta | null;
}

/* ------------------------------------------------------------------ */
/*  Build Meta Overrides (per-route envelope deltas)                   */
/* ------------------------------------------------------------------ */

/**
 * Per-request meta overrides — set by route handlers to customise the
 * response envelope without rebuilding the whole BuildContext. Typical
 * use: live-data helpers flip `cacheStatus` to 'hit'/'miss' on cache events,
 * and usage-reporting routes publish the tenant's real counters through
 * `usage` so `meta.usage` is never a hardcoded zero.
 */
export type BuildMetaOverrides = Partial<{
  agent: string;
  action: string;
  authMethod: string;
  creditsCharged: number;
  cacheStatus: 'hit' | 'miss' | 'mock';
  durationMs: number;
  /** Per-tenant usage summary for `meta.usage`. Omitted fields fall back to the envelope defaults. */
  usage: Partial<UsageMeta>;
}>;

/* ------------------------------------------------------------------ */
/*  Request Context (per-request state)                                */
/* ------------------------------------------------------------------ */

export interface RouteContext {
  tenant: Tenant;
  apiKeyId: string;
  requestId: string;
  startTime: number;
  env: Record<string, string | undefined>;
  db: QuillStorage;
  cache: QuillCache;
  /**
   * Optional envelope deltas. Live-data helpers (e.g. packages/api-server/src/routes/_live.ts)
   * write cacheStatus here after a cache lookup so the response meta envelope
   * reports the correct cache state. Route handlers construct the response via
   * `buildSuccess(data, ctx)`, which reads BuildMetaOverrides from this field.
   */
  metaOverrides?: BuildMetaOverrides;
  /**
   * Parsed query-string token-optimisation options. Set by handleRequest
   * from the incoming URL and forwarded to BuildContext.queryOptions.
   */
  queryOptions?: QueryOptions;
}

/* ------------------------------------------------------------------ */
/*  Stripe billing state (orders + tenant billing linkage)             */
/* ------------------------------------------------------------------ */

/**
 * Persisted Stripe order. Survives pod restart (unlike the previous
 * in-memory `Map<string, StripeOrder>`). All fields except the immutable
 * primary keys are nullable so the table can grow without breaking the
 * pre-Stripe-era schema.
 */
export interface StripeOrder {
  order_id: string;
  tenant_id: string;
  plan_id: 'free' | 'pro' | 'business';
  amount_cents: number;
  currency: string;
  /**
   * Bind to Stripe Checkout Session. UNIQUE — first writer wins, second
   * writer's webhook delivery becomes a no-op (idempotent via UPSERT).
   */
  stripe_checkout_session_id: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  /** Order lifecycle. Mirrors orders.status in schema.ts. */
  status: 'pending' | 'paid' | 'expired' | 'cancelled' | 'fulfilled';
  /** Unix seconds. */
  created_at: number;
  expires_at: number;
  paid_at?: number;
  fulfilled_at?: number;
  cancelled_at?: number;
}

/* ── Tax ledger (#811 — GST/HST tracker) ─────────────────────────── */

export type TaxLedgerEntryType = 'charge' | 'refund' | 'adjustment';

export interface TaxLedgerEntryInsert {
  /** Idempotency key — the Stripe event ID (or a deterministic operator key). */
  id: string;
  entryType: TaxLedgerEntryType;
  /** Signed cents: +charge, −refund. */
  amountCents: number;
  currency: string;
  orderId?: string | null;
  tenantId?: string | null;
  /** Stripe event ID when sourced from a webhook; UNIQUE. */
  stripeEventId?: string | null;
  note?: string | null;
  /** Unix seconds. Defaults to now. */
  createdAt?: number;
}

export interface TaxLedgerSummary {
  /** Gross charges in the window (positive cents). */
  grossCents: number;
  /** Absolute value of refunds in the window (positive cents). */
  refundsCents: number;
  /** Net taxable revenue = gross − refunds (cents). */
  netCents: number;
  /** Net as CAD dollars, for display. */
  netCad: number;
  /** Unix seconds of window start. */
  windowStartUnix: number;
  /** Most recent ledger event ID processed (dedupe cursor). */
  lastEventId: string | null;
  entryCount: number;
}

export interface StripeOrderInsert {
  order_id: string;
  tenant_id: string;
  plan_id: 'free' | 'pro' | 'business';
  amount_cents: number;
  currency: string;
  stripe_checkout_session_id: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled' | 'fulfilled';
  expires_at: number;
}

export interface StripeOrderUpdates {
  status?: StripeOrder['status'];
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  paid_at?: number;
  fulfilled_at?: number;
  cancelled_at?: number;
}

export interface TenantStripeUpdates {
  /** Tier is the canonical plan — writing 'pro' here upgrades a tenant. */
  tier?: Tier;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeSubscriptionStatus?: Tenant['stripeSubscriptionStatus'];
  /** Unix-seconds. */
  stripeCurrentPeriodEnd?: number;
}

/**
 * AUDIT-LOG-3 — durable payment reconciliation row. INSERT into the
 * payment_reconciliations table on every Stripe webhook receipt, before
 * handler dispatch. UNIQUE(transaction_uid) provides idempotency at the
 * DB layer: a Stripe retry on 5xx lands as a no-op (existing row wins).
 * channel='stripe' here; the same shape supports interac_webhook / plaid_ca
 * when those streams are introduced.
 */
export type PaymentChannel = 'stripe' | 'interac_webhook' | 'plaid_ca';

export interface PaymentReconciliation {
  /** Auto-incremented primary key. Set on the read path. */
  id?: number;
  /** Stripe event id, e-Transfer IMAP UID, or Plaid transaction id. */
  transactionUid: string;
  orderId?: string;
  amountCents?: number;
  /** Provider reference (Stripe Checkout Session id, e-Transfer tx id, etc). */
  reference?: string;
  channel: PaymentChannel;
  /** Unix-seconds when the row was written. */
  processedAt?: number;
}

export interface PaymentReconciliationInsert {
  transactionUid: string;
  orderId?: string;
  amountCents?: number;
  reference?: string;
  channel: PaymentChannel;
}

/**
 * STRIPE-1 — record returned by reconciliation sweep. Each entry is a
 * tenant whose current subscription period has expired and whose tier
 * must be downgraded. Auto-collected so the cron route has zero allocations.
 */
export interface ExpiringTier {
  tenant_id: string;
  stripe_current_period_end: number;
  tier: 'free' | 'pro' | 'business' | 'enterprise' | 'internal';
}

/* ------------------------------------------------------------------ */
/*  Storage Abstraction (D1 / local)                                   */
/* ------------------------------------------------------------------ */

export interface QuillStorage {
  /** Look up tenant + API key by raw key value. Returns null if invalid. */
  authenticate(rawKey: string): Promise<{ tenant: Tenant; apiKeyId: string; rotatedKey?: { id: string; key: string; expiresAt: string } } | null>;
  /** Get current daily call count for a tenant. */
  getDailyUsage(tenantId: string, date: string): Promise<number>;
  /** Get current monthly call count for a tenant. */
  getMonthlyUsage(tenantId: string, yearMonth: string): Promise<number>;
  /** Increment usage counters for a tenant. */
  incrementUsage(tenantId: string, date: string, yearMonth: string): Promise<void>;
  /** Log an audit entry. */
  logAudit(entry: Omit<AuditEntry, 'id' | 'created_at'>): Promise<void>;
  /** Query audit log. */
  queryAudit(filter: AuditQueryParams): Promise<AuditEntry[]>;
  /** List API keys for a tenant. Returns key metadata (not the raw key/hash). */
  listApiKeys(tenantId: string): Promise<Array<{ id: string; name: string; isActive: boolean; createdAt: string; lastUsedAt: string | null }>>;

  /* ─── Stripe billing persistence (Phase 1: replaces in-memory Maps) ─── */
  /** Insert a new Stripe order. Throws on UNIQUE(stripe_checkout_session_id) violation. */
  createStripeOrder(order: StripeOrderInsert): Promise<void>;
  /** Look up a Stripe order by its opaque order_id. */
  getStripeOrderById(orderId: string): Promise<StripeOrder | null>;
  /** Look up a Stripe order by Stripe Checkout Session id. The dedupe key for Stripe webhook retries. */
  getStripeOrderBySessionId(sessionId: string): Promise<StripeOrder | null>;
  /** Patch an existing Stripe order (caller passes only changed fields). */
  updateStripeOrder(orderId: string, updates: StripeOrderUpdates): Promise<void>;
  /**
   * Atomically upsert tenant's Stripe billing linkage. Used by webhook to
   * promote a tenant's tier after a Stripe event. Tier writes also persist
   * to tenants.tier so subsequent authenticated requests reflect the
   * upgrade without consulting an in-memory cache.
   */
  updateTenantStripe(tenantId: string, updates: TenantStripeUpdates): Promise<void>;
  /** Look up a tenant's Stripe customer id (cross-tenant defense-in-depth check in authorizeEvent). */
  getTenantStripeCustomerId(tenantId: string): Promise<string | null>;
  /** Bound Stripe subscription id, or null if unset. */
  getTenantStripeSubscriptionId(tenantId: string): Promise<string | null>;
  /** Tenant's stored Stripe subscription status (e.g. 'disputed' entitlement hold). */
  getTenantStripeSubscriptionStatus(tenantId: string): Promise<string | null>;

  /* ── AUDIT-LOG-3: payment_reconciliations persistence ── */
  /** Insert a payment reconciliation row. Throws on UNIQUE(transactionUid) violation. */
  createPaymentReconciliation(rec: PaymentReconciliationInsert): Promise<void>;
  /** Most-recent reconciliation rows for diagnostics. */
  getPaymentReconciliations(limit?: number): Promise<PaymentReconciliation[]>;

  /* ── STRIPE-1: tier-expiry sweep for cron reconciler ── */
  /** Tenants whose stripe_current_period_end is past AND tier is non-free. */
  findTenantsForTierExpiry(nowUnix: number): Promise<ExpiringTier[]>;

  /* ── Tax ledger (#811 — GST/HST taxable-revenue tracker) ── */
  /** Create the tax_ledger table if missing (idempotent, lazy). */
  ensureTaxLedgerSchema(): Promise<void>;
  /** Append a ledger entry. Throws on UNIQUE(id) violation (replay). */
  insertTaxLedgerEntry(entry: TaxLedgerEntryInsert): Promise<void>;
  /** True if a ledger entry with this idempotency key exists. */
  hasTaxLedgerEntry(id: string): Promise<boolean>;
  /** Rolling-window summary: charges net of refunds since windowStartUnix. */
  getTaxLedgerSummary(windowStartUnix: number): Promise<TaxLedgerSummary>;

  /* ── Watchlist alerts (watchlist-alerts-v1) ── */
  /** Create the watches/watch_events tables if missing (idempotent, lazy). */
  ensureWatchSchema(): Promise<void>;
  /** Create a watch for a tenant. */
  createWatch(input: WatchInsert): Promise<Watch>;
  /** List a tenant's watches (active and inactive). */
  listWatches(tenantId: string): Promise<Watch[]>;
  /** Active watches across all tenants — the matching engine's read path. */
  listAllActiveWatches(): Promise<Watch[]>;
  /** Get one watch, tenant-scoped. */
  getWatch(id: string, tenantId: string): Promise<Watch | null>;
  /** Delete a watch, tenant-scoped. Returns false when nothing matched. */
  deleteWatch(id: string, tenantId: string): Promise<boolean>;
  /** Count a tenant's active watches (plan-limit enforcement). */
  countActiveWatches(tenantId: string): Promise<number>;
  /** Record a watch event. Returns null when the (watch,change) pair already exists. */
  insertWatchEvent(event: WatchEventInsert): Promise<WatchEvent | null>;
  /** Recent events for one watch, tenant-scoped, newest first. */
  listWatchEvents(watchId: string, tenantId: string, limit: number): Promise<WatchEvent[]>;
  /** Update delivery status for an event. */
  updateWatchEventStatus(id: string, status: WatchEvent['status'], error?: string): Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Watchlist alerts (watchlist-alerts-v1)                             */
/* ------------------------------------------------------------------ */

export type WatchDelivery = 'events' | 'webhook';

export interface Watch {
  id: string;
  tenantId: string;
  /** Source ids to watch; empty array = every source. */
  sources: string[];
  /** Event types to watch; empty array = every type. */
  events: string[];
  /** Optional case-insensitive substring match on the change summary. */
  keyword?: string;
  /** 'events' records to the event log only; 'webhook' also dispatches. */
  delivery: WatchDelivery;
  label?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WatchInsert {
  tenantId: string;
  sources: string[];
  events: string[];
  keyword?: string;
  delivery?: WatchDelivery;
  label?: string;
}

export interface WatchEventEvidence {
  /** Upstream source URL from the watched-source registry, when known. */
  sourceUrl: string | null;
  detectedAt: string;
  previousHash: string;
  currentHash: string;
  recordCount: number;
}

export interface WatchEvent {
  id: string;
  watchId: string;
  tenantId: string;
  /** `${sourceId}:${currentHash}` — stable dedupe key. */
  changeKey: string;
  sourceId: string;
  sourceName: string;
  summary: string;
  evidence: WatchEventEvidence;
  status: 'recorded' | 'delivered' | 'failed';
  deliveryError?: string;
  createdAt: string;
}

export interface WatchEventInsert {
  watchId: string;
  tenantId: string;
  changeKey: string;
  sourceId: string;
  sourceName: string;
  summary: string;
  evidence: WatchEventEvidence;
}

export interface QuillCache {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, ttlSeconds?: number): Promise<void>;
  /** Atomically remove a key. Used for single-use OAuth exchange codes. */
  delete(key: string): Promise<void>;
}

export interface AuditEntry {
  id?: number;
  tenantId: string;
  apiKeyId?: string;
  operation: string;
  model?: string;
  endpoint: string;
  inputPreview?: string;
  outputSummary?: string;
  confidence?: number | null;
  success: boolean;
  errorMessage?: string;
  durationMs: number;
  createdAt?: string;
}

export interface AuditQueryParams {
  tenantId: string;
  operation?: string;
  success?: boolean;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}

/* ------------------------------------------------------------------ */
/*  Route Handler                                                      */
/* ------------------------------------------------------------------ */

export type RouteHandler = (
  request: Request,
  ctx: RouteContext,
  params: Record<string, string>,
) => Promise<Response>;

/* ------------------------------------------------------------------ */
/*  Workers Env (inlined to avoid dep requirement)                     */
/* ------------------------------------------------------------------ */

export interface Env {
  DB: {
    prepare(sql: string): {
      bind(...params: unknown[]): {
        run(): Promise<{ meta: Record<string, unknown> }>;
        all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
        first<T = Record<string, unknown>>(): Promise<T | null>;
      };
    };
  };
  CACHE: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
    delete(key: string): Promise<void>;
  };
  ENVIRONMENT?: string;
  QUILL_VERSION?: string;
  /** Display name used in logs/responses. Was MAPLESPIKE_NAME pre-2026-07-04 (ADR 0007). */
  QUILL_NAME?: string;
  QUILL_STORAGE?: string;
  DATABASE_URL?: string;
  QUILL_DB_HOST?: string;
  FREE_LIMIT?: string;
  PRO_LIMIT?: string;
  BUSINESS_LIMIT?: string;
  AI_ENDPOINT?: string;
  AI_MODEL?: string;
  JWT_SECRET?: string;
  /** Declared money mode: 'live' or 'test'. Must agree with STRIPE_SECRET_KEY. */
  STRIPE_ENV?: string;
  STRIPE_SECRET_KEY?: string;
}
