// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Cloudflare free-tier data guard.
 *
 * Infra writes a Workers KV key `quota:<service>` (`service` is `d1`, `kv`,
 * or `r2`). The value is `ok` or `over`. Every Cloudflare data write in this
 * repo reads that flag before it writes. The read is cached for a short TTL
 * so a write does not become a KV read.
 *
 * `over`, a missing key, an unknown value, and a failed read all fail closed
 * onto the in-cluster store (SQLite on the API PVC, Redis, or the in-process
 * memory store). A write never falls open onto Cloudflare.
 *
 * No Workers Paid API is used. KV `get` / `put` with `expirationTtl`, D1
 * prepared statements, and the KV REST read of the flag are free-plan calls.
 */

export type CfService = 'd1' | 'kv' | 'r2';

/** Parsed flag. Only `ok` may write to Cloudflare. */
export type QuotaFlag = 'ok' | 'over' | 'missing' | 'error';

export type QuotaFlagReader = (key: string) => Promise<string | null>;

/**
 * How long a successful or failed flag read is reused.
 * One minute keeps a busy isolate near 3 flag reads per minute
 * (one per service), inside the KV free-plan read budget
 * (100,000 reads/day).
 */
export const QUOTA_FLAG_CACHE_TTL_MS = 60_000;

/** Floor for `CF_QUOTA_FLAG_TTL_MS`. A zero TTL would read KV on every write. */
export const QUOTA_FLAG_CACHE_TTL_MIN_MS = 1_000;

/** Ceiling. A long cache would keep writing to Cloudflare after Infra marks `over`. */
export const QUOTA_FLAG_CACHE_TTL_MAX_MS = 300_000;

/**
 * D1 free plan stores 5 GB and writes 100,000 rows/day.
 * A D1 row cannot exceed 2 MiB. 32 KiB is far under both.
 */
export const CF_D1_MAX_ROW_BYTES = 32 * 1024;

/**
 * KV free plan stores 1 GB, writes 1,000 times/day, and allows a 25 MiB value.
 * 32 KiB is far under the value cap and cannot fill the namespace quickly.
 */
export const CF_KV_MAX_VALUE_BYTES = 32 * 1024;

/**
 * R2 free plan includes 10 GB-month and 1,000,000 Class A operations/month.
 * Quill has no R2 writer yet. 1 MiB is the cap the first writer must use.
 */
export const CF_R2_MAX_OBJECT_BYTES = 1024 * 1024;

/**
 * KV rejects `expirationTtl` below 60 seconds. That is a free-plan rule.
 * Every KV write uses a TTL so a key cannot live forever in the 1 GB namespace.
 */
export const CF_KV_MIN_TTL_SECONDS = 60;

/**
 * Default TTL for cached values (API cache, edge HTTP cache keys).
 * One hour. Callers that omit a TTL get this, not an immortal key.
 */
export const CF_CACHED_TTL_SECONDS = 60 * 60;

/**
 * Hard ceiling for any TTL we send to KV.
 * 48 hours matches the neuron-counter key (`neurons:YYYY-MM-DD`), which must
 * outlive the UTC day it counts. A shorter TTL would reset the counter and
 * allow extra Workers AI calls. Nothing is stored longer than this.
 */
export const CF_MAX_TTL_SECONDS = 172_800;

/** Neuron counter TTL. Same as `CF_MAX_TTL_SECONDS`. See that comment. */
export const CF_NEURON_COUNTER_TTL_SECONDS = CF_MAX_TTL_SECONDS;

/**
 * Raw D1 audit rows. D1 has no row TTL. The daily retention job deletes
 * rows older than this. Seven days stays well inside the 5 GB free database.
 * Config may ask for more. This cap wins.
 */
export const CF_D1_AUDIT_RETENTION_DAYS = 7;

const textEncoder = new TextEncoder();

export function utf8Bytes(value: string): number {
  return textEncoder.encode(value).length;
}

export function d1PayloadBytes(sql: string, params: readonly unknown[]): number {
  try {
    const encoded = JSON.stringify(params);
    return utf8Bytes(sql) + utf8Bytes(encoded);
  } catch {
    return CF_D1_MAX_ROW_BYTES + 1;
  }
}

export function maxBytesFor(service: CfService): number {
  if (service === 'd1') return CF_D1_MAX_ROW_BYTES;
  if (service === 'kv') return CF_KV_MAX_VALUE_BYTES;
  return CF_R2_MAX_OBJECT_BYTES;
}

export function quotaFlagCacheTtlMs(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return QUOTA_FLAG_CACHE_TTL_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return QUOTA_FLAG_CACHE_TTL_MS;
  return Math.min(
    QUOTA_FLAG_CACHE_TTL_MAX_MS,
    Math.max(QUOTA_FLAG_CACHE_TTL_MIN_MS, Math.floor(parsed)),
  );
}

export function resolveCfTtlSeconds(requested: number | undefined): number {
  if (requested === undefined || !Number.isFinite(requested)) return CF_CACHED_TTL_SECONDS;
  return Math.min(CF_MAX_TTL_SECONDS, Math.max(CF_KV_MIN_TTL_SECONDS, Math.floor(requested)));
}

export function clampAuditRetentionDays(requested: number): number {
  if (!Number.isFinite(requested) || requested < 1) return CF_D1_AUDIT_RETENTION_DAYS;
  return Math.min(CF_D1_AUDIT_RETENTION_DAYS, Math.floor(requested));
}

/**
 * Workers AI is allowed only when the KV flag is `ok` and the daily counter
 * is under the cap. An uncounted call can pass the free neuron allotment,
 * because the counter is the only brake. When KV is closed, stay on the homelab.
 */
export function edgeAiAllowed(kvOpen: boolean, withinBudget: boolean): boolean {
  return kvOpen && withinBudget;
}

export class CfSizeCapError extends Error {
  readonly service: CfService;
  readonly bytes: number;
  readonly maxBytes: number;

  constructor(service: CfService, bytes: number, maxBytes: number) {
    super(`CF ${service} write is ${bytes} bytes, over the ${maxBytes} byte cap`);
    this.name = 'CfSizeCapError';
    this.service = service;
    this.bytes = bytes;
    this.maxBytes = maxBytes;
  }
}

export function quotaKey(service: CfService): string {
  return `quota:${service}`;
}

function parseFlag(raw: string | null): QuotaFlag {
  if (raw === null) return 'missing';
  const value = raw.trim();
  if (value === 'ok') return 'ok';
  if (value === 'over') return 'over';
  return 'missing';
}

export class CfQuotaGuard {
  private readonly cache = new Map<CfService, { flag: QuotaFlag; expiresAt: number }>();

  constructor(
    private reader: QuotaFlagReader,
    private readonly now: () => number = Date.now,
    private readonly ttlMs: number = QUOTA_FLAG_CACHE_TTL_MS,
  ) {}

  setReader(reader: QuotaFlagReader): void {
    this.reader = reader;
  }

  async flag(service: CfService): Promise<QuotaFlag> {
    const hit = this.cache.get(service);
    if (hit && this.now() < hit.expiresAt) return hit.flag;

    let flag: QuotaFlag;
    try {
      flag = parseFlag(await this.reader(quotaKey(service)));
    } catch {
      flag = 'error';
    }
    this.cache.set(service, { flag, expiresAt: this.now() + this.ttlMs });
    return flag;
  }

  async allows(service: CfService): Promise<boolean> {
    return (await this.flag(service)) === 'ok';
  }
}

export interface CfKvLike {
  get(key: string, options?: { type?: string }): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface CfD1Statement {
  bind(...params: unknown[]): CfD1Statement;
  run(): Promise<{ meta: Record<string, unknown> }>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}

/** What D1Storage and the test doubles expose: prepare then bind. */
export interface CfD1Like {
  prepare(sql: string): {
    bind(...params: unknown[]): {
      run(): Promise<{ meta: Record<string, unknown> }>;
      all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
      first<T = Record<string, unknown>>(): Promise<T | null>;
    };
  };
}

export interface CfR2Like {
  put(key: string, body: Uint8Array | string): Promise<unknown>;
}

export interface GuardedWrite {
  service: CfService;
  bytes: number;
  guard: CfQuotaGuard;
  writeCloudflare: () => Promise<unknown>;
  writeInCluster: () => Promise<unknown>;
}

/**
 * Write to Cloudflare only when the cached flag is `ok` and the payload is
 * under the service cap. Otherwise write to the in-cluster store.
 * A Cloudflare write that throws also falls back. The cap throws before
 * either store is touched.
 */
export async function guardedWrite(args: GuardedWrite): Promise<'cloudflare' | 'in-cluster'> {
  const maxBytes = maxBytesFor(args.service);
  if (args.bytes > maxBytes) {
    throw new CfSizeCapError(args.service, args.bytes, maxBytes);
  }
  const open = await args.guard.allows(args.service);
  if (!open) {
    await args.writeInCluster();
    return 'in-cluster';
  }
  try {
    await args.writeCloudflare();
    return 'cloudflare';
  } catch {
    await args.writeInCluster();
    return 'in-cluster';
  }
}

export function guardKvBinding(cf: CfKvLike, fallback: CfKvLike, guard: CfQuotaGuard): CfKvLike {
  return {
    async get(key, options) {
      const target = (await guard.allows('kv')) ? cf : fallback;
      return target.get(key, options);
    },
    async put(key, value, options) {
      const ttl = resolveCfTtlSeconds(options?.expirationTtl);
      await guardedWrite({
        service: 'kv',
        bytes: utf8Bytes(key) + utf8Bytes(value),
        guard,
        writeCloudflare: () => cf.put(key, value, { expirationTtl: ttl }),
        writeInCluster: () => fallback.put(key, value, { expirationTtl: ttl }),
      });
    },
    async delete(key) {
      await guardedWrite({
        service: 'kv',
        bytes: utf8Bytes(key),
        guard,
        writeCloudflare: () => cf.delete(key),
        writeInCluster: () => fallback.delete(key),
      });
    },
  };
}

export function guardD1Binding(
  cf: CfD1Like,
  fallback: CfD1Like,
  guard: CfQuotaGuard,
): { prepare(sql: string): CfD1Statement } {
  const statementFor = (sql: string, params: unknown[]): CfD1Statement => {
    const bytes = d1PayloadBytes(sql, params);
    const runOn = (target: CfD1Like) => target.prepare(sql).bind(...params);
    return {
      bind(...next: unknown[]) {
        return statementFor(sql, next);
      },
      async run() {
        const dest = await chooseD1(guard, bytes);
        if (dest === 'cloudflare') {
          try {
            return await runOn(cf).run();
          } catch {
            return runOn(fallback).run();
          }
        }
        return runOn(fallback).run();
      },
      async all<T = Record<string, unknown>>() {
        const dest = await chooseD1(guard, bytes);
        return (dest === 'cloudflare' ? runOn(cf) : runOn(fallback)).all<T>();
      },
      async first<T = Record<string, unknown>>() {
        const dest = await chooseD1(guard, bytes);
        return (dest === 'cloudflare' ? runOn(cf) : runOn(fallback)).first<T>();
      },
    };
  };
  return {
    prepare(sql: string) {
      return statementFor(sql, []);
    },
  };
}

async function chooseD1(guard: CfQuotaGuard, bytes: number): Promise<'cloudflare' | 'in-cluster'> {
  if (bytes > CF_D1_MAX_ROW_BYTES) {
    throw new CfSizeCapError('d1', bytes, CF_D1_MAX_ROW_BYTES);
  }
  try {
    return (await guard.allows('d1')) ? 'cloudflare' : 'in-cluster';
  } catch {
    return 'in-cluster';
  }
}

/** R2 plumbing. No production caller writes R2 yet. The first one must use this. */
export async function putR2(args: {
  cf: CfR2Like;
  fallback: CfR2Like;
  guard: CfQuotaGuard;
  key: string;
  body: Uint8Array | string;
}): Promise<'cloudflare' | 'in-cluster'> {
  const bodyBytes = typeof args.body === 'string' ? utf8Bytes(args.body) : args.body.byteLength;
  return guardedWrite({
    service: 'r2',
    bytes: utf8Bytes(args.key) + bodyBytes,
    guard: args.guard,
    writeCloudflare: () => args.cf.put(args.key, args.body),
    writeInCluster: () => args.fallback.put(args.key, args.body),
  });
}

/**
 * In-process KV used when Cloudflare is closed.
 * The edge isolate has no PVC. The API process uses SQLite or Redis when
 * those are configured, and this map when they are not.
 */
export class MemoryKv implements CfKvLike {
  private readonly rows = new Map<string, { value: string; expiresAt: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  async get(key: string, options?: { type?: string }): Promise<string | null> {
    const row = this.rows.get(key);
    if (!row) return null;
    if (this.now() >= row.expiresAt) {
      this.rows.delete(key);
      return null;
    }
    if (options?.type === 'json') {
      return JSON.parse(row.value);
    }
    return row.value;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    const ttl = resolveCfTtlSeconds(options?.expirationTtl);
    this.rows.set(key, { value, expiresAt: this.now() + ttl * 1000 });
  }

  async delete(key: string): Promise<void> {
    this.rows.delete(key);
  }
}

/** In-process D1 stand-in. Writes are kept. Reads return empty. */
export class MemoryD1 implements CfD1Like {
  readonly writes: Array<{ sql: string; params: unknown[] }> = [];

  prepare(sql: string) {
    return {
      bind: (...params: unknown[]) => ({
        run: async () => {
          this.writes.push({ sql, params });
          return { meta: { changes: 1 } };
        },
        all: async <T = Record<string, unknown>>() => ({ results: [] as T[] }),
        first: async <T = Record<string, unknown>>() => null as T | null,
      }),
    };
  }
}

let sharedGuard: CfQuotaGuard | undefined;
let sharedKv: MemoryKv | undefined;
let sharedD1: MemoryD1 | undefined;

export function sharedMemoryKv(): MemoryKv {
  if (!sharedKv) sharedKv = new MemoryKv();
  return sharedKv;
}

export function sharedMemoryD1(): MemoryD1 {
  if (!sharedD1) sharedD1 = new MemoryD1();
  return sharedD1;
}

export function bindSharedQuotaGuard(
  reader: QuotaFlagReader,
  options?: { now?: () => number; ttlMs?: number },
): CfQuotaGuard {
  if (!sharedGuard) {
    sharedGuard = new CfQuotaGuard(
      reader,
      options?.now ?? Date.now,
      options?.ttlMs ?? QUOTA_FLAG_CACHE_TTL_MS,
    );
  } else {
    sharedGuard.setReader(reader);
  }
  return sharedGuard;
}

export function resetCfQuotaForTests(): void {
  sharedGuard = undefined;
  sharedKv = undefined;
  sharedD1 = undefined;
}

export interface QuotaEnv {
  QUOTA_FLAGS?: { get(key: string): Promise<string | null> };
  CF_QUOTA_FLAG_TTL_MS?: string;
}

/**
 * Prefer the Workers `QUOTA_FLAGS` binding. Else, if the operator set all
 * three env vars, read the key with the free KV REST API. Else the flag is
 * unreadable and writers stay in-cluster. Account id and token are never
 * logged and are not given defaults.
 */
export function readerFromEnvironment(
  env: QuotaEnv,
  processEnv: Record<string, string | undefined> = {},
  fetchImpl: typeof fetch = fetch,
): QuotaFlagReader {
  const flags = env.QUOTA_FLAGS;
  if (flags) return (key) => flags.get(key);
  const accountId = processEnv.CF_QUOTA_KV_ACCOUNT_ID ?? '';
  const namespaceId = processEnv.CF_QUOTA_KV_NAMESPACE_ID ?? '';
  const apiToken = processEnv.CF_QUOTA_KV_API_TOKEN ?? '';
  if (accountId !== '' && namespaceId !== '' && apiToken !== '') {
    return cloudflareKvFlagReader({ accountId, namespaceId, apiToken, fetchImpl });
  }
  return async () => {
    throw new Error('quota flag unreadable');
  };
}

export function cloudflareKvFlagReader(args: {
  accountId: string;
  namespaceId: string;
  apiToken: string;
  fetchImpl?: typeof fetch;
}): QuotaFlagReader {
  const fetchImpl = args.fetchImpl ?? fetch;
  return async (key) => {
    const url =
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(args.accountId)}` +
      `/storage/kv/namespaces/${encodeURIComponent(args.namespaceId)}` +
      `/values/${encodeURIComponent(key)}`;
    try {
      const resp = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${args.apiToken}` },
        signal: AbortSignal.timeout(2_000),
      });
      if (resp.status === 404) return null;
      if (!resp.ok) throw new Error('quota flag read failed');
      return await resp.text();
    } catch (err) {
      if (err instanceof Error && err.message === 'quota flag read failed') throw err;
      // The transport error can quote the request URL. Keep the account id out of logs.
      if (err instanceof Error) err.message = 'quota flag transport failure';
      throw new Error('quota flag read failed', { cause: err });
    }
  };
}

export function guardForEnv(
  env: QuotaEnv,
  processEnv?: Record<string, string | undefined>,
  fetchImpl?: typeof fetch,
): CfQuotaGuard {
  return bindSharedQuotaGuard(readerFromEnvironment(env, processEnv, fetchImpl), {
    ttlMs: quotaFlagCacheTtlMs(env.CF_QUOTA_FLAG_TTL_MS ?? processEnv?.CF_QUOTA_FLAG_TTL_MS),
  });
}
