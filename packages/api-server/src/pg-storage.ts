/**
 * Quill — PostgreSQL Storage Backend
 *
 * Implements QuillStorage using pg (node-postgres) for production deployments.
 * Schema mirrors SqliteStorage exactly for seamless migration.
 */

import pg from 'pg';
import type { QuillStorage, QuillCache, Tenant, AuditEntry, AuditQueryParams } from './types.js';
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

    sql += ` ORDER BY created_at DESC LIMIT $${n++} OFFSET $${n++}`;
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
    const { rows } = await this.pool.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
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
