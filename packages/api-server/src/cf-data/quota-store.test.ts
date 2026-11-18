// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quota guard tests.
 *
 * Before this guard, KVCache.put, D1Storage.logAudit, and the edge
 * RATE_LIMIT.put wrote to Cloudflare while quota:<service> was `over`.
 * That run failed the fallback contract. These tests cover the guarded path.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KVCache, D1Storage, MemoryStorage, MemoryCache } from '../storage.js';
import { NodeSqliteStorage } from '../node-sqlite-storage.js';
import type { Env } from '../types.js';
import { openStorage } from './select-storage.js';
import {
  CF_CACHED_TTL_SECONDS,
  CF_D1_AUDIT_RETENTION_DAYS,
  CF_D1_MAX_ROW_BYTES,
  CF_KV_MAX_VALUE_BYTES,
  CF_KV_MIN_TTL_SECONDS,
  CF_MAX_TTL_SECONDS,
  CF_R2_MAX_OBJECT_BYTES,
  CfQuotaGuard,
  CfSizeCapError,
  MemoryD1,
  MemoryKv,
  clampAuditRetentionDays,
  cloudflareKvFlagReader,
  edgeAiAllowed,
  guardD1Binding,
  guardKvBinding,
  guardedWrite,
  putR2,
  quotaFlagCacheTtlMs,
  readerFromEnvironment,
  resolveCfTtlSeconds,
  type CfD1Like,
  type CfKvLike,
} from './quota-store.js';

const auditEntry = {
  tenantId: 'tenant-1',
  apiKeyId: 'key-1',
  operation: 'ask',
  model: 'm',
  endpoint: '/v1/ai/ask',
  inputPreview: 'question',
  outputSummary: 'answer',
  confidence: null,
  success: true,
  durationMs: 4,
};

function recordingKv(): CfKvLike & {
  puts: Array<{ key: string; value: string; ttl?: number }>;
  deletes: string[];
  failNextPut: () => void;
} {
  const puts: Array<{ key: string; value: string; ttl?: number }> = [];
  const deletes: string[] = [];
  let failPut = false;
  return {
    puts,
    deletes,
    failNextPut() { failPut = true; },
    async get() { return null; },
    async put(key, value, options) {
      if (failPut) {
        failPut = false;
        throw new Error('cf write failed');
      }
      puts.push({ key, value, ttl: options?.expirationTtl });
    },
    async delete(key) { deletes.push(key); },
  };
}

function recordingD1(): CfD1Like & { runs: string[] } {
  const runs: string[] = [];
  return {
    runs,
    prepare(sql: string) {
      return {
        bind(..._params: unknown[]) {
          return {
            async run() {
              runs.push(sql);
              return { meta: {} };
            },
            async all() { return { results: [] }; },
            async first() { return null; },
          };
        },
      };
    },
  };
}

function guardReturning(flag: string | null | 'throw', now: () => number = () => 0): CfQuotaGuard {
  return new CfQuotaGuard(async () => {
    if (flag === 'throw') throw new Error('kv down');
    return flag;
  }, now, 60_000);
}

test('flag ok writes to Cloudflare and not the in-cluster store', async () => {
  const cf = recordingKv();
  const local = new MemoryKv(() => 0);
  const dest = await guardedWrite({
    service: 'kv',
    bytes: 4,
    guard: guardReturning('ok'),
    writeCloudflare: () => cf.put('k', 'v', { expirationTtl: 120 }),
    writeInCluster: () => local.put('k', 'local'),
  });
  assert.equal(dest, 'cloudflare');
  assert.equal(cf.puts.length, 1);
  assert.equal(await local.get('k'), null);
});

test('flag over falls back to in-cluster and does not write to Cloudflare', async () => {
  const cf = recordingKv();
  const local = new MemoryKv(() => 0);
  const wrapped = guardKvBinding(cf, local, guardReturning('over'));
  await wrapped.put('rl:tenant', '1', { expirationTtl: 120 });
  assert.deepEqual(cf.puts, []);
  assert.equal(await local.get('rl:tenant'), '1');
});

test('missing flag falls back to in-cluster', async () => {
  const cf = recordingKv();
  const local = new MemoryKv(() => 0);
  const dest = await guardedWrite({
    service: 'kv',
    bytes: 2,
    guard: guardReturning(null),
    writeCloudflare: () => cf.put('k', 'v'),
    writeInCluster: () => local.put('k', 'local'),
  });
  assert.equal(dest, 'in-cluster');
  assert.deepEqual(cf.puts, []);
  assert.equal(await local.get('k'), 'local');
});

test('unreadable flag falls back to in-cluster', async () => {
  const cf = recordingKv();
  const local = new MemoryKv(() => 0);
  const dest = await guardedWrite({
    service: 'kv',
    bytes: 2,
    guard: guardReturning('throw'),
    writeCloudflare: () => cf.put('k', 'v'),
    writeInCluster: () => local.put('k', 'local'),
  });
  assert.equal(dest, 'in-cluster');
  assert.deepEqual(cf.puts, []);
  assert.equal(await local.get('k'), 'local');
});

test('unknown flag value fails closed to in-cluster', async () => {
  const cf = recordingKv();
  const local = new MemoryKv(() => 0);
  await guardKvBinding(cf, local, guardReturning('YES')).put('k', 'v');
  assert.deepEqual(cf.puts, []);
  assert.equal(await local.get('k'), 'v');
});

test('a trimmed ok flag is accepted', async () => {
  const guard = new CfQuotaGuard(async () => 'ok\n');
  assert.equal(await guard.flag('kv'), 'ok');
});

test('a Cloudflare write error falls back to in-cluster', async () => {
  const cf = recordingKv();
  cf.failNextPut();
  const local = new MemoryKv(() => 0);
  const dest = await guardedWrite({
    service: 'kv',
    bytes: 2,
    guard: guardReturning('ok'),
    writeCloudflare: () => cf.put('k', 'v'),
    writeInCluster: () => local.put('k', 'kept'),
  });
  assert.equal(dest, 'in-cluster');
  assert.equal(await local.get('k'), 'kept');
});

test('KV size cap rejects the write and touches neither store', async () => {
  const cf = recordingKv();
  const local = new MemoryKv(() => 0);
  const value = 'x'.repeat(CF_KV_MAX_VALUE_BYTES + 1);
  await assert.rejects(
    () => guardKvBinding(cf, local, guardReturning('ok')).put('k', value),
    (err: unknown) => err instanceof CfSizeCapError && err.service === 'kv',
  );
  assert.deepEqual(cf.puts, []);
  assert.equal(await local.get('k'), null);
});

test('D1 size cap rejects the row and touches neither store', async () => {
  const cf = recordingD1();
  const local = new MemoryD1();
  const huge = 'y'.repeat(CF_D1_MAX_ROW_BYTES);
  await assert.rejects(
    () => guardD1Binding(cf, local, guardReturning('ok')).prepare('INSERT INTO t VALUES (?)').bind(huge).run(),
    (err: unknown) => err instanceof CfSizeCapError && err.service === 'd1',
  );
  assert.deepEqual(cf.runs, []);
  assert.equal(local.writes.length, 0);
});

test('R2 size cap rejects the object', async () => {
  const cfPuts: string[] = [];
  const localPuts: string[] = [];
  await assert.rejects(
    () => putR2({
      cf: { async put(key) { cfPuts.push(key); } },
      fallback: { async put(key) { localPuts.push(key); } },
      guard: guardReturning('ok'),
      key: 'blob',
      body: new Uint8Array(CF_R2_MAX_OBJECT_BYTES + 1),
    }),
    (err: unknown) => err instanceof CfSizeCapError && err.service === 'r2',
  );
  assert.deepEqual(cfPuts, []);
  assert.deepEqual(localPuts, []);
});

test('R2 over flag writes to the in-cluster store', async () => {
  const cfPuts: string[] = [];
  const localPuts: string[] = [];
  const dest = await putR2({
    cf: { async put(key) { cfPuts.push(key); } },
    fallback: { async put(key) { localPuts.push(key); } },
    guard: guardReturning('over'),
    key: 'blob',
    body: 'small',
  });
  assert.equal(dest, 'in-cluster');
  assert.deepEqual(cfPuts, []);
  assert.deepEqual(localPuts, ['blob']);
});

test('flag cache serves the previous value until the TTL, then refreshes', async () => {
  const clock = { t: 0 };
  const seen: string[] = [];
  const guard = new CfQuotaGuard(async (key) => {
    seen.push(`${key}@${clock.t}`);
    return clock.t < 60_000 ? 'ok' : 'over';
  }, () => clock.t, 60_000);

  assert.equal(await guard.flag('kv'), 'ok');
  clock.t = 59_999;
  assert.equal(await guard.flag('kv'), 'ok');
  assert.equal(seen.length, 1);

  clock.t = 60_000;
  assert.equal(await guard.flag('kv'), 'over');
  assert.equal(seen.length, 2);
});

test('an error flag is cached until the TTL expires', async () => {
  const clock = { t: 0 };
  let calls = 0;
  const guard = new CfQuotaGuard(async () => {
    calls += 1;
    if (calls === 1) throw new Error('down');
    return 'ok';
  }, () => clock.t, 60_000);
  assert.equal(await guard.flag('d1'), 'error');
  assert.equal(await guard.flag('d1'), 'error');
  assert.equal(calls, 1);
  clock.t = 60_000;
  assert.equal(await guard.flag('d1'), 'ok');
  assert.equal(calls, 2);
});

test('in-cluster KV value expires when its TTL elapses', async () => {
  const clock = { t: 1_000 };
  const local = new MemoryKv(() => clock.t);
  const cf = recordingKv();
  await guardKvBinding(cf, local, guardReturning('over', () => clock.t)).put('ephemeral', '1', {
    expirationTtl: 60,
  });
  assert.equal(await local.get('ephemeral'), '1');
  clock.t += 60_000;
  assert.equal(await local.get('ephemeral'), null);
  assert.deepEqual(cf.puts, []);
});

test('KV TTL is clamped into the free-plan window', () => {
  assert.equal(resolveCfTtlSeconds(undefined), CF_CACHED_TTL_SECONDS);
  assert.equal(resolveCfTtlSeconds(10), CF_KV_MIN_TTL_SECONDS);
  assert.equal(resolveCfTtlSeconds(120), 120);
  assert.equal(resolveCfTtlSeconds(10_000_000), CF_MAX_TTL_SECONDS);
});

test('a too-long TTL is stored at the cap', async () => {
  const cf = recordingKv();
  await guardKvBinding(cf, new MemoryKv(), guardReturning('ok')).put('k', 'v', {
    expirationTtl: 10_000_000,
  });
  assert.equal(cf.puts[0]?.ttl, CF_MAX_TTL_SECONDS);
});

test('omitted TTL uses the cached-data TTL', async () => {
  const cf = recordingKv();
  await guardKvBinding(cf, new MemoryKv(), guardReturning('ok')).put('k', 'v');
  assert.equal(cf.puts[0]?.ttl, CF_CACHED_TTL_SECONDS);
});

test('audit retention days clamp at the named cap', () => {
  assert.equal(clampAuditRetentionDays(30), CF_D1_AUDIT_RETENTION_DAYS);
  assert.equal(clampAuditRetentionDays(3), 3);
  assert.equal(clampAuditRetentionDays(Number.NaN), CF_D1_AUDIT_RETENTION_DAYS);
});

test('edge AI stays off when the KV flag is closed', () => {
  assert.equal(edgeAiAllowed(true, true), true);
  assert.equal(edgeAiAllowed(false, true), false);
  assert.equal(edgeAiAllowed(true, false), false);
});

test('KV delete is a write and falls back when the flag is over', async () => {
  const cf = recordingKv();
  const local = new MemoryKv(() => 0);
  await local.put('k', 'v');
  await guardKvBinding(cf, local, guardReturning('over')).delete('k');
  assert.deepEqual(cf.deletes, []);
  assert.equal(await local.get('k'), null);
});

test('KVCache put uses the guard and falls back when quota:kv is over', async () => {
  const cf = recordingKv();
  const local = new MemoryKv(() => 0);
  const cache = new KVCache(guardKvBinding(cf, local, guardReturning('over')));
  await cache.put('session', 'abc', 120);
  assert.deepEqual(cf.puts, []);
  assert.equal(await local.get('session'), 'abc');
});

test('D1Storage.logAudit uses the guard and falls back when quota:d1 is over', async () => {
  const cf = recordingD1();
  const local = new MemoryD1();
  const db = new D1Storage(guardD1Binding(cf, local, guardReturning('over')));
  await db.logAudit(auditEntry);
  assert.deepEqual(cf.runs, []);
  assert.equal(local.writes.length, 1);
});

test('D1Storage.logAudit writes to D1 when the flag is ok, then falls back after the TTL', async () => {
  const clock = { t: 0 };
  let flag: string = 'ok';
  const guard = new CfQuotaGuard(async () => flag, () => clock.t, 60_000);
  const cf = recordingD1();
  const local = new MemoryD1();
  const db = new D1Storage(guardD1Binding(cf, local, guard));
  await db.logAudit(auditEntry);
  assert.equal(cf.runs.length, 1);
  flag = 'over';
  clock.t = 59_999;
  await db.logAudit(auditEntry);
  assert.equal(cf.runs.length, 2);
  clock.t = 60_000;
  await db.logAudit(auditEntry);
  assert.equal(cf.runs.length, 2);
  assert.equal(local.writes.length, 1);
});

test('flag cache TTL config stays inside 1s to 300s', () => {
  assert.equal(quotaFlagCacheTtlMs(undefined), 60_000);
  assert.equal(quotaFlagCacheTtlMs('nope'), 60_000);
  assert.equal(quotaFlagCacheTtlMs('0'), 1_000);
  assert.equal(quotaFlagCacheTtlMs('120000'), 120_000);
  assert.equal(quotaFlagCacheTtlMs('999999'), 300_000);
});

test('openStorage keeps D1 and KV closed for over, missing, and error flags', async () => {
  for (const flag of ['over', null, 'throw'] as const) {
    const cfDb = recordingD1();
    const cfKv = recordingKv();
    const env = { DB: cfDb, CACHE: cfKv } as Env;
    const opened = await openStorage({
      env,
      processEnv: {},
      guard: guardReturning(flag),
    });
    assert.equal(opened.db instanceof MemoryStorage, true, String(flag));
    assert.equal(opened.cache instanceof MemoryCache, true, String(flag));
    assert.equal(opened.annotationDb, undefined);
    await opened.db.logAudit(auditEntry);
    await opened.cache.put('k', 'v', 60);
    assert.deepEqual(cfDb.runs, []);
    assert.deepEqual(cfKv.puts, []);
  }
});

test('openStorage uses D1 and KV when both flags are ok', async () => {
  const cfDb = recordingD1();
  const cfKv = recordingKv();
  const env = { DB: cfDb, CACHE: cfKv } as Env;
  const guard = new CfQuotaGuard(async (key) => (key === 'quota:d1' || key === 'quota:kv' ? 'ok' : null));
  const opened = await openStorage({ env, processEnv: {}, guard });
  assert.equal(opened.db instanceof D1Storage, true);
  assert.equal(opened.cache instanceof KVCache, true);
  assert.ok(opened.annotationDb);
  await opened.db.logAudit(auditEntry);
  await opened.cache.put('k', 'v', 120);
  assert.equal(cfDb.runs.length, 1);
  assert.equal(cfKv.puts.length, 1);
  assert.equal(cfKv.puts[0]?.ttl, 120);
});

test('sqlite storage ignores a D1 binding even when the flag is ok', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'quill-quota-'));
  const file = join(dir, 'quill.sqlite');
  const cfDb = recordingD1();
  try {
    const opened = await openStorage({
      env: { DB: cfDb, CACHE: recordingKv() } as Env,
      processEnv: { QUILL_STORAGE: 'sqlite', QUILL_DB_PATH: file },
      guard: guardReturning('ok'),
    });
    assert.equal(opened.db instanceof NodeSqliteStorage, true);
    await opened.db.logAudit(auditEntry);
    assert.deepEqual(cfDb.runs, []);
    assert.equal(opened.annotationDb, undefined);
    (opened.db as NodeSqliteStorage).close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('reader prefers the QUOTA_FLAGS binding and does not call the REST API', async () => {
  let fetches = 0;
  const reader = readerFromEnvironment(
    { QUOTA_FLAGS: { async get() { return 'over'; } } },
    {
      CF_QUOTA_KV_ACCOUNT_ID: 'not-used',
      CF_QUOTA_KV_NAMESPACE_ID: 'not-used',
      CF_QUOTA_KV_API_TOKEN: 'not-used',
    },
    async () => {
      fetches += 1;
      return new Response('ok');
    },
  );
  assert.equal(await reader('quota:kv'), 'over');
  assert.equal(fetches, 0);
});

test('REST flag reader maps 200, 404, and errors without echoing the token', async () => {
  const seen: Array<{ url: string; auth: string | null }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    seen.push({ url: String(input), auth: headers.get('authorization') });
    const url = String(input);
    if (url.endsWith('quota%3Akv')) return new Response('ok\n', { status: 200 });
    if (url.endsWith('quota%3Ad1')) return new Response('', { status: 404 });
    return new Response('no', { status: 500 });
  };
  const reader = cloudflareKvFlagReader({
    accountId: 'acct-test',
    namespaceId: 'ns-test',
    apiToken: 'token-test',
    fetchImpl,
  });
  assert.equal(await reader('quota:kv'), 'ok\n');
  assert.equal(await reader('quota:d1'), null);
  await assert.rejects(() => reader('quota:r2'), /quota flag read failed/);
  assert.equal(seen[0]?.auth, 'Bearer token-test');
  assert.equal(seen[0]?.url.includes('acct-test'), true);
  assert.equal(seen[0]?.url.includes('token-test'), false);
});

test('missing REST config makes the flag unreadable', async () => {
  const reader = readerFromEnvironment({}, {
    CF_QUOTA_KV_ACCOUNT_ID: '',
    CF_QUOTA_KV_NAMESPACE_ID: 'ns',
    CF_QUOTA_KV_API_TOKEN: 'token',
  });
  await assert.rejects(() => reader('quota:kv'), /quota flag unreadable/);
});
