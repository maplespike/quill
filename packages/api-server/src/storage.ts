/**
 * Quill — Storage Abstraction
 *
 * Provides D1-backed and in-memory storage implementations
 * of the QuillStorage interface.
 */

import type { QuillStorage, QuillCache, Tenant, AuditEntry, AuditQueryParams, StripeOrder, StripeOrderInsert, StripeOrderUpdates, TenantStripeUpdates, PaymentReconciliation, PaymentReconciliationInsert, ExpiringTier } from './types.js';
import { hashApiKey } from './auth.js';
import type { Env } from './types.js';

/* ------------------------------------------------------------------ */
/*  D1 Implementation (Cloudflare Workers production)                  */
/* ------------------------------------------------------------------ */

export class D1Storage implements QuillStorage {
  private db: Env['DB'];

  constructor(db: Env['DB']) {
    this.db = db;
  }

  async authenticate(rawKey: string): Promise<{ tenant: Tenant; apiKeyId: string; rotatedKey?: { id: string; key: string; expiresAt: string } } | null> {
    const keyHash = await hashApiKey(rawKey);

    const row = await this.db.prepare(`
      SELECT t.id AS tenant_id, t.name, t.email_hash, t.email_verified, t.tier, t.is_active, t.journalism_mode,
             t.stripe_customer_id, t.stripe_subscription_id, t.stripe_subscription_status,
             t.stripe_current_period_end,
             k.id AS key_id, k.is_active AS key_active, k.expires_at
      FROM api_keys k
      JOIN tenants t ON t.id = k.tenant_id
      WHERE k.key_hash = ?1
    `).bind(keyHash).first<Record<string, unknown>>();

    if (!row) return null;
    if (!row.key_active || !row.is_active) return null;

    const expiresAt = row.expires_at as string | null;
    const now = new Date();
    if (expiresAt && new Date(expiresAt) < now) {
      return null;
    }

    await this.db.prepare('UPDATE api_keys SET last_used_at = datetime(\'now\') WHERE id = ?1')
      .bind(row.key_id).run();

    return {
      tenant: {
        id: row.tenant_id as string,
        name: row.name as string,
        emailHash: row.email_hash as string || undefined,
        emailVerified: Boolean(row.email_verified),
        tier: row.tier as Tenant['tier'],
        isActive: Boolean(row.is_active),
        journalismMode: Boolean(row.journalism_mode),
        stripeCustomerId: (row.stripe_customer_id as string | null) ?? undefined,
        stripeSubscriptionId: (row.stripe_subscription_id as string | null) ?? undefined,
        stripeSubscriptionStatus:
          (row.stripe_subscription_status as Tenant['stripeSubscriptionStatus']) ?? undefined,
        stripeCurrentPeriodEnd: (row.stripe_current_period_end as number | null) ?? undefined,
      },
      apiKeyId: row.key_id as string,
    };
  }

  async getDailyUsage(tenantId: string, date: string): Promise<number> {
    const row = await this.db.prepare(
      'SELECT call_count FROM daily_usage WHERE tenant_id = ?1 AND date = ?2',
    ).bind(tenantId, date).first<{ call_count: number }>();

    return row?.call_count || 0;
  }

  async getMonthlyUsage(tenantId: string, yearMonth: string): Promise<number> {
    const row = await this.db.prepare(
      'SELECT call_count FROM monthly_usage WHERE tenant_id = ?1 AND year_month = ?2',
    ).bind(tenantId, yearMonth).first<{ call_count: number }>();

    return row?.call_count || 0;
  }

  async incrementUsage(tenantId: string, date: string, yearMonth: string): Promise<void> {
    await this.db.prepare(`
      INSERT INTO daily_usage (tenant_id, date, call_count)
      VALUES (?1, ?2, 1)
      ON CONFLICT(tenant_id, date) DO UPDATE SET call_count = call_count + 1
    `).bind(tenantId, date).run();

    await this.db.prepare(`
      INSERT INTO monthly_usage (tenant_id, year_month, call_count)
      VALUES (?1, ?2, 1)
      ON CONFLICT(tenant_id, year_month) DO UPDATE SET call_count = call_count + 1
    `).bind(tenantId, yearMonth).run();
  }

  async logAudit(entry: Omit<AuditEntry, 'id' | 'created_at'>): Promise<void> {
    await this.db.prepare(`
      INSERT INTO audit_log (tenant_id, api_key_id, operation, model, endpoint, input_preview, output_summary, confidence, success, error_message, duration_ms)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
    `).bind(
      entry.tenantId,
      entry.apiKeyId || null,
      entry.operation,
      entry.model || null,
      entry.endpoint,
      (entry.inputPreview || '').slice(0, 500),
      (entry.outputSummary || '').slice(0, 500),
      entry.confidence ?? null,
      entry.success ? 1 : 0,
      entry.errorMessage || null,
      entry.durationMs,
    ).run();
  }

  async queryAudit(filter: AuditQueryParams): Promise<AuditEntry[]> {
    let sql = 'SELECT * FROM audit_log WHERE tenant_id = ?1';
    const params: unknown[] = [filter.tenantId];

    if (filter.operation) {
      sql += ' AND operation = ?2';
      params.push(filter.operation);
    }
    if (filter.success !== undefined) {
      sql += ' AND success = ?' + (params.length + 1);
      params.push(filter.success ? 1 : 0);
    }
    if (filter.since) {
      sql += ' AND created_at >= ?' + (params.length + 1);
      params.push(filter.since);
    }
    if (filter.until) {
      sql += ' AND created_at <= ?' + (params.length + 1);
      params.push(filter.until);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?' + (params.length + 1) + ' OFFSET ?' + (params.length + 2);
    params.push(filter.limit || 50, filter.offset || 0);

    const result = await this.db.prepare(sql).bind(...params).all<AuditEntry>();
    return result.results || [];
  }

  async listApiKeys(tenantId: string): Promise<Array<{ id: string; name: string; isActive: boolean; createdAt: string; lastUsedAt: string | null }>> {
    const result = await this.db.prepare(
      'SELECT id, name, is_active, created_at, last_used_at FROM api_keys WHERE tenant_id = ?1 ORDER BY created_at DESC',
    ).bind(tenantId).all<{ id: string; name: string; is_active: number; created_at: string; last_used_at: string | null }>();
    return (result.results || []).map((row) => ({
      id: row.id,
      name: row.name,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
    }));
  }

  /* ── Stripe billing persistence (D1) ───────────────────────────────── */

  async createStripeOrder(order: StripeOrderInsert): Promise<void> {
    await this.db.prepare(`
      INSERT INTO stripe_orders (
        order_id, tenant_id, plan_id, amount_cents, currency,
        stripe_checkout_session_id, status, created_at, expires_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, unixepoch(), ?8)
    `).bind(
      order.order_id,
      order.tenant_id,
      order.plan_id,
      order.amount_cents,
      order.currency,
      order.stripe_checkout_session_id,
      order.status,
      order.expires_at,
    ).run();
  }

  async getStripeOrderById(orderId: string): Promise<StripeOrder | null> {
    const row = await this.db.prepare('SELECT * FROM stripe_orders WHERE order_id = ?1')
      .bind(orderId).first<Record<string, unknown>>();
    return row ? this.mapStripeOrderD1(row) : null;
  }

  async getStripeOrderBySessionId(sessionId: string): Promise<StripeOrder | null> {
    const row = await this.db.prepare('SELECT * FROM stripe_orders WHERE stripe_checkout_session_id = ?1')
      .bind(sessionId).first<Record<string, unknown>>();
    return row ? this.mapStripeOrderD1(row) : null;
  }

  async updateStripeOrder(orderId: string, updates: StripeOrderUpdates): Promise<void> {
    const sets: string[] = [];
    const args: unknown[] = [];
    if (updates.status !== undefined) { sets.push('status = ?' + (args.push(updates.status) + 1)); }
    if (updates.stripe_customer_id !== undefined) { sets.push('stripe_customer_id = ?' + (args.push(updates.stripe_customer_id) + 1)); }
    if (updates.stripe_subscription_id !== undefined) { sets.push('stripe_subscription_id = ?' + (args.push(updates.stripe_subscription_id) + 1)); }
    if (updates.paid_at !== undefined) { sets.push('paid_at = ?' + (args.push(updates.paid_at) + 1)); }
    if (updates.fulfilled_at !== undefined) { sets.push('fulfilled_at = ?' + (args.push(updates.fulfilled_at) + 1)); }
    if (updates.cancelled_at !== undefined) { sets.push('cancelled_at = ?' + (args.push(updates.cancelled_at) + 1)); }
    if (sets.length === 0) return;
    args.push(orderId);
    await this.db.prepare(`UPDATE stripe_orders SET ${sets.join(', ')} WHERE order_id = ?${args.length}`).bind(...args).run();
  }

  async updateTenantStripe(tenantId: string, updates: TenantStripeUpdates): Promise<void> {
    const sets: string[] = [`stripe_updated_at = datetime('now')`];
    const args: unknown[] = [];
    if (updates.tier !== undefined) { sets.push('tier = ?' + (args.push(updates.tier) + 1)); }
    if (updates.stripeCustomerId !== undefined) { sets.push('stripe_customer_id = ?' + (args.push(updates.stripeCustomerId) + 1)); }
    if (updates.stripeSubscriptionId !== undefined) { sets.push('stripe_subscription_id = ?' + (args.push(updates.stripeSubscriptionId) + 1)); }
    if (updates.stripeSubscriptionStatus !== undefined) { sets.push('stripe_subscription_status = ?' + (args.push(updates.stripeSubscriptionStatus) + 1)); }
    if (updates.stripeCurrentPeriodEnd !== undefined) { sets.push('stripe_current_period_end = ?' + (args.push(updates.stripeCurrentPeriodEnd) + 1)); }
    args.push(tenantId);
    await this.db.prepare(`UPDATE tenants SET ${sets.join(', ')} WHERE id = ?${args.length}`).bind(...args).run();
  }

  async getTenantStripeCustomerId(tenantId: string): Promise<string | null> {
    const row = await this.db.prepare('SELECT stripe_customer_id FROM tenants WHERE id = ?1')
      .bind(tenantId).first<{ stripe_customer_id: string | null }>();
    return row?.stripe_customer_id ?? null;
  }

  /** D1 sqlite row → StripeOrder canonicalisation */
  private mapStripeOrderD1(row: Record<string, unknown>): StripeOrder {
    return {
      order_id: row.order_id as string,
      tenant_id: row.tenant_id as string,
      plan_id: row.plan_id as StripeOrder['plan_id'],
      amount_cents: row.amount_cents as number,
      currency: row.currency as string,
      stripe_checkout_session_id: row.stripe_checkout_session_id as string,
      stripe_customer_id: (row.stripe_customer_id as string | null) ?? undefined,
      stripe_subscription_id: (row.stripe_subscription_id as string | null) ?? undefined,
      status: row.status as StripeOrder['status'],
      created_at: row.created_at as number,
      expires_at: row.expires_at as number,
      paid_at: (row.paid_at as number | null) ?? undefined,
      fulfilled_at: (row.fulfilled_at as number | null) ?? undefined,
      cancelled_at: (row.cancelled_at as number | null) ?? undefined,
    };
  }

  /* ── AUDIT-LOG-3 + STRIPE-1 (D1) ── */

  async ensureReconciliationsSchema(): Promise<void> {
    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS payment_reconciliations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_uid TEXT NOT NULL UNIQUE,
        order_id TEXT,
        amount_cents INTEGER,
        reference TEXT,
        channel TEXT NOT NULL DEFAULT 'stripe',
        processed_at INTEGER DEFAULT (unixepoch())
      )
    `).bind().run();
    await this.db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_reconciliations_processed ON payment_reconciliations(processed_at DESC)
    `).bind().run();
  }

  async createPaymentReconciliation(rec: PaymentReconciliationInsert): Promise<void> {
    await this.ensureReconciliationsSchema();
    await this.db.prepare(`INSERT INTO payment_reconciliations (transaction_uid, order_id, amount_cents, reference, channel) VALUES (?1, ?2, ?3, ?4, ?5)`).bind(
      rec.transactionUid, rec.orderId ?? null, rec.amountCents ?? null, rec.reference ?? null, rec.channel,
    ).run();
  }

  async getPaymentReconciliations(limit: number = 50): Promise<PaymentReconciliation[]> {
    await this.ensureReconciliationsSchema();
    const result = await this.db.prepare(`SELECT id, transaction_uid AS transactionUid, order_id AS orderId, amount_cents AS amountCents, reference, channel, processed_at AS processedAt FROM payment_reconciliations ORDER BY processed_at DESC LIMIT ?1`).bind(limit).all<Record<string, unknown>>();
    return (result.results || []).map((r) => ({
      id: r.id as number,
      transactionUid: r.transactionUid as string,
      orderId: (r.orderId as string | null) ?? undefined,
      amountCents: (r.amountCents as number | null) ?? undefined,
      reference: (r.reference as string | null) ?? undefined,
      channel: r.channel as PaymentReconciliation['channel'],
      processedAt: (r.processedAt as number | null) ?? undefined,
    }));
  }

  async findTenantsForTierExpiry(nowUnix: number): Promise<ExpiringTier[]> {
    const result = await this.db.prepare(`SELECT id AS tenant_id, stripe_current_period_end, tier FROM tenants WHERE stripe_current_period_end IS NOT NULL AND stripe_current_period_end < ?1 AND tier != 'free'`).bind(nowUnix).all<{ tenant_id: string; stripe_current_period_end: number; tier: string }>();
    return (result.results || []).map((r) => ({
      tenant_id: r.tenant_id,
      stripe_current_period_end: r.stripe_current_period_end,
      tier: r.tier as ExpiringTier['tier'],
    }));
  }
}

/* ------------------------------------------------------------------ */
/*  KV Cache Implementation                                            */
/* ------------------------------------------------------------------ */

export class KVCache implements QuillCache {
  private kv: Env['CACHE'];

  constructor(kv: Env['CACHE']) {
    this.kv = kv;
  }

  async get(key: string): Promise<string | null> {
    return this.kv.get(key);
  }

  async put(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.kv.put(key, value, { expirationTtl: ttlSeconds });
    } else {
      await this.kv.put(key, value);
    }
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(key);
  }
}

/* ------------------------------------------------------------------ */
/*  In-Memory Implementation (development / testing)                   */
/* ------------------------------------------------------------------ */

export class MemoryStorage implements QuillStorage {
  private tenants: Map<string, Tenant> = new Map();
  private keyToTenant: Map<string, { tenantId: string; keyId: string }> = new Map();
  private dailyUsage: Map<string, number> = new Map();
  private monthlyUsage: Map<string, number> = new Map();
  private auditLog: AuditEntry[] = [];
  // Stripe billing (in-memory). Mirrors the persistent table semantics so
  // tests can exercise the same code paths as production.
  private stripeOrders: Map<string, StripeOrder> = new Map();
  private stripeOrdersBySession: Map<string, string> = new Map();

  constructor() {
    // No hardcoded keys — demo keys are opt-in via ALLOW_DEMO_KEYS in auth.ts
  }

  /** Register a new tenant + key for testing. */
  registerTenant(tenant: Tenant, keyHash: string, keyId: string): void {
    this.tenants.set(tenant.id, tenant);
    this.keyToTenant.set(keyHash, { tenantId: tenant.id, keyId });
  }

  async authenticate(rawKey: string): Promise<{ tenant: Tenant; apiKeyId: string; rotatedKey?: { id: string; key: string; expiresAt: string } } | null> {
    const keyHash = await hashApiKey(rawKey);
    const mapping = this.keyToTenant.get(keyHash);
    if (!mapping) return null;
    const tenant = this.tenants.get(mapping.tenantId);
    if (!tenant || !tenant.isActive) return null;
    return { tenant, apiKeyId: mapping.keyId };
  }

  async getDailyUsage(tenantId: string, date: string): Promise<number> {
    return this.dailyUsage.get(`${tenantId}:${date}`) || 0;
  }

  async getMonthlyUsage(tenantId: string, yearMonth: string): Promise<number> {
    return this.monthlyUsage.get(`${tenantId}:${yearMonth}`) || 0;
  }

  async incrementUsage(tenantId: string, date: string, yearMonth: string): Promise<void> {
    const dKey = `${tenantId}:${date}`;
    this.dailyUsage.set(dKey, (this.dailyUsage.get(dKey) || 0) + 1);
    const mKey = `${tenantId}:${yearMonth}`;
    this.monthlyUsage.set(mKey, (this.monthlyUsage.get(mKey) || 0) + 1);
  }

  async logAudit(entry: Omit<AuditEntry, 'id' | 'created_at'>): Promise<void> {
    this.auditLog.push({
      ...entry,
      createdAt: new Date().toISOString(),
    });
  }

  async queryAudit(filter: AuditQueryParams): Promise<AuditEntry[]> {
    let results = [...this.auditLog].filter((e) => e.tenantId === filter.tenantId);
    if (filter.operation) results = results.filter((e) => e.operation === filter.operation);
    if (filter.success !== undefined) results = results.filter((e) => e.success === filter.success);
    if (filter.since) results = results.filter((e) => (e.createdAt || '') >= filter.since!);
    if (filter.until) results = results.filter((e) => (e.createdAt || '') <= filter.until!);
    const offset = filter.offset || 0;
    const limit = filter.limit || 50;
    return results.slice(offset, offset + limit);
  }

  async listApiKeys(tenantId: string): Promise<Array<{ id: string; name: string; isActive: boolean; createdAt: string; lastUsedAt: string | null }>> {
    const keys: Array<{ id: string; name: string; isActive: boolean; createdAt: string; lastUsedAt: string | null }> = [];
    for (const [keyHash, mapping] of this.keyToTenant) {
      if (mapping.tenantId === tenantId) {
        keys.push({
          id: mapping.keyId,
          name: mapping.keyId === 'dev-key-1' ? 'dev' : 'default',
          isActive: true,
          createdAt: new Date().toISOString(),
          lastUsedAt: null,
        });
      }
    }
    return keys;
  }

  /* ── Stripe billing persistence (MemoryStorage) ─────────────────── */

  async createStripeOrder(order: StripeOrderInsert): Promise<void> {
    if (this.stripeOrdersBySession.has(order.stripe_checkout_session_id)) {
      throw new Error(
        `UNIQUE constraint: stripe_checkout_session_id=${order.stripe_checkout_session_id} already exists`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const full: StripeOrder = { ...order, created_at: now };
    this.stripeOrders.set(order.order_id, full);
    this.stripeOrdersBySession.set(order.stripe_checkout_session_id, order.order_id);
  }

  async getStripeOrderById(orderId: string): Promise<StripeOrder | null> {
    return this.stripeOrders.get(orderId) ?? null;
  }

  async getStripeOrderBySessionId(sessionId: string): Promise<StripeOrder | null> {
    const orderId = this.stripeOrdersBySession.get(sessionId);
    return orderId ? this.stripeOrders.get(orderId) ?? null : null;
  }

  async updateStripeOrder(orderId: string, updates: StripeOrderUpdates): Promise<void> {
    const existing = this.stripeOrders.get(orderId);
    if (!existing) return;
    this.stripeOrders.set(orderId, { ...existing, ...updates });
    if (updates.stripe_customer_id) {
      // Index by customer for defensive lookups.
      const t = this.tenants.get(existing.tenant_id);
      if (t && !t.stripeCustomerId) {
        this.tenants.set(existing.tenant_id, { ...t, stripeCustomerId: updates.stripe_customer_id });
      }
    }
  }

  async updateTenantStripe(tenantId: string, updates: TenantStripeUpdates): Promise<void> {
    const existing = this.tenants.get(tenantId);
    if (!existing) return;
    this.tenants.set(tenantId, {
      ...existing,
      tier: updates.tier ?? existing.tier,
      stripeCustomerId: updates.stripeCustomerId ?? existing.stripeCustomerId,
      stripeSubscriptionId: updates.stripeSubscriptionId ?? existing.stripeSubscriptionId,
      stripeSubscriptionStatus: updates.stripeSubscriptionStatus ?? existing.stripeSubscriptionStatus,
      stripeCurrentPeriodEnd: updates.stripeCurrentPeriodEnd ?? existing.stripeCurrentPeriodEnd,
    });
  }

  async getTenantStripeCustomerId(tenantId: string): Promise<string | null> {
    return this.tenants.get(tenantId)?.stripeCustomerId ?? null;
  }

  /* ── AUDIT-LOG-3 + STRIPE-1 (MemoryStorage) ── */

  private reconciliations: Map<string, PaymentReconciliation> = new Map();
  private reconciliationsSeq: number = 1;

  async createPaymentReconciliation(rec: PaymentReconciliationInsert): Promise<void> {
    if (this.reconciliations.has(rec.transactionUid)) {
      throw new Error(`UNIQUE constraint: payment_reconciliations.transaction_uid=${rec.transactionUid} already exists`);
    }
    this.reconciliations.set(rec.transactionUid, {
      id: this.reconciliationsSeq++,
      transactionUid: rec.transactionUid,
      orderId: rec.orderId,
      amountCents: rec.amountCents,
      reference: rec.reference,
      channel: rec.channel,
      processedAt: Math.floor(Date.now() / 1000),
    });
  }

  async getPaymentReconciliations(limit: number = 50): Promise<PaymentReconciliation[]> {
    const all = [...this.reconciliations.values()];
    all.sort((a, b) => (b.processedAt ?? 0) - (a.processedAt ?? 0));
    return all.slice(0, limit);
  }

  async findTenantsForTierExpiry(nowUnix: number): Promise<ExpiringTier[]> {
    const out: ExpiringTier[] = [];
    for (const t of this.tenants.values()) {
      if (typeof t.stripeCurrentPeriodEnd === 'number' && t.stripeCurrentPeriodEnd < nowUnix && t.tier !== 'free') {
        out.push({ tenant_id: t.id, stripe_current_period_end: t.stripeCurrentPeriodEnd, tier: t.tier });
      }
    }
    return out;
  }
}

export class MemoryCache implements QuillCache {
  private store = new Map<string, { value: string; expires: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expires && Date.now() > entry.expires) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async put(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expires = ttlSeconds ? Date.now() + ttlSeconds * 1000 : Infinity;
    this.store.set(key, { value, expires });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}
