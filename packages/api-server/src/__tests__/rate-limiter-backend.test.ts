/**
 * Gate A2-REDIS (#764, #770) — the rate limiter must always enforce.
 *
 * Before this change the limiter dialled a hardcoded phantom endpoint
 * (`redis://redis.ai-inference:6379`, a namespace that never existed) and
 * returned null — "allow the request, do not enforce" — whenever Redis was
 * unreachable. A missing Redis therefore meant an unlimited API, and the logs
 * filled with connection errors.
 *
 * These tests pin the repaired contract:
 *   1. the endpoint comes from configuration only — no host literal in source;
 *   2. "no Redis configured" selects the in-process window, not pass-through;
 *   3. that window blocks at the tier limit and rolls over after the window;
 *   4. the Redis result mapping (allowed / remaining / reset / retryAfter);
 *   5. a Redis that dies mid-flight still enforces (regression for the
 *      incident class: "Redis down ⇒ unlimited").
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RateLimiter,
  TIER_LIMITS,
  WINDOW_SECONDS,
  type RedisLikeClient,
} from '../middleware/rate-limiter.js';
import { resolveRedisUrl, redisHostOf } from '../cache/redis-url.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** Resolve a module's source, whether tests run from src/ or dist/. */
function sourcePath(relative: string): string {
  const ts = resolve(__dirname, relative.replace(/\.js$/, '.ts'));
  if (existsSync(ts)) return ts;
  const js = resolve(__dirname, relative.replace(/\.ts$/, '.js'));
  return js;
}

function readSource(relative: string): string {
  return readFileSync(sourcePath(relative), 'utf8');
}

/** Per-IP key so separate tests never share a window. */
let ipCounter = 0;
function uniqueIp(): string {
  ipCounter += 1;
  return `10.0.0.${ipCounter}`;
}

/** Minimal Redis stand-in that records the eval call and emits events. */
class FakeRedis implements RedisLikeClient {
  readonly calls: { script: string; args: (string | number)[] }[] = [];
  connectCalls = 0;
  /** When true, connect() rejects — a Redis that is not up yet. */
  failConnect = false;

  private handlers = new Map<string, ((...args: any[]) => void)[]>();

  constructor(private readonly reply: unknown, private readonly fail = false) {}

  async connect(): Promise<void> {
    this.connectCalls += 1;
    if (this.failConnect) throw new Error('connect ECONNREFUSED (simulated)');
  }

  on(event: string, listener: (...args: any[]) => void): unknown {
    const list = this.handlers.get(event) ?? [];
    list.push(listener);
    this.handlers.set(event, list);
    return this;
  }

  /** Drive the limiter the way ioredis would. */
  emit(event: string, ...args: unknown[]): void {
    for (const listener of this.handlers.get(event) ?? []) {
      listener(...args);
    }
  }

  async eval(script: string, _numKeys: number, ...args: (string | number)[]): Promise<unknown> {
    this.calls.push({ script, args });
    if (this.fail) throw new Error('redis eval failed (simulated)');
    return this.reply;
  }

  async quit(): Promise<unknown> {
    return 'OK';
  }

  disconnect(): void {}
}

describe('resolveRedisUrl (A2-REDIS)', () => {
  it('returns the URL from the environment when set', () => {
    assert.equal(
      resolveRedisUrl(undefined, { REDIS_URL: 'redis://quill-redis:6379' }),
      'redis://quill-redis:6379',
    );
  });

  it('returns null when REDIS_URL is unset — never a guessed endpoint', () => {
    assert.equal(resolveRedisUrl(undefined, {}), null);
  });

  it('treats a blank REDIS_URL as "not configured"', () => {
    assert.equal(resolveRedisUrl(undefined, { REDIS_URL: '   ' }), null);
  });

  it('lets an explicit argument win over the environment', () => {
    assert.equal(
      resolveRedisUrl('redis://other:6380', { REDIS_URL: 'redis://quill-redis:6379' }),
      'redis://other:6380',
    );
  });

  it('treats an explicit empty string as "no Redis here"', () => {
    assert.equal(resolveRedisUrl('', { REDIS_URL: 'redis://quill-redis:6379' }), null);
  });

  it('redisHostOf reports host:port and never leaks credentials', () => {
    assert.equal(redisHostOf('redis://user:secret@quill-redis:6379'), 'quill-redis:6379');
  });
});

describe('no phantom Redis endpoint in source (A2-REDIS regression)', () => {
  const modules = ['../cache/redis.ts', '../cache/redis-url.ts', '../middleware/rate-limiter.ts'];

  it('no executable line hardcodes a redis:// host', () => {
    const offenders: string[] = [];

    for (const mod of modules) {
      const lines = readSource(mod).split('\n');
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        const isComment =
          trimmed.startsWith('*') ||
          trimmed.startsWith('//') ||
          trimmed.startsWith('/*') ||
          trimmed.startsWith('#');
        if (!isComment && /redis:\/\//.test(line)) {
          offenders.push(`${mod}:${index + 1}: ${trimmed}`);
        }
      });
    }

    assert.deepEqual(
      offenders,
      [],
      `redis endpoint literals must come from configuration:\n${offenders.join('\n')}`,
    );
  });
});

describe('RateLimiter — in-process window when Redis is not configured', () => {
  it('reports the memory backend and does not pretend to be connected', async () => {
    const rl = new RateLimiter();
    await rl.init('');

    assert.equal(rl.backendMode(), 'memory');
    assert.equal(rl.isConnected(), false);
  });

  it('always returns a decision — never null/pass-through', async () => {
    const rl = new RateLimiter();
    await rl.init('');

    const result = await rl.check(uniqueIp(), 'FREE');
    assert.ok(result !== null);
    assert.equal(result.allowed, true);
    assert.equal(result.limit, TIER_LIMITS.FREE);
    assert.equal(result.remaining, TIER_LIMITS.FREE - 1);
  });

  it('blocks the request after the tier limit is reached', async () => {
    const rl = new RateLimiter();
    await rl.init('');
    const ip = uniqueIp();
    const limit = TIER_LIMITS.FREE;

    for (let i = 0; i < limit; i++) {
      const allowed = await rl.check(ip, 'FREE');
      assert.equal(allowed.allowed, true, `request ${i + 1} of ${limit} must be allowed`);
    }

    const blocked = await rl.check(ip, 'FREE');
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.remaining, 0);
    assert.ok(blocked.retryAfter >= 0 && blocked.retryAfter <= WINDOW_SECONDS);
    assert.ok(blocked.resetTime >= Math.floor(Date.now() / 1000));
  });

  it('keeps tiers independent', async () => {
    const rl = new RateLimiter();
    await rl.init('');
    const ip = uniqueIp();

    for (let i = 0; i < TIER_LIMITS.FREE; i++) {
      await rl.check(ip, 'FREE');
    }
    assert.equal((await rl.check(ip, 'FREE')).allowed, false);
    // A BASIC caller from the same IP still has room.
    assert.equal((await rl.check(ip, 'BASIC')).allowed, true);
  });

  it('rolls the window over once entries age out', async () => {
    const rl = new RateLimiter();
    await rl.init('');
    const ip = uniqueIp();
    const t0 = 1_700_000_000_000;
    const limit = TIER_LIMITS.FREE;

    for (let i = 0; i < limit; i++) {
      assert.equal((await rl.check(ip, 'FREE', t0)).allowed, true);
    }
    assert.equal((await rl.check(ip, 'FREE', t0)).allowed, false);

    // One second before the window closes: still blocked.
    assert.equal((await rl.check(ip, 'FREE', t0 + WINDOW_SECONDS * 1000 - 1_000)).allowed, false);
    // Past the window: the counter is empty again.
    assert.equal((await rl.check(ip, 'FREE', t0 + WINDOW_SECONDS * 1000 + 1)).allowed, true);
  });
});

describe('RateLimiter — Redis result mapping', () => {
  it('maps an allowed Lua reply to headers-ready fields', async () => {
    const now = 1_700_000_000;
    const fake = new FakeRedis([1, 3, now + WINDOW_SECONDS]);
    const rl = new RateLimiter(fake);
    await rl.init('redis://quill-redis:6379');

    assert.equal(rl.backendMode(), 'redis');
    assert.equal(rl.isConnected(), true);

    const result = await rl.check('203.0.113.7', 'FREE', now * 1000);
    assert.equal(result.allowed, true);
    assert.equal(result.limit, TIER_LIMITS.FREE);
    assert.equal(result.remaining, TIER_LIMITS.FREE - 3);
    assert.equal(result.resetTime, now + WINDOW_SECONDS);
    assert.equal(result.retryAfter, WINDOW_SECONDS);

    // The atomic call must target the namespaced key with (limit, window, now).
    assert.equal(fake.calls.length, 1);
    assert.deepEqual(fake.calls[0].args, [
      `ratelimit:FREE:203.0.113.7`,
      String(TIER_LIMITS.FREE),
      String(WINDOW_SECONDS),
      String(now),
    ]);
    assert.match(fake.calls[0].script, /ZREMRANGEBYSCORE/);
  });

  it('maps a denied Lua reply to a 429-shaped result', async () => {
    const now = 1_700_000_500;
    const fake = new FakeRedis([0, TIER_LIMITS.FREE, now + 30]);
    const rl = new RateLimiter(fake);
    await rl.init('redis://quill-redis:6379');

    const result = await rl.check('203.0.113.8', 'FREE', now * 1000);
    assert.equal(result.allowed, false);
    assert.equal(result.remaining, 0);
    assert.equal(result.resetTime, now + 30);
    assert.equal(result.retryAfter, 30);
  });

  it('still enforces when Redis fails mid-flight (no pass-through)', async () => {
    const fake = new FakeRedis(null, true);
    const rl = new RateLimiter(fake);
    await rl.init('redis://quill-redis:6379');

    const ip = uniqueIp();
    let blocked = 0;
    for (let i = 0; i < TIER_LIMITS.FREE + 1; i++) {
      const result = await rl.check(ip, 'FREE');
      if (!result.allowed) blocked += 1;
    }

    assert.equal(blocked, 1, 'the (limit + 1)-th request must be blocked even with Redis down');
  });
});

describe('RateLimiter — recovery after a failed start (A2-REDIS regression)', () => {
  it('keeps reconnecting: a Redis that was down does not leave the limiter degraded', async () => {
    const now = 1_700_000_000;
    const fake = new FakeRedis([1, 1, now + WINDOW_SECONDS]);
    fake.failConnect = true;

    const rl = new RateLimiter(fake);
    await rl.init('redis://quill-redis:6379');

    // Not connected — but enforcing, not passing requests through.
    assert.equal(rl.isConnected(), false);
    assert.equal(rl.backendMode(), 'memory');
    const ip = uniqueIp();
    assert.equal((await rl.check(ip, 'FREE')).allowed, true);
    assert.equal(fake.calls.length, 0, 'no evals while the connection is down');

    // Redis answers later (the pod lost the start-up race, or it restarted).
    fake.emit('ready');
    assert.equal(rl.isConnected(), true);
    assert.equal(rl.backendMode(), 'redis');

    await rl.check(ip, 'FREE', now * 1000);
    assert.equal(fake.calls.length, 1, 'the cluster-wide counter takes over again');
    assert.equal(fake.calls[0].args[0], `ratelimit:FREE:${ip}`);
  });

  it('drops back to the in-process window when the connection closes', async () => {
    const fake = new FakeRedis([1, 1, 1_700_000_060]);

    const rl = new RateLimiter(fake);
    await rl.init('redis://quill-redis:6379');
    fake.emit('ready');
    assert.equal(rl.backendMode(), 'redis');

    fake.emit('close');
    assert.equal(rl.isConnected(), false);
    assert.equal(rl.backendMode(), 'memory');
    // Still a decision, never a pass-through null.
    assert.ok((await rl.check(uniqueIp(), 'FREE')) !== null);
  });
});
