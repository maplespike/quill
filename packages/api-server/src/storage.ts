/**
 * Quill — Storage Abstraction
 *
 * Provides D1-backed and in-memory storage implementations
 * of the QuillStorage interface.
 */

import type { QuillStorage, QuillCache, Tenant, AuditEntry, AuditQueryParams, StripeOrder, StripeOrderInsert, StripeOrderUpdates, TenantStripeUpdates, PaymentReconciliation, PaymentReconciliationInsert, ExpiringTier, TaxLedgerEntryInsert, TaxLedgerSummary, Watch, WatchInsert, WatchEvent, WatchEventInsert } from './types.js';
import { randomUUID } from 'node:crypto';
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
  async getTenantStripeSubscriptionId(tenantId: string): Promise<string | null> {
    const row = await this.db.prepare('SELECT stripe_subscription_id FROM tenants WHERE id = ?1')
      .bind(tenantId).first<{ stripe_subscription_id: string | null }>();
    const id = row?.stripe_subscription_id ?? null;
    return id ? id : null;
  }

  async getTenantStripeSubscriptionStatus(tenantId: string): Promise<string | null> {
    const row = await this.db.prepare('SELECT stripe_subscription_status FROM tenants WHERE id = ?1')
      .bind(tenantId).first<{ stripe_subscription_status: string | null }>();
    return row?.stripe_subscription_status ?? null;
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

  /* ── Tax ledger (#811 — D1) ── */

  async ensureTaxLedgerSchema(): Promise<void> {
    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS tax_ledger (
        id TEXT PRIMARY KEY NOT NULL,
        entry_type TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'CAD',
        order_id TEXT,
        tenant_id TEXT,
        stripe_event_id TEXT UNIQUE,
        note TEXT,
        created_at INTEGER NOT NULL
      )
    `).bind().run();
    await this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_tax_ledger_created ON tax_ledger(created_at)`).bind().run();
  }

  async insertTaxLedgerEntry(entry: TaxLedgerEntryInsert): Promise<void> {
    await this.ensureTaxLedgerSchema();
    await this.db.prepare(
      `INSERT INTO tax_ledger (id, entry_type, amount_cents, currency, order_id, tenant_id, stripe_event_id, note, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    ).bind(
      entry.id,
      entry.entryType,
      entry.amountCents,
      entry.currency,
      entry.orderId ?? null,
      entry.tenantId ?? null,
      entry.stripeEventId ?? null,
      entry.note ?? null,
      entry.createdAt ?? Math.floor(Date.now() / 1000),
    ).run();
  }

  async hasTaxLedgerEntry(id: string): Promise<boolean> {
    await this.ensureTaxLedgerSchema();
    const row = await this.db.prepare('SELECT id FROM tax_ledger WHERE id = ?1').bind(id).first<{ id: string }>();
    return row !== null;
  }

  async getTaxLedgerSummary(windowStartUnix: number): Promise<TaxLedgerSummary> {
    await this.ensureTaxLedgerSchema();
    const agg = await this.db.prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END), 0) AS gross_cents,
         COALESCE(SUM(CASE WHEN amount_cents < 0 THEN -amount_cents ELSE 0 END), 0) AS refunds_cents,
         COUNT(*) AS entry_count
       FROM tax_ledger WHERE created_at >= ?1`,
    ).bind(windowStartUnix).first<{ gross_cents: number; refunds_cents: number; entry_count: number }>();
    const lastResult = await this.db.prepare('SELECT id FROM tax_ledger ORDER BY created_at DESC LIMIT 1').bind().all<{ id: string }>();
    const last = (lastResult.results && lastResult.results[0]) || null;
    const gross = agg?.gross_cents ?? 0;
    const refunds = agg?.refunds_cents ?? 0;
    const net = gross - refunds;
    return {
      grossCents: gross,
      refundsCents: refunds,
      netCents: net,
      netCad: net / 100,
      windowStartUnix,
      lastEventId: last?.id ?? null,
      entryCount: agg?.entry_count ?? 0,
    };
  }

  /* ── Watchlist alerts (watchlist-alerts-v1) ─────────────────── */

  private watchSchemaReady = false;

  async ensureWatchSchema(): Promise<void> {
    if (this.watchSchemaReady) return;
    await this.db.prepare(`CREATE TABLE IF NOT EXISTS watches (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      sources TEXT NOT NULL DEFAULT '[]',
      events TEXT NOT NULL DEFAULT '[]',
      keyword TEXT,
      delivery TEXT NOT NULL DEFAULT 'events',
      label TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`).bind().run();
    await this.db.prepare('CREATE INDEX IF NOT EXISTS idx_watches_tenant ON watches(tenant_id)').bind().run();
    await this.db.prepare(`CREATE TABLE IF NOT EXISTS watch_events (
      id TEXT PRIMARY KEY,
      watch_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      change_key TEXT NOT NULL,
      source_id TEXT NOT NULL,
      source_name TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL,
      evidence TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'recorded',
      delivery_error TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(watch_id, change_key)
    )`).bind().run();
    await this.db.prepare('CREATE INDEX IF NOT EXISTS idx_watch_events_watch ON watch_events(watch_id)').bind().run();
    this.watchSchemaReady = true;
  }

  private mapWatchRow(row: Record<string, unknown>): Watch {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      sources: JSON.parse((row.sources as string) || '[]'),
      events: JSON.parse((row.events as string) || '[]'),
      keyword: (row.keyword as string | null) ?? undefined,
      delivery: (row.delivery as Watch['delivery']) || 'events',
      label: (row.label as string | null) ?? undefined,
      active: Boolean(row.active),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  private mapWatchEventRow(row: Record<string, unknown>): WatchEvent {
    return {
      id: row.id as string,
      watchId: row.watch_id as string,
      tenantId: row.tenant_id as string,
      changeKey: row.change_key as string,
      sourceId: row.source_id as string,
      sourceName: row.source_name as string,
      summary: row.summary as string,
      evidence: JSON.parse((row.evidence as string) || '{}'),
      status: row.status as WatchEvent['status'],
      deliveryError: (row.delivery_error as string | null) ?? undefined,
      createdAt: row.created_at as string,
    };
  }

  async createWatch(input: WatchInsert): Promise<Watch> {
    await this.ensureWatchSchema();
    const now = new Date().toISOString();
    const watch: Watch = {
      id: randomUUID(),
      tenantId: input.tenantId,
      sources: input.sources,
      events: input.events,
      keyword: input.keyword,
      delivery: input.delivery ?? 'events',
      label: input.label,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.prepare(
      `INSERT INTO watches (id, tenant_id, sources, events, keyword, delivery, label, active, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8, ?9)`,
    ).bind(
      watch.id,
      watch.tenantId,
      JSON.stringify(watch.sources),
      JSON.stringify(watch.events),
      watch.keyword ?? null,
      watch.delivery,
      watch.label ?? null,
      now,
      now,
    ).run();
    return watch;
  }

  async listWatches(tenantId: string): Promise<Watch[]> {
    await this.ensureWatchSchema();
    const res = await this.db.prepare(
      'SELECT * FROM watches WHERE tenant_id = ?1 ORDER BY created_at DESC',
    ).bind(tenantId).all<Record<string, unknown>>();
    return res.results.map((r) => this.mapWatchRow(r));
  }

  async listAllActiveWatches(): Promise<Watch[]> {
    await this.ensureWatchSchema();
    const res = await this.db.prepare('SELECT * FROM watches WHERE active = 1').bind().all<Record<string, unknown>>();
    return res.results.map((r) => this.mapWatchRow(r));
  }

  async getWatch(id: string, tenantId: string): Promise<Watch | null> {
    await this.ensureWatchSchema();
    const row = await this.db.prepare(
      'SELECT * FROM watches WHERE id = ?1 AND tenant_id = ?2',
    ).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? this.mapWatchRow(row) : null;
  }

  async deleteWatch(id: string, tenantId: string): Promise<boolean> {
    await this.ensureWatchSchema();
    const existing = await this.db.prepare(
      'SELECT id FROM watches WHERE id = ?1 AND tenant_id = ?2',
    ).bind(id, tenantId).first<{ id: string }>();
    if (!existing) return false;
    await this.db.prepare(
      'DELETE FROM watches WHERE id = ?1 AND tenant_id = ?2',
    ).bind(id, tenantId).run();
    return true;
  }

  async countActiveWatches(tenantId: string): Promise<number> {
    await this.ensureWatchSchema();
    const row = await this.db.prepare(
      'SELECT COUNT(*) AS n FROM watches WHERE tenant_id = ?1 AND active = 1',
    ).bind(tenantId).first<{ n: number }>();
    return Number(row?.n ?? 0);
  }

  async insertWatchEvent(event: WatchEventInsert): Promise<WatchEvent | null> {
    await this.ensureWatchSchema();
    const existing = await this.db.prepare(
      'SELECT id FROM watch_events WHERE watch_id = ?1 AND change_key = ?2',
    ).bind(event.watchId, event.changeKey).first<{ id: string }>();
    if (existing) return null;
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    await this.db.prepare(
      `INSERT INTO watch_events
         (id, watch_id, tenant_id, change_key, source_id, source_name, summary, evidence, status, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'recorded', ?9)`,
    ).bind(
      id,
      event.watchId,
      event.tenantId,
      event.changeKey,
      event.sourceId,
      event.sourceName,
      event.summary,
      JSON.stringify(event.evidence),
      createdAt,
    ).run();
    return { id, ...event, status: 'recorded', createdAt };
  }

  async listWatchEvents(watchId: string, tenantId: string, limit: number): Promise<WatchEvent[]> {
    await this.ensureWatchSchema();
    const res = await this.db.prepare(
      'SELECT * FROM watch_events WHERE watch_id = ?1 AND tenant_id = ?2 ORDER BY created_at DESC LIMIT ?3',
    ).bind(watchId, tenantId, limit).all<Record<string, unknown>>();
    return res.results.map((r) => this.mapWatchEventRow(r));
  }

  async updateWatchEventStatus(id: string, status: WatchEvent['status'], error?: string): Promise<void> {
    await this.ensureWatchSchema();
    await this.db.prepare(
      'UPDATE watch_events SET status = ?1, delivery_error = ?2 WHERE id = ?3',
    ).bind(status, error ?? null, id).run();
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
  // Watchlist alerts (watchlist-alerts-v1)
  private watches: Map<string, Watch> = new Map();
  private watchEvents: Map<string, WatchEvent> = new Map();

  constructor() {
    // No hardcoded keys — demo keys are opt-in via ALLOW_DEMO_KEYS in auth.ts
  }

  /** Register a new tenant + key for testing. */
  registerTenant(tenant: Tenant, keyHash: string, keyId: string): void {
    this.tenants.set(tenant.id, tenant);
    this.keyToTenant.set(keyHash, { tenantId: tenant.id, keyId });
  }

  /* ── Watchlist alerts (watchlist-alerts-v1) ─────────────────── */

  async ensureWatchSchema(): Promise<void> {
    // In-memory maps need no schema.
  }

  async createWatch(input: WatchInsert): Promise<Watch> {
    const now = new Date().toISOString();
    const watch: Watch = {
      id: randomUUID(),
      tenantId: input.tenantId,
      sources: input.sources,
      events: input.events,
      keyword: input.keyword,
      delivery: input.delivery ?? 'events',
      label: input.label,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    this.watches.set(watch.id, watch);
    return watch;
  }

  async listWatches(tenantId: string): Promise<Watch[]> {
    return [...this.watches.values()]
      .filter((w) => w.tenantId === tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listAllActiveWatches(): Promise<Watch[]> {
    return [...this.watches.values()].filter((w) => w.active);
  }

  async getWatch(id: string, tenantId: string): Promise<Watch | null> {
    const watch = this.watches.get(id);
    return watch && watch.tenantId === tenantId ? watch : null;
  }

  async deleteWatch(id: string, tenantId: string): Promise<boolean> {
    const watch = this.watches.get(id);
    if (!watch || watch.tenantId !== tenantId) return false;
    this.watches.delete(id);
    return true;
  }

  async countActiveWatches(tenantId: string): Promise<number> {
    return [...this.watches.values()].filter((w) => w.tenantId === tenantId && w.active).length;
  }

  async insertWatchEvent(event: WatchEventInsert): Promise<WatchEvent | null> {
    const dup = [...this.watchEvents.values()].some(
      (e) => e.watchId === event.watchId && e.changeKey === event.changeKey,
    );
    if (dup) return null;
    const watchEvent: WatchEvent = {
      id: randomUUID(),
      ...event,
      status: 'recorded',
      createdAt: new Date().toISOString(),
    };
    this.watchEvents.set(watchEvent.id, watchEvent);
    return watchEvent;
  }

  async listWatchEvents(watchId: string, tenantId: string, limit: number): Promise<WatchEvent[]> {
    return [...this.watchEvents.values()]
      .filter((e) => e.watchId === watchId && e.tenantId === tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async updateWatchEventStatus(id: string, status: WatchEvent['status'], error?: string): Promise<void> {
    const ev = this.watchEvents.get(id);
    if (!ev) return;
    ev.status = status;
    ev.deliveryError = error;
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
  async getTenantStripeSubscriptionId(tenantId: string): Promise<string | null> {
    const id = this.tenants.get(tenantId)?.stripeSubscriptionId ?? null;
    return id ? id : null;
  }

  async getTenantStripeSubscriptionStatus(tenantId: string): Promise<string | null> {
    return this.tenants.get(tenantId)?.stripeSubscriptionStatus ?? null;
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

  /* ── Tax ledger (#811 — MemoryStorage) ── */

  private taxLedger: Map<string, TaxLedgerEntryInsert & { createdAt: number }> = new Map();

  async ensureTaxLedgerSchema(): Promise<void> {
    // In-memory: schema is implicit.
  }

  async insertTaxLedgerEntry(entry: TaxLedgerEntryInsert): Promise<void> {
    if (this.taxLedger.has(entry.id)) {
      throw new Error(`UNIQUE constraint: tax_ledger.id=${entry.id} already exists`);
    }
    this.taxLedger.set(entry.id, { ...entry, createdAt: entry.createdAt ?? Math.floor(Date.now() / 1000) });
  }

  async hasTaxLedgerEntry(id: string): Promise<boolean> {
    return this.taxLedger.has(id);
  }

  async getTaxLedgerSummary(windowStartUnix: number): Promise<TaxLedgerSummary> {
    let gross = 0;
    let refunds = 0;
    let lastEventId: string | null = null;
    let lastCreatedAt = 0;
    let count = 0;
    for (const e of this.taxLedger.values()) {
      if (e.createdAt < windowStartUnix) continue;
      count++;
      if (e.amountCents > 0) gross += e.amountCents;
      else refunds += Math.abs(e.amountCents);
      if (e.createdAt >= lastCreatedAt) {
        lastCreatedAt = e.createdAt;
        lastEventId = e.id;
      }
    }
    const net = gross - refunds;
    return {
      grossCents: gross,
      refundsCents: refunds,
      netCents: net,
      netCad: net / 100,
      windowStartUnix,
      lastEventId,
      entryCount: count,
    };
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
