/**
 * Redis cache-hit responses must carry the same CORS and security headers
 * as a cache miss. A hit used to answer with only Content-Type and
 * X-Cache-Status, so the portal /status page failed its /v1/health fetch
 * whenever the response was served from Redis.
 *
 * The listener has no 304 path. OPTIONS preflight, the rate-limit 429, and
 * the server-error 500 are covered here because each one used to return
 * before the normal header writer.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';

import { handleRequest } from '../index.js';
import { MemoryCache, MemoryStorage } from '../storage.js';
import {
  createNodeRequestListener,
  type NodeRateLimiter,
  type NodeRequestHandler,
  type ResponseCache,
} from '../node-listener.js';

const ORIGIN = 'https://quill.maplespike.ca';

const EDGE_HEADERS = [
  'access-control-allow-origin',
  'access-control-allow-methods',
  'access-control-allow-headers',
  'access-control-expose-headers',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'permissions-policy',
  'cache-control',
  'pragma',
  'content-security-policy',
  'strict-transport-security',
] as const;

const env = {
  JWT_SECRET: 'test-jwt-secret-for-cache-header-regression-0123456789abcdef',
  ENVIRONMENT: 'production',
  QUILL_VERSION: '0.1.0',
  QUILL_NAME: 'Quill',
};

function memoryResponseCache(): ResponseCache {
  const store = new Map<string, unknown>();
  return {
    async get<T = string>(key: string): Promise<T | null> {
      if (!store.has(key)) return null;
      return store.get(key) as T;
    },
    async set(key: string, value: unknown): Promise<void> {
      store.set(key, value);
    },
  };
}

function limiter(allowed: boolean): NodeRateLimiter {
  return {
    extractIP: () => '127.0.0.1',
    extractTier: () => 'FREE',
    async check() {
      return {
        allowed,
        limit: 100,
        remaining: allowed ? 99 : 0,
        resetTime: 1_700_000_000,
        retryAfter: allowed ? 0 : 30,
      };
    },
  };
}

function edgeOf(res: Response): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const name of EDGE_HEADERS) out[name] = res.headers.get(name);
  return out;
}

async function listen(handler: http.RequestListener): Promise<{ port: number; close: () => Promise<void> }> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address() as AddressInfo;
  return {
    port: address.port,
    close: () => new Promise((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    }),
  };
}

function listener(options: {
  cache?: ResponseCache;
  rateLimiter?: NodeRateLimiter;
  handle?: NodeRequestHandler;
} = {}) {
  return createNodeRequestListener({
    responseCache: options.cache ?? memoryResponseCache(),
    rateLimiter: options.rateLimiter ?? limiter(true),
    handleRequest: options.handle ?? handleRequest,
    env,
    db: new MemoryStorage(),
    quillCache: new MemoryCache(),
    environment: 'production',
  });
}

async function get(port: number, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('Origin')) headers.set('Origin', ORIGIN);
  return fetch(`http://127.0.0.1:${port}${path}`, { ...init, headers, redirect: 'manual' });
}

test('a Redis cache hit on /v1/health keeps the CORS and security headers of the miss', async () => {
  const server = await listen(listener());
  try {
    const miss = await get(server.port, '/v1/health');
    const hit = await get(server.port, '/v1/health');
    const otherOrigin = await fetch(`http://127.0.0.1:${server.port}/v1/health`, {
      headers: { Origin: 'https://evil.example' },
      redirect: 'manual',
    });

    assert.equal(miss.status, 200);
    assert.equal(hit.status, 200);
    assert.equal(miss.headers.get('x-cache-status'), 'MISS');
    assert.equal(hit.headers.get('x-cache-status'), 'HIT');
    assert.equal(otherOrigin.headers.get('x-cache-status'), 'HIT');
    assert.equal(await hit.text(), await miss.text(), 'the hit must replay the cached body');

    const missHeaders = edgeOf(miss);
    const hitHeaders = edgeOf(hit);
    assert.deepEqual(hitHeaders, missHeaders);

    assert.equal(hitHeaders['access-control-allow-origin'], ORIGIN);
    assert.equal(hitHeaders['access-control-allow-methods'], 'GET, POST, PATCH, DELETE, OPTIONS');
    assert.equal(hitHeaders['access-control-allow-headers'], 'Content-Type, Authorization, X-API-Key, X-MapleSpike-Mode');
    assert.match(hitHeaders['access-control-expose-headers'] ?? '', /X-RateLimit-Remaining/);
    assert.equal(hitHeaders['x-content-type-options'], 'nosniff');
    assert.equal(hitHeaders['x-frame-options'], 'DENY');
    assert.equal(hitHeaders['referrer-policy'], 'strict-origin-when-cross-origin');
    assert.match(hitHeaders['permissions-policy'] ?? '', /camera=\(\)/);
    assert.match(hitHeaders['cache-control'] ?? '', /no-store/);
    assert.equal(hitHeaders['pragma'], 'no-cache');
    assert.match(hitHeaders['content-security-policy'] ?? '', /default-src 'none'/);
    assert.equal(hitHeaders['strict-transport-security'], 'max-age=63072000; includeSubDomains; preload');

    // CORS is computed for the request in hand. A hit must not replay the
    // first caller's allow-origin.
    assert.equal(otherOrigin.headers.get('access-control-allow-origin'), 'null');
    assert.equal(otherOrigin.headers.get('x-content-type-options'), hitHeaders['x-content-type-options']);
    assert.equal(otherOrigin.headers.get('content-security-policy'), hitHeaders['content-security-policy']);
  } finally {
    await server.close();
  }
});

test('OPTIONS preflight carries the same CORS and security headers', async () => {
  const server = await listen(listener());
  try {
    const preflight = await get(server.port, '/v1/health', { method: 'OPTIONS' });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), ORIGIN);
    assert.equal(preflight.headers.get('access-control-allow-methods'), 'GET, POST, PATCH, DELETE, OPTIONS');
    assert.equal(preflight.headers.get('access-control-max-age'), '86400');
    assert.equal(preflight.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(preflight.headers.get('x-frame-options'), 'DENY');
    assert.equal(preflight.headers.get('strict-transport-security'), 'max-age=63072000; includeSubDomains; preload');
  } finally {
    await server.close();
  }
});

test('a rate-limit 429 carries the same CORS and security headers', async () => {
  const server = await listen(listener({ rateLimiter: limiter(false) }));
  try {
    const ok = await get(server.port, '/v1/health');
    const blocked = await get(server.port, '/v1/version');
    assert.equal(ok.status, 200);
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get('retry-after'), '30');
    assert.equal(blocked.headers.get('x-ratelimit-limit'), '100');
    assert.deepEqual(edgeOf(blocked), edgeOf(ok));
    const body = await blocked.json() as { error: string; retry_after: number };
    assert.equal(body.error, 'rate_limit_exceeded');
    assert.equal(body.retry_after, 30);
  } finally {
    await server.close();
  }
});

test('a listener error carries the same CORS and security headers', async () => {
  const failing: NodeRequestHandler = async () => {
    throw new Error('forced');
  };
  const server = await listen(listener({ handle: failing }));
  try {
    const res = await get(server.port, '/v1/health');
    assert.equal(res.status, 500);
    assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('strict-transport-security'), 'max-age=63072000; includeSubDomains; preload');
    assert.match(res.headers.get('content-security-policy') ?? '', /default-src 'none'/);
    const body = await res.json() as { error: { code: string } };
    assert.equal(body.error.code, 'INTERNAL_ERROR');
  } finally {
    await server.close();
  }
});

test('the public /metrics 404 carries CORS and security headers', async () => {
  const server = await listen(listener());
  try {
    const res = await get(server.port, '/metrics');
    assert.equal(res.status, 404);
    assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.match(await res.text(), /Not found/);
  } finally {
    await server.close();
  }
});
