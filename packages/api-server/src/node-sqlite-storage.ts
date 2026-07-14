/**
 * Quill — Node Built-in SQLite Storage
 *
 * Uses node:sqlite (built into Node 22+) — no native compilation needed.
 * This solves the better-sqlite3 GLIBC/NODE_MODULE_VERSION mismatch in Docker.
 *
 * API is slightly different from better-sqlite3:
 * - DatabaseSync instead of Database
 * - .exec() for multiple statements
 * - .prepare() returns StatementSync with .get/.all/.run
 */

import { DatabaseSync } from 'node:sqlite';
import type { QuillStorage, QuillCache, Tenant, TenantStripeUpdates, StripeOrder, StripeOrderInsert, StripeOrderUpdates, PaymentReconciliation, PaymentReconciliationInsert, ExpiringTier } from './types.js';
import { hashApiKey } from './auth.js';

export class NodeSqliteStorage implements QuillStorage {
  private db: DatabaseSync;

  constructor(dbPath?: string) {
    const path = dbPath || process.env.QUILL_DB_PATH || './maplespike.db';
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA foreign_keys = ON');
    this.migrate();
    this.seed();
  }

  /**
   * Close the SQLite handle and force a WAL checkpoint. Without the explicit
   * checkpoint, an in-flight write can survive a process kill only via the
   * -wal file; a fresh NodeSqliteStorage(other_process) reopen on a hard
   * pod eviction could miss the last millisecond of work. The TRUNCATE mode
   * consolidates and discards the WAL, leaving the main DB file alone.
   *
   * Cost: O(write-set size). Frequency: only on graceful shutdown. Safe
   * because we wrap in try/catch — if the connection is already gone, we
   * still call db.close().
   */
  close(): void {
    try {
      this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    } catch {
      // Connection may already be torn down; ignore.
    }
    try {
      this.db.close();
    } catch {
      // Idempotent close; ignore.
    }
  }

  /* ── Schema ──────────────────────────────────────────────────── */

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        -- Decision 0002: PII avoidance. email_hash only; plaintext
        -- is consumed in-flight.
        email_hash TEXT,
        email_verified INTEGER DEFAULT 0,
        verification_token TEXT,
        tier TEXT DEFAULT 'free',
        is_active INTEGER DEFAULT 1,
        journalism_mode INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants(id),
        key_hash TEXT NOT NULL UNIQUE,
        name TEXT DEFAULT 'default',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        last_used_at TEXT,
        expires_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_keys_tenant ON api_keys(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_keys_hash ON api_keys(key_hash);

      CREATE TABLE IF NOT EXISTS usage_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        date TEXT NOT NULL,
        count INTEGER DEFAULT 0,
        UNIQUE(tenant_id, date)
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT,
        api_key_id TEXT,
        operation TEXT,
        model TEXT,
        endpoint TEXT,
        input_preview TEXT,
        output_summary TEXT,
        confidence REAL,
        success INTEGER,
        duration_ms INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    /* ── Stripe linkage — additive migration (idempotent on re-run) ──
     * Adds Stripe-side columns to tenants and a stripe_orders table.
     * ALTER TABLE has no IF NOT EXISTS column clause in older SQLite, so
     * we probe pragma_table_info() for each column and ALTER only if
     * missing. Safe to run on pre-Stripe installs. */
    this.addColumnIfMissing('tenants', 'stripe_customer_id', 'TEXT');
    this.addColumnIfMissing('tenants', 'stripe_subscription_id', 'TEXT');
    this.addColumnIfMissing('tenants', 'stripe_subscription_status', 'TEXT');
    this.addColumnIfMissing('tenants', 'stripe_current_period_end', 'INTEGER');
    this.addColumnIfMissing('tenants', 'stripe_updated_at', 'TEXT');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS stripe_orders (
        order_id TEXT PRIMARY KEY NOT NULL,
        tenant_id TEXT NOT NULL REFERENCES tenants(id),
        plan_id TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'CAD',
        -- Authoritative dedupe boundary — first writer wins; second
        -- writer's checkout.session.completed webhook becomes idempotent no-op.
        stripe_checkout_session_id TEXT NOT NULL UNIQUE,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        -- 'pending' | 'paid' | 'expired' | 'cancelled' | 'fulfilled'
        status TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        paid_at INTEGER,
        fulfilled_at INTEGER,
        cancelled_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_stripe_orders_tenant ON stripe_orders(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_stripe_orders_subscription ON stripe_orders(stripe_subscription_id);
    `);
  }

  /** Probe pragma_table_info() for a column; add via ALTER TABLE if missing. */
  private addColumnIfMissing(table: string, column: string, type: string): void {
    const cols = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    const has = cols.some((c) => c.name === column);
    if (has) return;
    // SQLite identifier quoting allows only [a-z_] chars in our use; plain interpolation is safe.
    this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }

  private seed(): void {
    // No hardcoded dev keys — use ALLOW_DEMO_KEYS env + auth.ts for development
  }

  /* ── QuillStorage interface ─────────────────────────────── */

  async authenticate(rawKey: string): Promise<{ tenant: Tenant; apiKeyId: string } | null> {
    const keyHash = await hashApiKey(rawKey);
    const row = this.db.prepare(`
      SELECT k.id as key_id, k.tenant_id, t.name, t.email_hash, t.email_verified,
             t.tier, t.is_active, t.journalism_mode,
             t.stripe_customer_id, t.stripe_subscription_id, t.stripe_subscription_status,
             t.stripe_current_period_end
      FROM api_keys k
      JOIN tenants t ON k.tenant_id = t.id
      WHERE k.key_hash = ? AND k.is_active = 1 AND t.is_active = 1
    `).get(keyHash) as {
      key_id: string; tenant_id: string; name: string; email_hash: string;
      email_verified: number; tier: string; is_active: number; journalism_mode: number;
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
      stripe_subscription_status: string | null;
      stripe_current_period_end: number | null;
    } | undefined;

    if (!row) return null;

    this.db.prepare('UPDATE api_keys SET last_used_at = datetime(\'now\') WHERE id = ?')
      .run(row.key_id);

    return {
      tenant: {
        id: row.tenant_id,
        name: row.name,
        emailHash: row.email_hash,
        emailVerified: Boolean(row.email_verified),
        tier: row.tier as 'free' | 'pro' | 'business' | 'enterprise' | 'internal',
        isActive: Boolean(row.is_active),
        journalismMode: Boolean(row.journalism_mode),
        stripeCustomerId: row.stripe_customer_id ?? undefined,
        stripeSubscriptionId: row.stripe_subscription_id ?? undefined,
        stripeSubscriptionStatus:
          (row.stripe_subscription_status as Tenant['stripeSubscriptionStatus']) ?? undefined,
        stripeCurrentPeriodEnd: row.stripe_current_period_end ?? undefined,
      },
      apiKeyId: row.key_id,
    };
  }

  async getDailyUsage(tenantId: string, date: string): Promise<number> {
    const row = this.db.prepare(
      'SELECT count FROM usage_log WHERE tenant_id = ? AND date = ?'
    ).get(tenantId, date) as { count: number } | undefined;
    return row?.count || 0;
  }

  async getMonthlyUsage(tenantId: string, yearMonth: string): Promise<number> {
    const row = this.db.prepare(`
      SELECT COALESCE(SUM(count), 0) as total FROM usage_log
      WHERE tenant_id = ? AND date LIKE ?
    `).get(tenantId, `${yearMonth}-%`) as { total: number };
    return row.total;
  }

  async incrementUsage(tenantId: string, date: string, yearMonth: string): Promise<void> {
    this.db.prepare(`
      INSERT INTO usage_log (tenant_id, date, count) VALUES (?, ?, 1)
      ON CONFLICT(tenant_id, date) DO UPDATE SET count = count + 1
    `).run(tenantId, date);
  }

  async logAudit(entry: {
    tenantId: string;
    apiKeyId?: string;
    operation: string;
    model?: string;
    endpoint?: string;
    inputPreview?: string;
    outputSummary?: string;
    confidence?: number | null;
    success: boolean;
    durationMs: number;
  }): Promise<void> {
    this.db.prepare(`
      INSERT INTO audit_log (tenant_id, api_key_id, operation, model, endpoint, input_preview, output_summary, confidence, success, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.tenantId,
      entry.apiKeyId || null,
      entry.operation,
      entry.model || null,
      entry.endpoint || null,
      entry.inputPreview || null,
      entry.outputSummary || null,
      entry.confidence ?? null,
      entry.success ? 1 : 0,
      entry.durationMs
    );
  }

  async queryAudit(filter: {
    tenantId: string;
    operation?: string;
    success?: boolean;
    since?: string;
    until?: string;
    limit?: number;
    offset?: number;
  }): Promise<Array<{
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
    durationMs: number;
    createdAt: string;
  }>> {
    let sql = 'SELECT * FROM audit_log WHERE tenant_id = ?';
    const args: (string | number)[] = [filter.tenantId];
    if (filter.operation) { sql += ' AND operation = ?'; args.push(filter.operation); }
    if (filter.success !== undefined) { sql += ' AND success = ?'; args.push(filter.success ? 1 : 0); }
    if (filter.since) { sql += ' AND created_at >= ?'; args.push(filter.since); }
    if (filter.until) { sql += ' AND created_at <= ?'; args.push(filter.until); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    args.push(filter.limit || 50, filter.offset || 0);
    const rows = this.db.prepare(sql).all(...args) as any[];
    return rows.map(r => ({
      id: r.id,
      tenantId: r.tenant_id,
      apiKeyId: r.api_key_id,
      operation: r.operation,
      model: r.model,
      endpoint: r.endpoint || '',
      inputPreview: r.input_preview,
      outputSummary: r.output_summary,
      confidence: r.confidence,
      success: Boolean(r.success),
      durationMs: r.duration_ms,
      createdAt: r.created_at,
    }));
  }

  /* ── Key Management ──────────────────────────────────────────── */

  async listApiKeys(tenantId: string): Promise<Array<{
    id: string; name: string; isActive: boolean;
    createdAt: string; lastUsedAt: string | null; expiresAt: string | null;
  }>> {
    const rows = this.db.prepare(
      'SELECT id, name, is_active, created_at, last_used_at, expires_at FROM api_keys WHERE tenant_id = ? ORDER BY created_at DESC'
    ).all(tenantId) as Array<{
      id: string; name: string; is_active: number;
      created_at: string; last_used_at: string | null; expires_at: string | null;
    }>;
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      expiresAt: row.expires_at,
    }));
  }

  createApiKey(keyId: string, tenantId: string, keyHash: string, name: string, expiresAt?: string): void {
    this.db.prepare(
      'INSERT INTO api_keys (id, tenant_id, key_hash, name, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run(keyId, tenantId, keyHash, name, expiresAt || null);
  }

  /**
   * Decision 0002: persists `emailHash` only.
   * Caller must hash before calling.
   */
  createTenant(tenant: Tenant): void {
    this.db.prepare(`
      INSERT INTO tenants (id, name, email_hash, email_verified, verification_token, tier, is_active, journalism_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tenant.id, tenant.name, tenant.emailHash || null,
      tenant.emailVerified ? 1 : 0,
      (tenant as any).verificationToken || null,
      tenant.tier, tenant.isActive ? 1 : 0,
      tenant.journalismMode ? 1 : 0
    );
  }

  revokeApiKey(keyId: string, tenantId: string): void {
    this.db.prepare(
      'UPDATE api_keys SET is_active = 0 WHERE id = ? AND tenant_id = ?'
    ).run(keyId, tenantId);
  }

  /**
   * Mark a tenant's email_verified flag by verification token.
   * Decision 0002: returns opaque hash pair only — never plaintext.
   */
  verifyEmail(token: string): { id: string; name: string; emailHash: string } | null {
    const row = this.db.prepare(
      'SELECT id, name, email_hash FROM tenants WHERE verification_token = ?'
    ).get(token) as { id: string; name: string; email_hash: string | null } | undefined;
    if (!row) return null;
    this.db.prepare(
      'UPDATE tenants SET email_verified = 1, verification_token = NULL WHERE id = ?'
    ).run(row.id);
    return { id: row.id, name: row.name, emailHash: row.email_hash ?? '' };
  }

  /* ── Stripe billing persistence (Phase 1) ─────────────────────── */

  async createStripeOrder(order: StripeOrderInsert): Promise<void> {
    // UNIQUE(stripe_checkout_session_id) at the SQLite layer is the
    // authoritative dedupe boundary. A second INSERT for the same session
    // throws and the webhook handler treats that as idempotent no-op.
    this.db.prepare(`
      INSERT INTO stripe_orders (
        order_id, tenant_id, plan_id, amount_cents, currency,
        stripe_checkout_session_id, status, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s','now'), ?)
    `).run(
      order.order_id,
      order.tenant_id,
      order.plan_id,
      order.amount_cents,
      order.currency,
      order.stripe_checkout_session_id,
      order.status,
      order.expires_at,
    );
  }

  async getStripeOrderById(orderId: string): Promise<StripeOrder | null> {
    const row = this.db.prepare('SELECT * FROM stripe_orders WHERE order_id = ?').get(orderId) as Record<string, unknown> | undefined;
    return row ? this.mapStripeOrder(row) : null;
  }

  async getStripeOrderBySessionId(sessionId: string): Promise<StripeOrder | null> {
    const row = this.db.prepare('SELECT * FROM stripe_orders WHERE stripe_checkout_session_id = ?').get(sessionId) as Record<string, unknown> | undefined;
    return row ? this.mapStripeOrder(row) : null;
  }

  async updateStripeOrder(orderId: string, updates: StripeOrderUpdates): Promise<void> {
    const sets: string[] = [];
    const args: (string | number | null)[] = [];
    if (updates.status !== undefined) { sets.push('status = ?'); args.push(updates.status); }
    if (updates.stripe_customer_id !== undefined) { sets.push('stripe_customer_id = ?'); args.push(updates.stripe_customer_id); }
    if (updates.stripe_subscription_id !== undefined) { sets.push('stripe_subscription_id = ?'); args.push(updates.stripe_subscription_id); }
    if (updates.paid_at !== undefined) { sets.push('paid_at = ?'); args.push(updates.paid_at); }
    if (updates.fulfilled_at !== undefined) { sets.push('fulfilled_at = ?'); args.push(updates.fulfilled_at); }
    if (updates.cancelled_at !== undefined) { sets.push('cancelled_at = ?'); args.push(updates.cancelled_at); }
    if (sets.length === 0) return;
    args.push(orderId);
    this.db.prepare(`UPDATE stripe_orders SET ${sets.join(', ')} WHERE order_id = ?`).run(...args);
  }

  async updateTenantStripe(tenantId: string, updates: TenantStripeUpdates): Promise<void> {
    const sets: string[] = ['stripe_updated_at = datetime(\'now\')'];
    const args: (string | number | null)[] = [];
    if (updates.tier !== undefined) { sets.push('tier = ?'); args.push(updates.tier); }
    if (updates.stripeCustomerId !== undefined) { sets.push('stripe_customer_id = ?'); args.push(updates.stripeCustomerId); }
    if (updates.stripeSubscriptionId !== undefined) { sets.push('stripe_subscription_id = ?'); args.push(updates.stripeSubscriptionId); }
    if (updates.stripeSubscriptionStatus !== undefined) { sets.push('stripe_subscription_status = ?'); args.push(updates.stripeSubscriptionStatus); }
    if (updates.stripeCurrentPeriodEnd !== undefined) { sets.push('stripe_current_period_end = ?'); args.push(updates.stripeCurrentPeriodEnd); }
    args.push(tenantId);
    this.db.prepare(`UPDATE tenants SET ${sets.join(', ')} WHERE id = ?`).run(...args);
  }

  async getTenantStripeCustomerId(tenantId: string): Promise<string | null> {
    const row = this.db.prepare('SELECT stripe_customer_id FROM tenants WHERE id = ?').get(tenantId) as { stripe_customer_id: string | null } | undefined;
    return row?.stripe_customer_id ?? null;
  }

  /** Map raw sqlite row -> StripeOrder (camel → snake canonicalisation). */
  private mapStripeOrder(row: Record<string, unknown>): StripeOrder {
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

  /* ── AUDIT-LOG-3 + STRIPE-1 ── */

  private ensureReconciliationsSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS payment_reconciliations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_uid TEXT NOT NULL UNIQUE,
        order_id TEXT,
        amount_cents INTEGER,
        reference TEXT,
        channel TEXT NOT NULL DEFAULT 'stripe',
        processed_at INTEGER DEFAULT (strftime('%s','now'))
      );
      CREATE INDEX IF NOT EXISTS idx_reconciliations_processed ON payment_reconciliations(processed_at DESC);
    `);
  }

  async createPaymentReconciliation(rec: PaymentReconciliationInsert): Promise<void> {
    this.ensureReconciliationsSchema();
    this.db.prepare(
      `INSERT INTO payment_reconciliations (transaction_uid, order_id, amount_cents, reference, channel) VALUES (?, ?, ?, ?, ?)`,
    ).run(rec.transactionUid, rec.orderId ?? null, rec.amountCents ?? null, rec.reference ?? null, rec.channel);
  }

  async getPaymentReconciliations(limit: number = 50): Promise<PaymentReconciliation[]> {
    this.ensureReconciliationsSchema();
    const rows = this.db.prepare(
      `SELECT id, transaction_uid, order_id, amount_cents, reference, channel, processed_at FROM payment_reconciliations ORDER BY processed_at DESC LIMIT ?`,
    ).all(limit) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: r.id as number,
      transactionUid: r.transaction_uid as string,
      orderId: (r.order_id as string | null) ?? undefined,
      amountCents: (r.amount_cents as number | null) ?? undefined,
      reference: (r.reference as string | null) ?? undefined,
      channel: r.channel as PaymentReconciliation['channel'],
      processedAt: (r.processed_at as number | null) ?? undefined,
    }));
  }

  async findTenantsForTierExpiry(nowUnix: number): Promise<ExpiringTier[]> {
    const rows = this.db.prepare(
      `SELECT id AS tenant_id, stripe_current_period_end, tier FROM tenants WHERE stripe_current_period_end IS NOT NULL AND stripe_current_period_end < ? AND tier != 'free'`,
    ).all(nowUnix) as Array<{ tenant_id: string; stripe_current_period_end: number; tier: string }>;
    return rows.map((r) => ({
      tenant_id: r.tenant_id,
      stripe_current_period_end: r.stripe_current_period_end,
      tier: r.tier as ExpiringTier['tier'],
    }));
  }
}

/* ── Cache ────────────────────────────────────────────────────── */

export class NodeSqliteCache implements QuillCache {
  private store = new Map<string, { value: string; expires: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async put(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expires = Date.now() + (ttlSeconds || 60) * 1000;
    this.store.set(key, { value, expires });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async flush(): Promise<void> {
    this.store.clear();
  }
}

/* ── Helpers ──────────────────────────────────────────────────── */
