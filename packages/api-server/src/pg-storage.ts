/**
 * Quill — PostgreSQL Storage Backend
 *
 * Implements QuillStorage using pg (node-postgres) for production deployments.
 * Schema mirrors SqliteStorage exactly for seamless migration.
 */

import pg from 'pg';
import type { QuillStorage, QuillCache, Tenant, AuditEntry, AuditQueryParams, TenantStripeUpdates, StripeOrder, StripeOrderInsert, StripeOrderUpdates, PaymentReconciliation, PaymentReconciliationInsert, ExpiringTier, TaxLedgerEntryInsert, TaxLedgerSummary, Watch, WatchInsert, WatchEvent, WatchEventInsert } from './types.js';
import { randomUUID } from 'node:crypto';
import { hashApiKey, generateApiKey } from './auth.js';
import pino from 'pino';

const log = pino({
  level: process.env.QUILL_LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
    : undefined,
});

const { Pool } = pg;

export class PgStorage implements QuillStorage {
  private pool: pg.Pool;

  constructor(connectionString?: string) {
    const connStr = connectionString
      || process.env.DATABASE_URL
      || (() => {
        const host = process.env.QUILL_DB_HOST || 'localhost';
        const port = process.env.QUILL_DB_PORT || '5432';
        const db   = process.env.QUILL_DB_NAME || 'maplespike';
        const user = process.env.QUILL_DB_USER || 'maplespike';
        const pass = process.env.QUILL_DB_PASSWORD || '';
        return `postgresql://${user}:${pass}@${host}:${port}/${db}`;
      })();

    this.pool = new Pool({ connectionString: connStr, max: 10 });
    this.pool.on('error', (err) => {
      log.error(`Unexpected pool error: ${err.message}`);
    });
  }

  async init(): Promise<void> {
    await this.migrate();
    await this.seed();
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  /*  Schema Migration                                                 */

  private async migrate(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS tenants (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT,
          email_verified BOOLEAN DEFAULT FALSE,
          verification_token TEXT,
          tier TEXT NOT NULL DEFAULT 'free',
          is_active BOOLEAN DEFAULT TRUE,
          journalism_mode BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS api_keys (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          key_hash TEXT NOT NULL UNIQUE,
          name TEXT DEFAULT 'default',
          is_active BOOLEAN DEFAULT TRUE,
          last_used_at TIMESTAMPTZ,
          expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_keys_tenant ON api_keys(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_keys_hash ON api_keys(key_hash);
        CREATE INDEX IF NOT EXISTS idx_keys_active ON api_keys(is_active);

        CREATE TABLE IF NOT EXISTS daily_usage (
          id SERIAL PRIMARY KEY,
          tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          date TEXT NOT NULL,
          call_count INTEGER DEFAULT 0,
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(tenant_id, date)
        );

        CREATE INDEX IF NOT EXISTS idx_usage_tenant_date ON daily_usage(tenant_id, date);

        CREATE TABLE IF NOT EXISTS monthly_usage (
          id SERIAL PRIMARY KEY,
          tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          year_month TEXT NOT NULL,
          call_count INTEGER DEFAULT 0,
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(tenant_id, year_month)
        );

        CREATE INDEX IF NOT EXISTS idx_monthly_tenant ON monthly_usage(tenant_id, year_month);

        CREATE TABLE IF NOT EXISTS audit_log (
          id SERIAL PRIMARY KEY,
          tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          api_key_id TEXT,
          operation TEXT NOT NULL,
          model TEXT,
          endpoint TEXT,
          input_preview TEXT,
          output_summary TEXT,
          confidence INTEGER,
          success BOOLEAN DEFAULT TRUE,
          error_message TEXT,
          duration_ms INTEGER,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_audit_operation ON audit_log(operation);
        CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

        -- Phase 1 (Stripe monetization): add Stripe linkage columns + orders table.
        -- Idempotent via IF NOT EXISTS (Postgres 9.6+ ADD COLUMN supports this).
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_subscription_status TEXT;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_current_period_end BIGINT;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_updated_at TIMESTAMPTZ;

        CREATE TABLE IF NOT EXISTS stripe_orders (
          order_id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          plan_id TEXT NOT NULL,
          amount_cents INTEGER NOT NULL,
          currency TEXT NOT NULL DEFAULT 'CAD',
          -- Authoritative dedupe boundary — first writer wins; second
          -- writer's webhook delivery becomes a no-op (UPSERT).
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
    } finally {
      client.release();
    }
  }

  /*  Seed Data                                                        */

  private async seed(): Promise<void> {
    await this.pool.query(`
      INSERT INTO tenants (id, name, tier, journalism_mode)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO NOTHING
    `, ['ms-internal', 'MapleSpike', 'internal', true]);

    await this.pool.query(`
      INSERT INTO tenants (id, name, tier, journalism_mode)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO NOTHING
    `, ['anon', 'Anonymous', 'free', false]);

    // Pre-computed SHA-256 of "maplespike-dev-key"
    await this.pool.query(`
      INSERT INTO api_keys (id, tenant_id, key_hash, name)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO NOTHING
    `, ['dev-key-1', 'ms-internal', 'c73d089e582ca8a90a5e3543a1c2fe6f89afc0f9c82319cea56a804048075799', 'dev']);
  }

  /*  QuillStorage Interface                                      */

  async authenticate(rawKey: string): Promise<{ tenant: Tenant; apiKeyId: string; rotatedKey?: { id: string; key: string; expiresAt: string } } | null> {
    const keyHash = await hashApiKey(rawKey);

    const { rows } = await this.pool.query(`
      SELECT t.id AS tenant_id, t.name, t.email, t.tier, t.is_active, t.journalism_mode,
             t.stripe_customer_id, t.stripe_subscription_id, t.stripe_subscription_status, t.stripe_current_period_end,
             k.id AS key_id, k.is_active AS key_active, k.expires_at
      FROM api_keys k
      JOIN tenants t ON t.id = k.tenant_id
      WHERE k.key_hash = $1
    `, [keyHash]);

    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    if (!row.key_active || !row.is_active) return null;

    const expiresAt = row.expires_at as string | null;
    const now = new Date();
    if (expiresAt && new Date(expiresAt) < now) {
      return null;
    }

    await this.pool.query(
      "UPDATE api_keys SET last_used_at = NOW() WHERE id = $1",
      [row.key_id],
    );

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
        await this.createApiKey(newKeyId, row.tenant_id as string, newKeyHash, 'auto-rotated', newExpiresAt.toISOString());
        await this.revokeApiKey(row.key_id as string, row.tenant_id as string);
        rotatedKey = { id: newKeyId, key: newRawKey, expiresAt: newExpiresAt.toISOString() };
      }
    }

    return {
      tenant: {
        id: row.tenant_id as string,
        name: row.name as string,
        emailHash: (row.email as string) || undefined,
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
    const { rows } = await this.pool.query(
      'SELECT call_count FROM daily_usage WHERE tenant_id = $1 AND date = $2',
      [tenantId, date],
    );
    return (rows[0] as { call_count: number } | undefined)?.call_count || 0;
  }

  async getMonthlyUsage(tenantId: string, yearMonth: string): Promise<number> {
    const { rows } = await this.pool.query(
      'SELECT call_count FROM monthly_usage WHERE tenant_id = $1 AND year_month = $2',
      [tenantId, yearMonth],
    );
    return (rows[0] as { call_count: number } | undefined)?.call_count || 0;
  }

  async incrementUsage(tenantId: string, date: string, yearMonth: string): Promise<void> {
    await this.pool.query(`
      INSERT INTO daily_usage (tenant_id, date, call_count)
      VALUES ($1, $2, 1)
      ON CONFLICT (tenant_id, date) DO UPDATE SET call_count = daily_usage.call_count + 1, updated_at = NOW()
    `, [tenantId, date]);

    await this.pool.query(`
      INSERT INTO monthly_usage (tenant_id, year_month, call_count)
      VALUES ($1, $2, 1)
      ON CONFLICT (tenant_id, year_month) DO UPDATE SET call_count = monthly_usage.call_count + 1, updated_at = NOW()
    `, [tenantId, yearMonth]);
  }

  async logAudit(entry: Omit<AuditEntry, 'id' | 'created_at'>): Promise<void> {
    await this.pool.query(`
      INSERT INTO audit_log (tenant_id, api_key_id, operation, model, endpoint, input_preview, output_summary, confidence, success, error_message, duration_ms)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `,
      [
        entry.tenantId,
        entry.apiKeyId || null,
        entry.operation,
        entry.model || null,
        entry.endpoint,
        (entry.inputPreview || '').slice(0, 500),
        (entry.outputSummary || '').slice(0, 500),
        entry.confidence ?? null,
        entry.success,
        entry.errorMessage || null,
        entry.durationMs,
      ],
    );
  }

  async queryAudit(filter: AuditQueryParams): Promise<AuditEntry[]> {
    let sql = 'SELECT * FROM audit_log WHERE tenant_id = $1';
    const params: unknown[] = [filter.tenantId];
    let n = 2;

    if (filter.operation) {
      sql += ` AND operation = $${n++}`;
      params.push(filter.operation);
    }
    if (filter.success !== undefined) {
      sql += ` AND success = $${n++}`;
      params.push(filter.success);
    }
    if (filter.since) {
      sql += ` AND created_at >= $${n++}`;
      params.push(filter.since);
    }
    if (filter.until) {
      sql += ` AND created_at <= $${n++}`;
      params.push(filter.until);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${n} OFFSET $${n + 1}`;
    params.push(filter.limit || 50, filter.offset || 0);

    const { rows } = await this.pool.query(sql, params);
    return (rows || []) as AuditEntry[];
  }

  async listApiKeys(tenantId: string): Promise<Array<{ id: string; name: string; isActive: boolean; createdAt: string; lastUsedAt: string | null; expiresAt: string | null }>> {
    const { rows } = await this.pool.query(
      'SELECT id, name, is_active, created_at, last_used_at, expires_at FROM api_keys WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId],
    );
    return (rows as Array<{ id: string; name: string; is_active: boolean; created_at: string; last_used_at: string | null; expires_at: string | null }>).map((row) => ({
      id: row.id,
      name: row.name,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      expiresAt: row.expires_at,
    }));
  }

  /*  Extra helpers (for registration / key management)                */

  async createTenant(tenant: Tenant & { verificationToken?: string }): Promise<void> {
    await this.pool.query(`
      INSERT INTO tenants (id, name, email, email_verified, verification_token, tier, is_active, journalism_mode)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [tenant.id, tenant.name, (tenant as any).email || tenant.emailHash || null, Boolean(tenant.emailVerified), tenant.verificationToken || null, tenant.tier, tenant.isActive, tenant.journalismMode]);
  }

  async createApiKey(keyId: string, tenantId: string, keyHash: string, name: string, expiresAt?: string): Promise<void> {
    await this.pool.query(`
      INSERT INTO api_keys (id, tenant_id, key_hash, name, expires_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [keyId, tenantId, keyHash, name, expiresAt || null]);
  }

  async revokeApiKey(keyId: string, _tenantId: string): Promise<void> {
    await this.pool.query(
      'UPDATE api_keys SET is_active = FALSE WHERE id = $1',
      [keyId],
    );
  }

  async getTenant(tenantId: string): Promise<Tenant | null> {
    const { rows } = await this.pool.query(
      'SELECT id, name, email, email_verified, tier, is_active, journalism_mode, stripe_customer_id, stripe_subscription_id, stripe_subscription_status, stripe_current_period_end FROM tenants WHERE id = $1',
      [tenantId],
    );
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: row.id as string,
      name: row.name as string,
      emailHash: (row.email as string) || undefined,
      emailVerified: Boolean(row.email_verified),
      tier: row.tier as Tenant['tier'],
      isActive: Boolean(row.is_active),
      journalismMode: Boolean(row.journalism_mode),
      stripeCustomerId: (row.stripe_customer_id as string | null) ?? undefined,
      stripeSubscriptionId: (row.stripe_subscription_id as string | null) ?? undefined,
      stripeSubscriptionStatus: (row.stripe_subscription_status as Tenant['stripeSubscriptionStatus']) ?? undefined,
      stripeCurrentPeriodEnd: (row.stripe_current_period_end as number | null) ?? undefined,
    };
  }

  async verifyEmail(token: string): Promise<boolean> {
    const { rows } = await this.pool.query(
      'SELECT id FROM tenants WHERE verification_token = $1 AND email_verified = FALSE',
      [token],
    );
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) return false;
    await this.pool.query(
      'UPDATE tenants SET email_verified = TRUE, verification_token = NULL, updated_at = NOW() WHERE id = $1',
      [row.id],
    );
    return true;
  }

  /*  Stripe billing persistence (Phase 1)                       */

  async createStripeOrder(order: StripeOrderInsert): Promise<void> {
    await this.pool.query(`
      INSERT INTO stripe_orders (
        order_id, tenant_id, plan_id, amount_cents, currency,
        stripe_checkout_session_id, status, created_at, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, EXTRACT(EPOCH FROM NOW())::INTEGER, $8)
    `, [
      order.order_id,
      order.tenant_id,
      order.plan_id,
      order.amount_cents,
      order.currency,
      order.stripe_checkout_session_id,
      order.status,
      order.expires_at,
    ]);
  }

  async getStripeOrderById(orderId: string): Promise<StripeOrder | null> {
    const { rows } = await this.pool.query('SELECT * FROM stripe_orders WHERE order_id = $1', [orderId]);
    const row = rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapStripeOrder(row) : null;
  }

  async getStripeOrderBySessionId(sessionId: string): Promise<StripeOrder | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM stripe_orders WHERE stripe_checkout_session_id = $1',
      [sessionId],
    );
    const row = rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapStripeOrder(row) : null;
  }

  async updateStripeOrder(orderId: string, updates: StripeOrderUpdates): Promise<void> {
    const sets: string[] = [];
    const args: unknown[] = [];
    let p = 1;
    if (updates.status !== undefined) { sets.push(`status = $${p++}`); args.push(updates.status); }
    if (updates.stripe_customer_id !== undefined) { sets.push(`stripe_customer_id = $${p++}`); args.push(updates.stripe_customer_id); }
    if (updates.stripe_subscription_id !== undefined) { sets.push(`stripe_subscription_id = $${p++}`); args.push(updates.stripe_subscription_id); }
    if (updates.paid_at !== undefined) { sets.push(`paid_at = $${p++}`); args.push(updates.paid_at); }
    if (updates.fulfilled_at !== undefined) { sets.push(`fulfilled_at = $${p++}`); args.push(updates.fulfilled_at); }
    if (updates.cancelled_at !== undefined) { sets.push(`cancelled_at = $${p++}`); args.push(updates.cancelled_at); }
    if (sets.length === 0) return;
    args.push(orderId);
    await this.pool.query(`UPDATE stripe_orders SET ${sets.join(', ')} WHERE order_id = $${p}`, args);
  }

  async updateTenantStripe(tenantId: string, updates: TenantStripeUpdates): Promise<void> {
    const sets: string[] = [`stripe_updated_at = NOW()`];
    const args: unknown[] = [];
    let p = 1;
    if (updates.tier !== undefined) { sets.push(`tier = $${p++}`); args.push(updates.tier); }
    if (updates.stripeCustomerId !== undefined) { sets.push(`stripe_customer_id = $${p++}`); args.push(updates.stripeCustomerId); }
    if (updates.stripeSubscriptionId !== undefined) { sets.push(`stripe_subscription_id = $${p++}`); args.push(updates.stripeSubscriptionId); }
    if (updates.stripeSubscriptionStatus !== undefined) { sets.push(`stripe_subscription_status = $${p++}`); args.push(updates.stripeSubscriptionStatus); }
    if (updates.stripeCurrentPeriodEnd !== undefined) { sets.push(`stripe_current_period_end = $${p++}`); args.push(updates.stripeCurrentPeriodEnd); }
    args.push(tenantId);
    await this.pool.query(`UPDATE tenants SET ${sets.join(', ')} WHERE id = $${p}`, args);
  }

  async getTenantStripeCustomerId(tenantId: string): Promise<string | null> {
    const { rows } = await this.pool.query(
      'SELECT stripe_customer_id FROM tenants WHERE id = $1',
      [tenantId],
    );
    const row = rows[0] as { stripe_customer_id: string | null } | undefined;
    return row?.stripe_customer_id ?? null;
  }

  async getTenantStripeSubscriptionId(tenantId: string): Promise<string | null> {
    const { rows } = await this.pool.query(
      'SELECT stripe_subscription_id FROM tenants WHERE id = $1',
      [tenantId],
    );
    const row = rows[0] as { stripe_subscription_id: string | null } | undefined;
    const id = row?.stripe_subscription_id ?? null;
    return id ? id : null;
  }

  async getTenantStripeSubscriptionStatus(tenantId: string): Promise<string | null> {
    const { rows } = await this.pool.query('SELECT stripe_subscription_status FROM tenants WHERE id = $1', [tenantId]);
    const row = rows[0] as { stripe_subscription_status: string | null } | undefined;
    return row?.stripe_subscription_status ?? null;
  }

  /** Map raw postgres row -> StripeOrder (column-name canonicalisation). */
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

  async ensureReconciliationsSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS payment_reconciliations (
        id SERIAL PRIMARY KEY,
        transaction_uid TEXT NOT NULL UNIQUE,
        order_id TEXT,
        amount_cents INTEGER,
        reference TEXT,
        channel TEXT NOT NULL DEFAULT 'stripe',
        processed_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
      );
      CREATE INDEX IF NOT EXISTS idx_reconciliations_processed ON payment_reconciliations(processed_at DESC);
    `);
  }

  async createPaymentReconciliation(rec: PaymentReconciliationInsert): Promise<void> {
    await this.ensureReconciliationsSchema();
    await this.pool.query(
      `INSERT INTO payment_reconciliations (transaction_uid, order_id, amount_cents, reference, channel) VALUES ($1, $2, $3, $4, $5)`,
      [rec.transactionUid, rec.orderId ?? null, rec.amountCents ?? null, rec.reference ?? null, rec.channel],
    );
  }

  async getPaymentReconciliations(limit: number = 50): Promise<PaymentReconciliation[]> {
    await this.ensureReconciliationsSchema();
    const { rows } = await this.pool.query(
      `SELECT id, transaction_uid, order_id, amount_cents, reference, channel, processed_at FROM payment_reconciliations ORDER BY processed_at DESC LIMIT $1`,
      [limit],
    );
    return (rows as Array<Record<string, unknown>>).map((r) => ({
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
    const { rows } = await this.pool.query(
      `SELECT id AS tenant_id, stripe_current_period_end, tier FROM tenants WHERE stripe_current_period_end IS NOT NULL AND stripe_current_period_end < $1 AND tier != 'free'`,
      [nowUnix],
    );
    return (rows as Array<{ tenant_id: string; stripe_current_period_end: number; tier: string }>).map((r) => ({
      tenant_id: r.tenant_id,
      stripe_current_period_end: r.stripe_current_period_end,
      tier: r.tier as ExpiringTier['tier'],
    }));
  }

  /* ── Tax ledger (#811 — Postgres) ── */

  async ensureTaxLedgerSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS tax_ledger (
        id TEXT PRIMARY KEY,
        entry_type TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'CAD',
        order_id TEXT,
        tenant_id TEXT,
        stripe_event_id TEXT UNIQUE,
        note TEXT,
        created_at BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tax_ledger_created ON tax_ledger(created_at);
    `);
  }

  async insertTaxLedgerEntry(entry: TaxLedgerEntryInsert): Promise<void> {
    await this.ensureTaxLedgerSchema();
    await this.pool.query(
      `INSERT INTO tax_ledger (id, entry_type, amount_cents, currency, order_id, tenant_id, stripe_event_id, note, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        entry.id,
        entry.entryType,
        entry.amountCents,
        entry.currency,
        entry.orderId ?? null,
        entry.tenantId ?? null,
        entry.stripeEventId ?? null,
        entry.note ?? null,
        entry.createdAt ?? Math.floor(Date.now() / 1000),
      ],
    );
  }

  async hasTaxLedgerEntry(id: string): Promise<boolean> {
    await this.ensureTaxLedgerSchema();
    const { rows } = await this.pool.query('SELECT 1 FROM tax_ledger WHERE id = $1', [id]);
    return rows.length > 0;
  }

  async getTaxLedgerSummary(windowStartUnix: number): Promise<TaxLedgerSummary> {
    await this.ensureTaxLedgerSchema();
    const { rows } = await this.pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END), 0) AS gross_cents,
         COALESCE(SUM(CASE WHEN amount_cents < 0 THEN -amount_cents ELSE 0 END), 0) AS refunds_cents,
         COUNT(*)::int AS entry_count
       FROM tax_ledger WHERE created_at >= $1`,
      [windowStartUnix],
    );
    const lastRes = await this.pool.query('SELECT id FROM tax_ledger ORDER BY created_at DESC LIMIT 1');
    const agg = rows[0] as { gross_cents: string | number; refunds_cents: string | number; entry_count: number };
    const gross = Number(agg.gross_cents ?? 0);
    const refunds = Number(agg.refunds_cents ?? 0);
    const net = gross - refunds;
    return {
      grossCents: gross,
      refundsCents: refunds,
      netCents: net,
      netCad: net / 100,
      windowStartUnix,
      lastEventId: (lastRes.rows[0] as { id: string } | undefined)?.id ?? null,
      entryCount: agg.entry_count ?? 0,
    };
  }

  /* ── Watchlist alerts (watchlist-alerts-v1) ─────────────────── */

  private watchSchemaReady = false;

  async ensureWatchSchema(): Promise<void> {
    if (this.watchSchemaReady) return;
    await this.pool.query(`
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
    await this.pool.query(
      `INSERT INTO watches (id, tenant_id, sources, events, keyword, delivery, label, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9)`,
      [
        watch.id,
        watch.tenantId,
        JSON.stringify(watch.sources),
        JSON.stringify(watch.events),
        watch.keyword ?? null,
        watch.delivery,
        watch.label ?? null,
        now,
        now,
      ],
    );
    return watch;
  }

  async listWatches(tenantId: string): Promise<Watch[]> {
    await this.ensureWatchSchema();
    const res = await this.pool.query(
      'SELECT * FROM watches WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId],
    );
    return res.rows.map((r) => this.mapWatchRow(r as Record<string, unknown>));
  }

  async listAllActiveWatches(): Promise<Watch[]> {
    await this.ensureWatchSchema();
    const res = await this.pool.query('SELECT * FROM watches WHERE active = 1');
    return res.rows.map((r) => this.mapWatchRow(r as Record<string, unknown>));
  }

  async getWatch(id: string, tenantId: string): Promise<Watch | null> {
    await this.ensureWatchSchema();
    const res = await this.pool.query(
      'SELECT * FROM watches WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapWatchRow(row) : null;
  }

  async deleteWatch(id: string, tenantId: string): Promise<boolean> {
    await this.ensureWatchSchema();
    const res = await this.pool.query(
      'DELETE FROM watches WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    return Number(res.rowCount) > 0;
  }

  async countActiveWatches(tenantId: string): Promise<number> {
    await this.ensureWatchSchema();
    const res = await this.pool.query(
      'SELECT COUNT(*)::int AS n FROM watches WHERE tenant_id = $1 AND active = 1',
      [tenantId],
    );
    return Number((res.rows[0] as { n: number }).n);
  }

  async insertWatchEvent(event: WatchEventInsert): Promise<WatchEvent | null> {
    await this.ensureWatchSchema();
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const res = await this.pool.query(
      `INSERT INTO watch_events
         (id, watch_id, tenant_id, change_key, source_id, source_name, summary, evidence, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'recorded', $9)
       ON CONFLICT (watch_id, change_key) DO NOTHING
       RETURNING id`,
      [
        id,
        event.watchId,
        event.tenantId,
        event.changeKey,
        event.sourceId,
        event.sourceName,
        event.summary,
        JSON.stringify(event.evidence),
        createdAt,
      ],
    );
    if (res.rows.length === 0) return null;
    return { id, ...event, status: 'recorded', createdAt };
  }

  async listWatchEvents(watchId: string, tenantId: string, limit: number): Promise<WatchEvent[]> {
    await this.ensureWatchSchema();
    const res = await this.pool.query(
      'SELECT * FROM watch_events WHERE watch_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT $3',
      [watchId, tenantId, limit],
    );
    return res.rows.map((r) => this.mapWatchEventRow(r as Record<string, unknown>));
  }

  async updateWatchEventStatus(id: string, status: WatchEvent['status'], error?: string): Promise<void> {
    await this.ensureWatchSchema();
    await this.pool.query(
      'UPDATE watch_events SET status = $1, delivery_error = $2 WHERE id = $3',
      [status, error ?? null, id],
    );
  }
}

export class PgCache implements QuillCache {
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
