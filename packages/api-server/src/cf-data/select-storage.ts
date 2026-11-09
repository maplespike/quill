// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Pick the request store.
 *
 * Postgres and SQLite win, unchanged. Those are the in-cluster paths
 * (SQLite on the API PVC, Postgres). The Cloudflare D1 / KV branch runs
 * only when neither is configured and a D1 binding is present. That branch
 * stays on D1 and KV only while `quota:d1` and `quota:kv` are `ok`.
 * Any other flag selects the in-process store and does not touch Cloudflare.
 */

import type { Env, QuillCache, QuillStorage } from '../types.js';
import { D1Storage, KVCache, MemoryCache, MemoryStorage } from '../storage.js';
import {
  guardD1Binding,
  guardForEnv,
  guardKvBinding,
  sharedMemoryD1,
  sharedMemoryKv,
  type CfQuotaGuard,
} from './quota-store.js';

export interface OpenStorageArgs {
  env: Env;
  processEnv?: Record<string, string | undefined>;
  /** Tests inject a guard so they do not share the process-wide flag cache. */
  guard?: CfQuotaGuard;
}

export interface OpenStorageResult {
  db: QuillStorage;
  cache: QuillCache;
  /** Passed to the annotation store. Set only when D1 is actually open. */
  annotationDb?: Env['DB'];
}

export async function openStorage(args: OpenStorageArgs): Promise<OpenStorageResult> {
  const processEnv = args.processEnv ?? process.env;
  const env = args.env;
  const storageMode = (env.QUILL_STORAGE || processEnv.QUILL_STORAGE || '').toLowerCase();
  const databaseUrl = env.DATABASE_URL || processEnv.DATABASE_URL;
  const dbHost = env.QUILL_DB_HOST || processEnv.QUILL_DB_HOST;

  if (storageMode === 'postgres' || databaseUrl || dbHost) {
    const { PgStorage, PgCache } = await import('../pg-storage.js');
    const pgDb = new PgStorage(databaseUrl);
    await pgDb.init();
    return { db: pgDb, cache: new PgCache() };
  }

  if (storageMode === 'sqlite' || storageMode === 'node-sqlite' || processEnv.QUILL_DB_PATH) {
    const { NodeSqliteStorage, NodeSqliteCache } = await import('../node-sqlite-storage.js');
    return { db: new NodeSqliteStorage(processEnv.QUILL_DB_PATH), cache: new NodeSqliteCache() };
  }

  if (env.DB) {
    const guard = args.guard ?? guardForEnv(env, processEnv);
    const d1Open = await guard.allows('d1');
    const kvOpen = await guard.allows('kv');
    const d1 = guardD1Binding(env.DB, sharedMemoryD1(), guard);
    const cacheBinding = env.CACHE ? guardKvBinding(env.CACHE, sharedMemoryKv(), guard) : undefined;
    return {
      db: d1Open ? new D1Storage(d1) : new MemoryStorage(),
      cache: kvOpen && cacheBinding ? new KVCache(cacheBinding) : new MemoryCache(),
      annotationDb: d1Open ? d1 : undefined,
    };
  }

  return { db: new MemoryStorage(), cache: new MemoryCache() };
}
