/**
 * MapleSpike — Test Helpers
 *
 * Shared stubs for build-free tsx tests. Importing from this file keeps
 * test setup DRY across the OAuth/auth suite.
 */

import type { RouteContext, MapleSpikeCache } from '../types.js';

/**
 * In-memory implementation of MapleSpikeCache for tests.
 * Mirrors MemoryCache semantics (TTL honoured on read, delete is sync).
 */
export class InMemoryCache implements MapleSpikeCache {
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
}

/**
 * Build a minimal RouteContext for handler-level tests.
 * db is left as `{} as any` because the OAuth handlers that only need
 * cache don't actually touch db. Callers that need a real db should
 * pass it via the second argument.
 */
export function makeCtx(opts: { cache?: MapleSpikeCache; db?: unknown } = {}): RouteContext {
  return {
    tenant: {
      id: 'anon',
      name: 'Anonymous',
      emailVerified: false,
      tier: 'free',
      isActive: true,
      journalismMode: false,
    },
    apiKeyId: '',
    requestId: 'test-req',
    startTime: Date.now(),
    env: {},
    db: (opts.db ?? {}) as RouteContext['db'],
    cache: opts.cache ?? new InMemoryCache(),
  };
}
