/**
 * CivInt Canada — Storage Abstraction
 *
 * Provides D1-backed and in-memory storage implementations
 * of the CivIntStorage interface.
 */

import type { CivIntStorage, CivIntCache, Tenant, AuditEntry, AuditQueryParams } from './types.js';
import { hashApiKey } from './auth.js';
import type { Env } from './types.js';

/* ------------------------------------------------------------------ */
/*  D1 Implementation (Cloudflare Workers production)                  */
/* ------------------------------------------------------------------ */

export class D1Storage implements CivIntStorage {
  private db: Env['DB'];

  constructor(db: Env['DB']) {
    this.db = db;
  }

  async authenticate(rawKey: string): Promise<{ tenant: Tenant; apiKeyId: string } | null> {
    const keyHash = await hashApiKey(rawKey);

    const row = await this.db.prepare(`
      SELECT t.id AS tenant_id, t.name, t.email, t.tier, t.is_active, t.journalism_mode,
             k.id AS key_id, k.is_active AS key_active
      FROM api_keys k
      JOIN tenants t ON t.id = k.tenant_id
      WHERE k.key_hash = ?1
    `).bind(keyHash).first<Record<string, unknown>>();

    if (!row) return null;
    if (!row.key_active || !row.is_active) return null;

    // Update last_used_at
    await this.db.prepare('UPDATE api_keys SET last_used_at = datetime(\'now\') WHERE id = ?1')
      .bind(row.key_id).run();

    return {
      tenant: {
        id: row.tenant_id as string,
        name: row.name as string,
        email: row.email as string || undefined,
        tier: row.tier as Tenant['tier'],
        isActive: Boolean(row.is_active),
        journalismMode: Boolean(row.journalism_mode),
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
}

/* ------------------------------------------------------------------ */
/*  KV Cache Implementation                                            */
/* ------------------------------------------------------------------ */

export class KVCache implements CivIntCache {
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
}

/* ------------------------------------------------------------------ */
/*  In-Memory Implementation (development / testing)                   */
/* ------------------------------------------------------------------ */

export class MemoryStorage implements CivIntStorage {
  private tenants: Map<string, Tenant> = new Map();
  private keyToTenant: Map<string, { tenantId: string; keyId: string }> = new Map();
  private dailyUsage: Map<string, number> = new Map();
  private monthlyUsage: Map<string, number> = new Map();
  private auditLog: AuditEntry[] = [];

  constructor() {
    // Seed: internal tenant for FG
    const internalTenant: Tenant = {
      id: 'fg-internal',
      name: 'Frostbite Gazette',
      tier: 'internal',
      isActive: true,
      journalismMode: true,
    };
    this.tenants.set('fg-internal', internalTenant);
  // Dev key: "civint-dev-key" -> SHA-256
  const devKeyHash = 'c73d089e582ca8a90a5e3543a1c2fe6f89afc0f9c82319cea56a804048075799';
  this.keyToTenant.set(devKeyHash, {
      tenantId: 'fg-internal',
      keyId: 'dev-key-1',
    });
  }

  /** Register a new tenant + key for testing. */
  registerTenant(tenant: Tenant, keyHash: string, keyId: string): void {
    this.tenants.set(tenant.id, tenant);
    this.keyToTenant.set(keyHash, { tenantId: tenant.id, keyId });
  }

  async authenticate(rawKey: string): Promise<{ tenant: Tenant; apiKeyId: string } | null> {
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
}

export class MemoryCache implements CivIntCache {
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
