/**
 * Quill — SQLite Storage Backend
 *
 * Implements QuillStorage using better-sqlite3 for local/container deployments.
 * Table schemas match the D1 schema from schema.sql exactly.
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { applyMediaRssMetadataSqlite } from '@maplespike/database';
import type { QuillStorage, QuillCache, Tenant, AuditEntry, AuditQueryParams, TenantStripeUpdates, StripeOrder, StripeOrderInsert, StripeOrderUpdates, PaymentReconciliation, PaymentReconciliationInsert, ExpiringTier, TaxLedgerEntryInsert, TaxLedgerSummary, Watch, WatchInsert, WatchEvent, WatchEventInsert } from './types.js';
import { hashApiKey, generateApiKey } from './auth.js';


export class SqliteStorage implements QuillStorage {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const path = dbPath || process.env.QUILL_DB_PATH || './quill.db';
    this.db = new Database(path);

    // Enable WAL mode for better concurrent read performance
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.migrate();
    applyMediaRssMetadataSqlite(this.db);
    this.seed();
  }

  get rawDb(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }

  /*  Schema Migration                                                 */

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        -- Decision 0002: PII avoidance. Plaintext email NEVER lands here.
        -- The HMAC-SHA256 of the email is stored; plaintext is consumed
        -- in-flight by transactional mailers and discarded.
        email_hash TEXT,
        email_verified INTEGER DEFAULT 0,
        verification_token TEXT,
        tier TEXT NOT NULL DEFAULT 'free',
        is_active INTEGER DEFAULT 1,
        journalism_mode INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        name TEXT DEFAULT 'default',
        is_active INTEGER DEFAULT 1,
        last_used_at TEXT,
        expires_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_keys_tenant ON api_keys(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_keys_hash ON api_keys(key_hash);
      CREATE INDEX IF NOT EXISTS idx_keys_active ON api_keys(is_active);

      CREATE TABLE IF NOT EXISTS daily_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        date TEXT NOT NULL,
        call_count INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(tenant_id, date),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_usage_tenant_date ON daily_usage(tenant_id, date);

      CREATE TABLE IF NOT EXISTS monthly_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        year_month TEXT NOT NULL,
        call_count INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(tenant_id, year_month),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_monthly_tenant ON monthly_usage(tenant_id, year_month);

      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        api_key_id TEXT,
        operation TEXT NOT NULL,
        model TEXT,
        endpoint TEXT,
        input_preview TEXT,
        output_summary TEXT,
        confidence INTEGER,
        success INTEGER DEFAULT 1,
        error_message TEXT,
        duration_ms INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_audit_operation ON audit_log(operation);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
    `);
  }

  /*  Seed Data (internal tenant + dev key)                            */

  private seed(): void {
    // Internal tenant for MapleSpike
    const insertTenant = this.db.prepare(`
      INSERT OR IGNORE INTO tenants (id, name, tier, journalism_mode)
      VALUES (?, ?, ?, ?)
    `);
        insertTenant.run('ms-internal', 'MapleSpike', 'internal', 1);
        insertTenant.run('fg-internal', 'MapleSpike', 'internal', 1);
        // Anonymous/unauth tenant for health checks
        insertTenant.run('anon', 'Anonymous', 'free', 0);

    // Dev/test API key (SHA-256 of "maplespike-dev-key")
    const insertKey = this.db.prepare(`
      INSERT OR IGNORE INTO api_keys (id, tenant_id, key_hash, name)
      VALUES (?, ?, ?, ?)
    `);
    // Pre-computed SHA-256 of "maplespike-dev-key"
    insertKey.run(
      'dev-key-1',
      'ms-internal',
      'c73d089e582ca8a90a5e3543a1c2fe6f89afc0f9c82319cea56a804048075799',
      'dev',
    );
  }

  /*  QuillStorage Interface                                          */

  async authenticate(rawKey: string): Promise<{ tenant: Tenant; apiKeyId: string; rotatedKey?: { id: string; key: string; expiresAt: string } } | null> {
    const keyHash = await hashApiKey(rawKey);

    const row = this.db.prepare(`
      SELECT t.id AS tenant_id, t.name, t.email_hash, t.email_verified, t.tier, t.is_active, t.journalism_mode,
             t.stripe_customer_id, t.stripe_subscription_id, t.stripe_subscription_status, t.stripe_current_period_end,
             k.id AS key_id, k.is_active AS key_active, k.expires_at
      FROM api_keys k
      JOIN tenants t ON t.id = k.tenant_id
      WHERE k.key_hash = ?
    `).get(keyHash) as Record<string, unknown> | undefined;

    if (!row) return null;
    if (!row.key_active || !row.is_active) return null;

    const expiresAt = row.expires_at as string | null;
    const now = new Date();
    if (expiresAt && new Date(expiresAt) < now) {
      return null;
    }

    this.db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?")
      .run(row.key_id);

    let rotatedKey: { id: string; key: string; expiresAt: string } | undefined;
    if (expiresAt) {
      const expiryDate = new Date(expiresAt);
      const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry <= 7) {
        const { rawKey: newRawKey, keyHash: newKeyHash } = await generateApiKey();
        const newKeyId = 'key_' + Array.from(new Uint8Array(16))
          .map(() => Math.random().toString(16).slice(2, 4)).join('');
        const newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + 90);
        this.createApiKey(newKeyId, row.tenant_id as string, newKeyHash, 'auto-rotated', newExpiresAt.toISOString());
        this.revokeApiKey(row.key_id as string, row.tenant_id as string);
        rotatedKey = { id: newKeyId, key: newRawKey, expiresAt: newExpiresAt.toISOString() };
      }
    }

    return {
      tenant: {
        id: row.tenant_id as string,
        name: row.name as string,
        emailHash: (row.email_hash as string) || undefined,
        emailVerified: Boolean(row.email_verified),
        tier: row.tier as Tenant['tier'],
        isActive: Boolean(row.is_active),
        journalismMode: Boolean(row.journalism_mode),
        stripeCustomerId: (row.stripe_customer_id as string | null) ?? undefined,
        stripeSubscriptionId: (row.stripe_subscription_id as string | null) ?? undefined,
        stripeSubscriptionStatus: (row.stripe_subscription_status as Tenant['stripeSubscriptionStatus']) ?? undefined,
        stripeCurrentPeriodEnd: (row.stripe_current_period_end as number | null) ?? undefined,
      },
      apiKeyId: rotatedKey?.id ?? (row.key_id as string),
      rotatedKey,
    };
  }

  async getDailyUsage(tenantId: string, date: string): Promise<number> {
    const row = this.db.prepare(
      'SELECT call_count FROM daily_usage WHERE tenant_id = ? AND date = ?',
    ).get(tenantId, date) as { call_count: number } | undefined;

    return row?.call_count || 0;
  }

  async getMonthlyUsage(tenantId: string, yearMonth: string): Promise<number> {
    const row = this.db.prepare(
      'SELECT call_count FROM monthly_usage WHERE tenant_id = ? AND year_month = ?',
    ).get(tenantId, yearMonth) as { call_count: number } | undefined;

    return row?.call_count || 0;
  }

  async incrementUsage(tenantId: string, date: string, yearMonth: string): Promise<void> {
    this.db.prepare(`
      INSERT INTO daily_usage (tenant_id, date, call_count)
      VALUES (?, ?, 1)
      ON CONFLICT(tenant_id, date) DO UPDATE SET call_count = call_count + 1
    `).run(tenantId, date);

    this.db.prepare(`
      INSERT INTO monthly_usage (tenant_id, year_month, call_count)
      VALUES (?, ?, 1)
      ON CONFLICT(tenant_id, year_month) DO UPDATE SET call_count = call_count + 1
    `).run(tenantId, yearMonth);
  }

  async logAudit(entry: Omit<AuditEntry, 'id' | 'created_at'>): Promise<void> {
    this.db.prepare(`
      INSERT INTO audit_log (tenant_id, api_key_id, operation, model, endpoint, input_preview, output_summary, confidence, success, error_message, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
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
    );
  }

  async queryAudit(filter: AuditQueryParams): Promise<AuditEntry[]> {
    let sql = 'SELECT * FROM audit_log WHERE tenant_id = ?';
    const params: unknown[] = [filter.tenantId];

    if (filter.operation) {
      sql += ' AND operation = ?';
      params.push(filter.operation);
    }
    if (filter.success !== undefined) {
      sql += ' AND success = ?';
      params.push(filter.success ? 1 : 0);
    }
    if (filter.since) {
      sql += ' AND created_at >= ?';
      params.push(filter.since);
    }
    if (filter.until) {
      sql += ' AND created_at <= ?';
      params.push(filter.until);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(filter.limit || 50, filter.offset || 0);

    const rows = this.db.prepare(sql).all(...params) as AuditEntry[];
    return rows || [];
  }

  async listApiKeys(tenantId: string): Promise<Array<{ id: string; name: string; isActive: boolean; createdAt: string; lastUsedAt: string | null; expiresAt: string | null }>> {
    const rows = this.db.prepare(
      'SELECT id, name, is_active, created_at, last_used_at, expires_at FROM api_keys WHERE tenant_id = ? ORDER BY created_at DESC',
    ).all(tenantId) as Array<{ id: string; name: string; is_active: number; created_at: string; last_used_at: string | null; expires_at: string | null }>;
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      expiresAt: row.expires_at,
    }));
  }

  /*  Registration Helpers (for SqliteStorage)                         */

  /**
   * Create a new tenant.
   * Decision 0002: accepts `emailHash` (never plaintext). Caller
   * is responsible for hashing before calling this method.
   */
  createTenant(tenant: Tenant): void {
    this.db.prepare(`
      INSERT INTO tenants (id, name, email_hash, email_verified, verification_token, tier, is_active, journalism_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tenant.id, tenant.name, tenant.emailHash || null,
      tenant.emailVerified ? 1 : 0,
      tenant.verificationToken || null,
      tenant.tier, tenant.isActive ? 1 : 0, tenant.journalismMode ? 1 : 0,
    );
  }

  verifyEmail(token: string): boolean {
    const row = this.db.prepare(
      'SELECT id FROM tenants WHERE verification_token = ? AND email_verified = 0',
    ).get(token) as Record<string, unknown> | undefined;
    if (!row) return false;
    this.db.prepare(
      'UPDATE tenants SET email_verified = 1, verification_token = NULL, updated_at = datetime(\'now\') WHERE id = ?',
    ).run(row.id);
    return true;
  }

  /*  Stripe billing persistence (Phase 1)                          */

  /**
   * Idempotent additive schema bootstrap for Stripe linkage. Called on every
   * stripe-method entry (the cheapest probe-and-ALTER pattern; safe to repeat).
   * Mirrors NodeSqliteStorage.addColumnIfMissing() without a shared helper class.
   */
  private ensureStripeSchema(): void {
    const cols = this.db.prepare(`PRAGMA table_info(tenants)`).all() as Array<{ name: string }>;
    const names = new Set(cols.map((c) => c.name));
    if (!names.has('stripe_customer_id')) this.db.exec('ALTER TABLE tenants ADD COLUMN stripe_customer_id TEXT');
    if (!names.has('stripe_subscription_id')) this.db.exec('ALTER TABLE tenants ADD COLUMN stripe_subscription_id TEXT');
    if (!names.has('stripe_subscription_status')) this.db.exec('ALTER TABLE tenants ADD COLUMN stripe_subscription_status TEXT');
    if (!names.has('stripe_current_period_end')) this.db.exec('ALTER TABLE tenants ADD COLUMN stripe_current_period_end INTEGER');
    if (!names.has('stripe_updated_at')) this.db.exec('ALTER TABLE tenants ADD COLUMN stripe_updated_at TEXT');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS stripe_orders (
        order_id TEXT PRIMARY KEY NOT NULL,
        tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        plan_id TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'CAD',
        stripe_checkout_session_id TEXT NOT NULL UNIQUE,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
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

  async createStripeOrder(order: StripeOrderInsert): Promise<void> {
    this.ensureStripeSchema();
    this.db.prepare(`
      INSERT INTO stripe_orders (
        order_id, tenant_id, plan_id, amount_cents, currency,
        stripe_checkout_session_id, status, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s','now'), ?)
    `).run(
      order.order_id, order.tenant_id, order.plan_id, order.amount_cents, order.currency,
      order.stripe_checkout_session_id, order.status, order.expires_at,
    );
  }

  async getStripeOrderById(orderId: string): Promise<StripeOrder | null> {
    this.ensureStripeSchema();
    const row = this.db.prepare('SELECT * FROM stripe_orders WHERE order_id = ?').get(orderId) as Record<string, unknown> | undefined;
    return row ? this.mapStripeOrder(row) : null;
  }

  async getStripeOrderBySessionId(sessionId: string): Promise<StripeOrder | null> {
    this.ensureStripeSchema();
    const row = this.db.prepare('SELECT * FROM stripe_orders WHERE stripe_checkout_session_id = ?').get(sessionId) as Record<string, unknown> | undefined;
    return row ? this.mapStripeOrder(row) : null;
  }

  async updateStripeOrder(orderId: string, updates: StripeOrderUpdates): Promise<void> {
    this.ensureStripeSchema();
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
    this.ensureStripeSchema();
    const sets: string[] = [`stripe_updated_at = datetime('now')`];
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
    this.ensureStripeSchema();
    const row = this.db.prepare('SELECT stripe_customer_id FROM tenants WHERE id = ?').get(tenantId) as { stripe_customer_id: string | null } | undefined;
    return row?.stripe_customer_id ?? null;
  }

  /* ── AUDIT-LOG-3 + STRIPE-1 (SqliteStorage) ── */

  private ensureReconciliationsSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS payment_reconciliations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_uid TEXT NOT NULL UNIQUE,
        order_id TEXT,
        amount_cents INTEGER,
        reference TEXT,
        channel TEXT NOT NULL DEFAULT 'stripe',
        processed_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
      );
      CREATE INDEX IF NOT EXISTS idx_reconciliations_processed ON payment_reconciliations(processed_at DESC);
    `);
  }

  async createPaymentReconciliation(rec: PaymentReconciliationInsert): Promise<void> {
    this.ensureReconciliationsSchema();
    this.db.prepare(
      `INSERT INTO payment_reconciliations (transaction_uid, order_id, amount_cents, reference, channel) VALUES (?, ?, ?, ?, ?)`
    ).run(rec.transactionUid, rec.orderId ?? null, rec.amountCents ?? null, rec.reference ?? null, rec.channel);
  }

  async getPaymentReconciliations(limit: number = 50): Promise<PaymentReconciliation[]> {
    this.ensureReconciliationsSchema();
    const rows = this.db.prepare(
      `SELECT id, transaction_uid AS transactionUid, order_id AS orderId, amount_cents AS amountCents, reference, channel, processed_at AS processedAt FROM payment_reconciliations ORDER BY processed_at DESC LIMIT ?`
    ).all(limit) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
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
    const rows = this.db.prepare(
      `SELECT id AS tenant_id, stripe_current_period_end, tier FROM tenants WHERE stripe_current_period_end IS NOT NULL AND stripe_current_period_end < ? AND tier != 'free'`
    ).all(nowUnix) as Array<{ tenant_id: string; stripe_current_period_end: number; tier: string }>;
    return rows.map((r) => ({
      tenant_id: r.tenant_id,
      stripe_current_period_end: r.stripe_current_period_end,
      tier: r.tier as ExpiringTier['tier'],
    }));
  }

  /* ── Tax ledger (#811 — better-sqlite3) ── */

  async ensureTaxLedgerSchema(): Promise<void> {
    this.db.exec(`
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
      );
      CREATE INDEX IF NOT EXISTS idx_tax_ledger_created ON tax_ledger(created_at);
    `);
  }

  async insertTaxLedgerEntry(entry: TaxLedgerEntryInsert): Promise<void> {
    await this.ensureTaxLedgerSchema();
    this.db.prepare(
      `INSERT INTO tax_ledger (id, entry_type, amount_cents, currency, order_id, tenant_id, stripe_event_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      entry.id,
      entry.entryType,
      entry.amountCents,
      entry.currency,
      entry.orderId ?? null,
      entry.tenantId ?? null,
      entry.stripeEventId ?? null,
      entry.note ?? null,
      entry.createdAt ?? Math.floor(Date.now() / 1000),
    );
  }

  async hasTaxLedgerEntry(id: string): Promise<boolean> {
    await this.ensureTaxLedgerSchema();
    const row = this.db.prepare('SELECT id FROM tax_ledger WHERE id = ?').get(id) as { id: string } | undefined;
    return row !== undefined;
  }

  async getTaxLedgerSummary(windowStartUnix: number): Promise<TaxLedgerSummary> {
    await this.ensureTaxLedgerSchema();
    const agg = this.db.prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END), 0) AS gross_cents,
         COALESCE(SUM(CASE WHEN amount_cents < 0 THEN -amount_cents ELSE 0 END), 0) AS refunds_cents,
         COUNT(*) AS entry_count
       FROM tax_ledger WHERE created_at >= ?`,
    ).get(windowStartUnix) as { gross_cents: number; refunds_cents: number; entry_count: number };
    const last = this.db.prepare(
      'SELECT id FROM tax_ledger ORDER BY created_at DESC, rowid DESC LIMIT 1',
    ).get() as { id: string } | undefined;
    const net = (agg.gross_cents ?? 0) - (agg.refunds_cents ?? 0);
    return {
      grossCents: agg.gross_cents ?? 0,
      refundsCents: agg.refunds_cents ?? 0,
      netCents: net,
      netCad: net / 100,
      windowStartUnix,
      lastEventId: last?.id ?? null,
      entryCount: agg.entry_count ?? 0,
    };
  }

  /** Map raw sqlite row -> StripeOrder (column-name canonicalisation). */
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

  /** Create a new API key record. */
  createApiKey(keyId: string, tenantId: string, keyHash: string, name: string, expiresAt?: string): void {
    this.db.prepare(`
      INSERT INTO api_keys (id, tenant_id, key_hash, name, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(keyId, tenantId, keyHash, name, expiresAt || null);
  }

  /** Revoke an API key by setting it inactive. */
  revokeApiKey(keyId: string, tenantId: string): void {
    this.db.prepare(
      'UPDATE api_keys SET is_active = 0 WHERE id = ? AND tenant_id = ?',
    ).run(keyId, tenantId);
  }

  /** Get a tenant by ID. */
  getTenant(tenantId: string): Tenant | null {
    const row = this.db.prepare(
      `SELECT id, name, email_hash, email_verified, verification_token, tier, is_active, journalism_mode,
              stripe_customer_id, stripe_subscription_id, stripe_subscription_status, stripe_current_period_end
       FROM tenants WHERE id = ?`,
    ).get(tenantId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: row.id as string,
      name: row.name as string,
      emailHash: (row.email_hash as string) || undefined,
      emailVerified: Boolean(row.email_verified),
      verificationToken: (row.verification_token as string) || undefined,
      tier: row.tier as Tenant['tier'],
      isActive: Boolean(row.is_active),
      journalismMode: Boolean(row.journalism_mode),
      stripeCustomerId: (row.stripe_customer_id as string | null) ?? undefined,
      stripeSubscriptionId: (row.stripe_subscription_id as string | null) ?? undefined,
      stripeSubscriptionStatus: (row.stripe_subscription_status as Tenant['stripeSubscriptionStatus']) ?? undefined,
      stripeCurrentPeriodEnd: (row.stripe_current_period_end as number | null) ?? undefined,
    };
  }

  /* ── Watchlist alerts (watchlist-alerts-v1) ─────────────────── */

  private watchSchemaReady = false;

  async ensureWatchSchema(): Promise<void> {
    if (this.watchSchemaReady) return;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS watches (
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
      );
      CREATE INDEX IF NOT EXISTS idx_watches_tenant ON watches(tenant_id);

      CREATE TABLE IF NOT EXISTS watch_events (
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
      );
      CREATE INDEX IF NOT EXISTS idx_watch_events_watch ON watch_events(watch_id);
    `);
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
    this.db.prepare(
      `INSERT INTO watches (id, tenant_id, sources, events, keyword, delivery, label, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    ).run(
      watch.id,
      watch.tenantId,
      JSON.stringify(watch.sources),
      JSON.stringify(watch.events),
      watch.keyword ?? null,
      watch.delivery,
      watch.label ?? null,
      now,
      now,
    );
    return watch;
  }

  async listWatches(tenantId: string): Promise<Watch[]> {
    await this.ensureWatchSchema();
    const rows = this.db.prepare(
      'SELECT * FROM watches WHERE tenant_id = ? ORDER BY created_at DESC',
    ).all(tenantId) as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapWatchRow(r));
  }

  async listAllActiveWatches(): Promise<Watch[]> {
    await this.ensureWatchSchema();
    const rows = this.db.prepare(
      'SELECT * FROM watches WHERE active = 1',
    ).all() as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapWatchRow(r));
  }

  async getWatch(id: string, tenantId: string): Promise<Watch | null> {
    await this.ensureWatchSchema();
    const row = this.db.prepare(
      'SELECT * FROM watches WHERE id = ? AND tenant_id = ?',
    ).get(id, tenantId) as Record<string, unknown> | undefined;
    return row ? this.mapWatchRow(row) : null;
  }

  async deleteWatch(id: string, tenantId: string): Promise<boolean> {
    await this.ensureWatchSchema();
    const res = this.db.prepare(
      'DELETE FROM watches WHERE id = ? AND tenant_id = ?',
    ).run(id, tenantId);
    return Number(res.changes) > 0;
  }

  async countActiveWatches(tenantId: string): Promise<number> {
    await this.ensureWatchSchema();
    const row = this.db.prepare(
      'SELECT COUNT(*) AS n FROM watches WHERE tenant_id = ? AND active = 1',
    ).get(tenantId) as { n: number };
    return Number(row.n);
  }

  async insertWatchEvent(event: WatchEventInsert): Promise<WatchEvent | null> {
    await this.ensureWatchSchema();
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const res = this.db.prepare(
      `INSERT OR IGNORE INTO watch_events
         (id, watch_id, tenant_id, change_key, source_id, source_name, summary, evidence, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'recorded', ?)`,
    ).run(
      id,
      event.watchId,
      event.tenantId,
      event.changeKey,
      event.sourceId,
      event.sourceName,
      event.summary,
      JSON.stringify(event.evidence),
      createdAt,
    );
    if (Number(res.changes) === 0) return null;
    return { id, ...event, status: 'recorded', createdAt };
  }

  async listWatchEvents(watchId: string, tenantId: string, limit: number): Promise<WatchEvent[]> {
    await this.ensureWatchSchema();
    const rows = this.db.prepare(
      'SELECT * FROM watch_events WHERE watch_id = ? AND tenant_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?',
    ).all(watchId, tenantId, limit) as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapWatchEventRow(r));
  }

  async updateWatchEventStatus(id: string, status: WatchEvent['status'], error?: string): Promise<void> {
    await this.ensureWatchSchema();
    this.db.prepare(
      'UPDATE watch_events SET status = ?, delivery_error = ? WHERE id = ?',
    ).run(status, error ?? null, id);
  }
}


export class SqliteStorageCache implements QuillCache {
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
