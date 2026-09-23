/**
 * Quill — Development Server
 *
 * Node.js HTTP server that mounts the same route handlers as the Worker.
 * Supports in-memory (default) and SQLite storage backends.
 *
 * Usage:
 *   QUILL_STORAGE=memory   node dist/dev-server.js   # in-memory (default)
 *   QUILL_STORAGE=sqlite   node dist/dev-server.js   # SQLite persistence
 *   QUILL_STORAGE=postgres node dist/dev-server.js   # PostgreSQL (production)
 *   QUILL_DB_PATH=/tmp/my.db node dist/dev-server.js # custom SQLite path
 */

// Telemetry must be imported first to capture early spans
import './telemetry.js';

import * as http from 'node:http';
import { handleRequest } from './index.js';
import { MemoryStorage, MemoryCache } from './storage.js';
import type { QuillStorage, QuillCache } from './types.js';
import { initEmailConfig } from './email.js';
import { validateConfig } from './config.js';
import logger from './logger.js';

import { redisClient } from './cache/redis.js';
import { rateLimiter, TIER_LIMITS } from './middleware/rate-limiter.js';
import type { Tier } from './middleware/rate-limiter.js';
import { credentialCacheScope } from './middleware/cache-middleware.js';

const log = logger;

const PORT = parseInt(process.env.PORT || "8082", 10);
const AI_ENDPOINT = process.env.QUILL_AI_ENDPOINT || 'http://127.0.0.1:8080/v1';
const AI_MODEL = process.env.QUILL_AI_MODEL || 'qwen3.5-27b';
const QUILL_STORAGE = (process.env.QUILL_STORAGE || 'memory').toLowerCase();
const QUILL_DB_PATH = process.env.QUILL_DB_PATH || './maplespike.db';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'maplespike-jwt-secret-change-in-production') {
  log.error('FATAL: JWT_SECRET environment variable must be set to a secure random value.');
  log.error('  Generate one with: openssl rand -hex 64');
  process.exit(1);
}

const env = {
  QUILL_API_KEY: process.env.QUILL_API_KEY || '',
  QUILL_VERSION: process.env.QUILL_VERSION || '0.1.0',
  QUILL_NAME: process.env.QUILL_NAME || 'Quill',
  ENVIRONMENT: process.env.ENVIRONMENT || 'development',
  QUILL_DB_PATH: process.env.QUILL_DB_PATH || './maplespike.db',
  AI_ENDPOINT,
  AI_MODEL,
  JWT_SECRET,
};

// Crash on startup if JWT_SECRET is unset or still the default value
try {
  validateConfig({ ...process.env });
} catch (e) {
  log.error(`Config error: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}

initEmailConfig({ ...process.env });

let db: QuillStorage;
let cache: QuillCache;

if (QUILL_STORAGE === 'postgres') {
  log.info('Using PostgreSQL backend');
  const { PgStorage, PgCache } = await import('./pg-storage.js');
  const pgDb = new PgStorage();
  await pgDb.init();
  db = pgDb;
  cache = new PgCache();
} else if (QUILL_STORAGE === 'sqlite' || QUILL_STORAGE === 'node-sqlite') {
  log.info(`Using Node SQLite backend: ${QUILL_DB_PATH}`);
  // Uses node:sqlite (built into Node 22+, no native compilation needed)
  const { NodeSqliteStorage, NodeSqliteCache } = await import('./node-sqlite-storage.js');
  db = new NodeSqliteStorage(QUILL_DB_PATH);
  cache = new NodeSqliteCache();
} else {
  log.info('Using in-memory backend');

  const memDb = new MemoryStorage();
  cache = new MemoryCache();

  // No hardcoded dev tenant — use /v1/register or set ALLOW_DEMO_KEYS=true for demo keys
  db = memDb;
}

// ── Redis cache + rate-limiter initialisation ──
// Both read REDIS_URL (see cache/redis-url.ts). With no REDIS_URL the cache
// serves without caching and the limiter enforces in-process; neither dials a
// guessed endpoint.
await redisClient.connect();
await rateLimiter.init();
log.info(
  {
    cache: redisClient.isConnected() ? 'redis' : 'disabled',
    rateLimiter: rateLimiter.backendMode(),
  },
  '[redis] cache + rate limiter initialised',
);

// ── Cache route configuration ──
interface CacheRouteConfig {
  pattern: RegExp;
  ttl: number; // seconds
}

const CACHE_ROUTES: CacheRouteConfig[] = [
  { pattern: /^\/v1\/modules\/?$/, ttl: 300 },       // 5 min
  { pattern: /^\/v1\/health\/?$/, ttl: 10 },           // 10 s
  { pattern: /^\/v1\/explorer\/?$/, ttl: 60 },         // 1 min
];

// Routes NEVER cached
const NO_CACHE_PREFIXES = ['/v1/auth/', '/v1/billing/'];

/**
 * Check if a path matches a no-cache prefix.
 */
function isNoCachePath(pathname: string): boolean {
  return NO_CACHE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Find matching cache config for a request.
 */
function matchCacheRoute(pathname: string): CacheRouteConfig | null {
  for (const cfg of CACHE_ROUTES) {
    if (cfg.pattern.test(pathname)) return cfg;
  }
  return null;
}

function verifyStorageHealth(): boolean {
  try {
    // Check if db has a getTenant method (SqliteStorage pattern)
    if (typeof (db as any).getTenant === 'function') {
      const result = (db as any).getTenant('fg-internal');
      return !!result;
    }
    return true; // MemoryStorage is always healthy
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const protocol = (req.socket as { encrypted?: boolean }).encrypted ? 'https' : 'http';
    const host = req.headers.host || 'localhost';
    const url = `${protocol}://${host}${req.url || '/'}`;
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname;
    const search = parsedUrl.search;

    // ── Rate limit check (skip health) ──
    if (!pathname.startsWith('/v1/health')) {
      const ip = rateLimiter.extractIP(req);
      const tier = rateLimiter.extractTier(req);
      // Always returns a decision — Redis when connected, the in-process
      // window otherwise. There is no pass-through mode.
      const rlResult = await rateLimiter.check(ip, tier);

      // Set rate-limit headers on every response
      res.setHeader('X-RateLimit-Limit', String(rlResult.limit));
      res.setHeader('X-RateLimit-Remaining', String(rlResult.remaining));
      res.setHeader('X-RateLimit-Reset', String(rlResult.resetTime));

      if (!rlResult.allowed) {
        res.setHeader('Retry-After', String(rlResult.retryAfter));
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'rate_limit_exceeded',
          retry_after: rlResult.retryAfter,
        }));
        return;
      }
    }

    // ── Cache check (GET only, matching routes) ──
    let cacheStatus: 'hit' | 'miss' | 'bypass' = 'bypass';

    if (req.method === 'GET' && !isNoCachePath(pathname)) {
      const cacheCfg = matchCacheRoute(pathname);
      if (cacheCfg) {
        // Scope the key to the caller: identity-dependent routes (/v1/me,
        // /v1/usage, /v1/annotations, /v1/auth/me) must never replay one
        // caller's body to another. Anonymous requests stay shared.
        const cacheKey = `v1:GET:${pathname}${search}${credentialCacheScope(JSON.stringify(req.headers['authorization'] ?? ''))}`;
        const cached = await redisClient.get<string>(cacheKey);
        if (cached !== null) {
          cacheStatus = 'hit';
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('X-Cache-Status', 'HIT');
          res.end(cached);
          return;
        }

        // Cache miss — capture the response, cache it, then serve
        cacheStatus = 'miss';
      }
    }

    // ── Normal request handling ──
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
    }

    let body: string | null = null;
    if (req.method === 'POST' || req.method === 'PUT') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      body = Buffer.concat(chunks).toString('utf-8');
    }

    const request = new Request(url, {
      method: req.method,
      headers,
      body,
    });

    const response = await handleRequest(request, env, db, cache);

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Add cache status header
    responseHeaders['X-Cache-Status'] = cacheStatus === 'miss' ? 'MISS' : 'BYPASS';

    res.writeHead(response.status, responseHeaders);

    const responseBody = await response.text();
    res.end(responseBody);

    // ── Asynchronous cache store (after response is sent) ──
    if (cacheStatus === 'miss' && response.status >= 200 && response.status < 300) {
      const cacheCfg = matchCacheRoute(pathname);
      if (cacheCfg && req.method === 'GET') {
        // Scope the key to the caller: identity-dependent routes (/v1/me,
        // /v1/usage, /v1/annotations, /v1/auth/me) must never replay one
        // caller's body to another. Anonymous requests stay shared.
        const cacheKey = `v1:GET:${pathname}${search}${credentialCacheScope(JSON.stringify(req.headers['authorization'] ?? ''))}`;
        redisClient.set(cacheKey, responseBody, cacheCfg.ttl).catch(() => {});
      }
    }
  } catch (err) {
    log.error(`Fatal: ${err}`);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Server error', message_fr: 'Erreur interne du serveur' } }));
  }
});

if (!verifyStorageHealth()) {
  log.error('Health check failed — aborting startup');
  process.exit(1);
}

server.listen(PORT, '0.0.0.0', () => {
  const devKey = process.env.QUILL_DEV_API_KEY || '<generate with /v1/register>';
  const jwtSecret = process.env.JWT_SECRET ? 'configured' : 'default (change in production)';

  console.log(`\n  Quill API (dev)`);
  console.log(`  ${'─'.repeat(45)}`);
  console.log(`  Server:    http://0.0.0.0:${PORT}/v1`);
  console.log(`  Health:    http://localhost:${PORT}/v1/health`);
  console.log(`  Spec:      http://localhost:${PORT}/v1/openapi.json`);
  console.log(`  Storage:   ${QUILL_STORAGE}`);
  console.log(`  Cache:     ${redisClient.isConnected() ? 'Redis' : 'disabled (no REDIS_URL)'}`);
  console.log(`  Rate-limit: ${rateLimiter.backendMode() === 'redis' ? 'Redis' : 'in-process window'}`);
  if (QUILL_STORAGE === 'sqlite') {
    console.log(`  DB Path:   ${QUILL_DB_PATH}`);
  } else if (QUILL_STORAGE === 'postgres') {
    const host = process.env.QUILL_DB_HOST || 'localhost';
    const db   = process.env.QUILL_DB_NAME || 'maplespike';
    console.log(`  PG Host:   ${host}/${db}`);
  }
  console.log(`  AI:        ${AI_ENDPOINT} (${AI_MODEL})`);
  console.log(`  JWT:       ${jwtSecret}`);
  console.log(``);
  console.log(`  Authentication:`);
  console.log(`  ${'─'.repeat(45)}`);
  console.log(`  1. API Key (legacy):`);
  console.log(`     curl -H "Authorization: Bearer ***" http://localhost:${PORT}/v1/health`);
  console.log(`     curl -H "X-API-Key: *** http://localhost:${PORT}/v1/health`);
  console.log(``);
  console.log(`  2. GitHub OAuth (if configured):`);
  console.log(`     Open http://localhost:${PORT}/v1/auth/github in your browser`);
  console.log(``);
  console.log(`  3. JWT Token:`);
  console.log(`     curl -H "Authorization: Bearer ***" http://localhost:${PORT}/v1/auth/me`);
  console.log(``);
  console.log(`  4. Registration:`);
  console.log(`     curl -X POST http://localhost:${PORT}/v1/register \\`);
  console.log(`       -H "Content-Type: application/json" \\`);
  console.log(`       -d '{"name":"My Org","email":"user@example.com"}'`);
  console.log(`  ${'─'.repeat(45)}\n`);
});
