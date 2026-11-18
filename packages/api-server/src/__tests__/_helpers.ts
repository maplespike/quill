// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Test Helpers
 *
 * Shared stubs for build-free tsx tests. Importing from this file keeps
 * test setup DRY across the OAuth/auth suite.
 */

import type { RouteContext, QuillCache, Tenant } from '../types.js';
import { MemoryStorage, MemoryCache } from '../storage.js';

/**
 * In-memory implementation of QuillCache for tests.
 * Mirrors MemoryCache semantics (TTL honoured on read, delete is sync).
 */
export class InMemoryCache implements QuillCache {
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
    this.store.set(key, {
      value,
      expires: Date.now() + (ttlSeconds ?? 60) * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  /**
   * Force a key's expiry to a specific epoch-ms timestamp (test-only).
   * Used to deterministically test TTL behaviour without sleeping.
   * No-op if the key does not exist.
   */
  async expireAt(key: string, epochMs: number): Promise<void> {
    const entry = this.store.get(key);
    if (!entry) return;
    entry.expires = epochMs;
  }
}

const DEFAULT_TENANT: Tenant = {
  id: 'test-tenant',
  name: 'Test User',
  emailVerified: true,
  tier: 'free',
  isActive: true,
  journalismMode: false,
};

export interface MakeCtxOptions {
  cache?: QuillCache;
  db?: unknown;
  tenant?: Partial<Tenant>;
}

/**
 * Build a RouteContext for handler-level tests.
 * Defaults to a real in-memory storage/cache and a free-tier tenant.
 * Override `tenant.tier` to test Pro/Business feature gates.
 */
export function makeCtx(opts: MakeCtxOptions = {}): RouteContext {
  const tenant: Tenant = { ...DEFAULT_TENANT, ...opts.tenant };
  const db = opts.db ?? new MemoryStorage();
  const cache = opts.cache ?? new MemoryCache();
  return {
    tenant,
    apiKeyId: 'test-key-id',
    requestId: 'test-req',
    startTime: Date.now(),
    env: {},
    db: db as RouteContext['db'],
    cache,
  };
}
