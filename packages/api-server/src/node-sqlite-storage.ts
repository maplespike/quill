/**
 * MapleSpike — Node Built-in SQLite Storage
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
import type { MapleSpikeStorage, MapleSpikeCache, Tenant } from './types.js';
import { hashApiKey } from './auth.js';

export class NodeSqliteStorage implements MapleSpikeStorage {
  private db: DatabaseSync;

  constructor(dbPath?: string) {
    const path = dbPath || process.env.MAPLESPIKE_DB_PATH || './maplespike.db';
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA foreign_keys = ON');
    this.migrate();
    this.seed();
  }

  close(): void {
    this.db.close();
  }

  /* ── Schema ──────────────────────────────────────────────────── */

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
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
  }

  private seed(): void {
    // Seed dev tenant if empty
    const count = this.db.prepare('SELECT COUNT(*) as n FROM tenants').get() as { n: number };
    if (count.n === 0) {
      this.db.prepare(
        'INSERT INTO tenants (id, name, email, email_verified, tier, is_active) VALUES (?, ?, ?, 1, ?, 1)'
      ).run('ms-internal', 'MapleSpike Internal', 'internal@maplespike.lan', 'pro' as const);

      // Create dev key
      const keyHash = hashApiKeySync('ms_live_dev_key_2024');
      this.db.prepare(
        'INSERT INTO api_keys (id, tenant_id, key_hash, name) VALUES (?, ?, ?, ?)'
      ).run('dev-key-1', 'ms-internal', keyHash, 'dev');
    }
  }

  /* ── MapleSpikeStorage interface ─────────────────────────────── */

  async authenticate(rawKey: string): Promise<{ tenant: Tenant; apiKeyId: string } | null> {
    const keyHash = hashApiKeySync(rawKey);
    const row = this.db.prepare(`
      SELECT k.id as key_id, k.tenant_id, t.name, t.email, t.email_verified,
             t.tier, t.is_active, t.journalism_mode
      FROM api_keys k
      JOIN tenants t ON k.tenant_id = t.id
      WHERE k.key_hash = ? AND k.is_active = 1 AND t.is_active = 1
    `).get(keyHash) as {
      key_id: string; tenant_id: string; name: string; email: string;
      email_verified: number; tier: string; is_active: number; journalism_mode: number;
    } | undefined;

    if (!row) return null;

    this.db.prepare('UPDATE api_keys SET last_used_at = datetime(\'now\') WHERE id = ?')
      .run(row.key_id);

    return {
      tenant: {
        id: row.tenant_id,
        name: row.name,
        email: row.email,
        emailVerified: Boolean(row.email_verified),
        tier: row.tier as 'free' | 'pro' | 'business' | 'enterprise' | 'internal',
        isActive: Boolean(row.is_active),
        journalismMode: Boolean(row.journalism_mode),
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

  createTenant(tenant: Tenant): void {
    this.db.prepare(`
      INSERT INTO tenants (id, name, email, email_verified, verification_token, tier, is_active, journalism_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tenant.id, tenant.name, tenant.email || '',
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

  verifyEmail(token: string): { id: string; name: string; email: string } | null {
    const row = this.db.prepare(
      'SELECT id, name, email FROM tenants WHERE verification_token = ?'
    ).get(token) as { id: string; name: string; email: string } | undefined;
    if (!row) return null;
    this.db.prepare(
      'UPDATE tenants SET email_verified = 1, verification_token = NULL WHERE id = ?'
    ).run(row.id);
    return row;
  }
}

/* ── Cache ────────────────────────────────────────────────────── */

export class NodeSqliteCache implements MapleSpikeCache {
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

import { createHash } from 'node:crypto';

function hashApiKeySync(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}
