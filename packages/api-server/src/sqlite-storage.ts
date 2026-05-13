/**
 * CivInt Canada — SQLite Storage Backend
 *
 * Implements CivIntStorage using better-sqlite3 for local/container deployments.
 * Table schemas match the D1 schema from schema.sql exactly.
 */

import Database from 'better-sqlite3';
import type { CivIntStorage, CivIntCache, Tenant, AuditEntry, AuditQueryParams } from './types.js';
import { hashApiKey } from './auth.js';


export class SqliteStorage implements CivIntStorage {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const path = dbPath || process.env.CIVINT_DB_PATH || './civint.db';
    this.db = new Database(path);

    // Enable WAL mode for better concurrent read performance
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.migrate();
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
        email TEXT,
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
    // Internal tenant for Frostbite Gazette
    const insertTenant = this.db.prepare(`
      INSERT OR IGNORE INTO tenants (id, name, tier, journalism_mode)
      VALUES (?, ?, ?, ?)
    `);
        insertTenant.run('fg-internal', 'Frostbite Gazette', 'internal', 1);
        // Anonymous/unauth tenant for health checks
        insertTenant.run('anon', 'Anonymous', 'free', 0);

    // Dev/test API key (SHA-256 of "civint-dev-key")
    const insertKey = this.db.prepare(`
      INSERT OR IGNORE INTO api_keys (id, tenant_id, key_hash, name)
      VALUES (?, ?, ?, ?)
    `);
    // Pre-computed SHA-256 of "civint-dev-key"
    insertKey.run(
      'dev-key-1',
      'fg-internal',
      'c73d089e582ca8a90a5e3543a1c2fe6f89afc0f9c82319cea56a804048075799',
      'dev',
    );
  }

  /*  CivIntStorage Interface                                          */

  async authenticate(rawKey: string): Promise<{ tenant: Tenant; apiKeyId: string } | null> {
    const keyHash = await hashApiKey(rawKey);

    const row = this.db.prepare(`
      SELECT t.id AS tenant_id, t.name, t.email, t.tier, t.is_active, t.journalism_mode,
             k.id AS key_id, k.is_active AS key_active
      FROM api_keys k
      JOIN tenants t ON t.id = k.tenant_id
      WHERE k.key_hash = ?
    `).get(keyHash) as Record<string, unknown> | undefined;

    if (!row) return null;
    if (!row.key_active || !row.is_active) return null;

    // Update last_used_at
    this.db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?")
      .run(row.key_id);

    return {
      tenant: {
        id: row.tenant_id as string,
        name: row.name as string,
        email: (row.email as string) || undefined,
        tier: row.tier as Tenant['tier'],
        isActive: Boolean(row.is_active),
        journalismMode: Boolean(row.journalism_mode),
      },
      apiKeyId: row.key_id as string,
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

  /*  Registration Helpers (for SqliteStorage)                         */

  /** Create a new tenant. */
  createTenant(tenant: Tenant): void {
    this.db.prepare(`
      INSERT INTO tenants (id, name, email, tier, is_active, journalism_mode)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(tenant.id, tenant.name, tenant.email || null, tenant.tier, tenant.isActive ? 1 : 0, tenant.journalismMode ? 1 : 0);
  }

  /** Create a new API key record. */
  createApiKey(keyId: string, tenantId: string, keyHash: string, name: string): void {
    this.db.prepare(`
      INSERT INTO api_keys (id, tenant_id, key_hash, name)
      VALUES (?, ?, ?, ?)
    `).run(keyId, tenantId, keyHash, name);
  }

  /** Get a tenant by ID. */
  getTenant(tenantId: string): Tenant | null {
    const row = this.db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: row.id as string,
      name: row.name as string,
      email: (row.email as string) || undefined,
      tier: row.tier as Tenant['tier'],
      isActive: Boolean(row.is_active),
      journalismMode: Boolean(row.journalism_mode),
    };
  }
}


export class SqliteStorageCache implements CivIntCache {
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
}
