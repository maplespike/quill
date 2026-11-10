// SPDX-License-Identifier: AGPL-3.0-only
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
import { handleRequest, getMetricsRoute } from './index.js';
import { apiMetrics, isKnownPipeline, normalizeApiMethod, normalizeApiStatus } from './metrics.js';
import { getAllModules, getLatestIngestRuns, getLatestSuccessfulIngestRuns } from '@maplespike/pipeline-core';
import { MemoryStorage, MemoryCache } from './storage.js';
import type { QuillStorage, QuillCache } from './types.js';
import { initEmailConfig } from './email.js';
import { validateConfig } from './config.js';
import { startReleaseRefreshTimer } from './services/gov-releases-cache.js';
import { fetchStatCanReleases } from '@maplespike/pipeline-core';
import logger from './logger.js';

import { redisClient } from './cache/redis.js';
import { rateLimiter } from './middleware/rate-limiter.js';
import { credentialCacheScope } from './middleware/cache-middleware.js';
import { validateConfig as validateUpstreamConfig } from './upstream/maintenance-config.js';
import { startUpstreamProber } from './upstream/prober.js';

const log = logger;

const PORT = parseInt(process.env.PORT || "8082", 10);
const METRICS_PORT = parseInt(process.env.QUILL_API_METRICS_PORT || "9464", 10);
const AI_ENDPOINT = process.env.QUILL_AI_ENDPOINT || 'http://127.0.0.1:8080/v1';
const AI_MODEL = process.env.QUILL_AI_MODEL || 'qwen3.5-27b';
const QUILL_STORAGE = (process.env.QUILL_STORAGE || 'memory').toLowerCase();
const QUILL_DB_PATH = process.env.QUILL_DB_PATH || './quill.db';

const KNOWN_PIPELINE_MODULES = new Set(getAllModules().map(({ name }) => name));

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'maplespike-jwt-secret-change-in-production') {
  log.error('FATAL: JWT_SECRET environment variable must be set to a secure random value.');
  log.error('  Generate one with: openssl rand -hex 64');
  process.exit(1);
}

const env = {
  QUILL_API_KEY: process.env.QUILL_API_KEY || '',
  QUILL_VERSION: process.env.QUILL_VERSION || '0.1.0',
  QUILL_NAME: process.env.QUILL_NAME || 'Quill by Maplespike',
  ENVIRONMENT: process.env.ENVIRONMENT || 'development',
  QUILL_DB_PATH: process.env.QUILL_DB_PATH || './quill.db',
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

function renderMetrics(): string {
  const lines = [
    '# HELP quill_ingest_last_success_timestamp_seconds Unix timestamp of the last successful pipeline run.',
    '# TYPE quill_ingest_last_success_timestamp_seconds gauge',
    '# HELP quill_ingest_last_run_records Records reported by the latest pipeline run.',
    '# TYPE quill_ingest_last_run_records gauge',
    '# HELP quill_ingest_last_run_success Whether the latest pipeline run succeeded (1) or failed (0).',
    '# TYPE quill_ingest_last_run_success gauge',
    // Skip observability. A change-gate skip is a SUCCESS with 0 records, so a
    // pipeline that wrongly skips (a bad probe URL, a source that silently
    // starts answering 304) looks perfectly healthy: success=1, fresh
    // timestamp, no alert. This gauge surfaces the skip so "running but never
    // doing work" is visible instead of invisible.
    '# HELP quill_ingest_last_skip_timestamp_seconds Unix timestamp of the last change-gate skip.',
    '# TYPE quill_ingest_last_skip_timestamp_seconds gauge',
  ];
  try {
    const successfulRuns = getLatestSuccessfulIngestRuns();
    const latestRuns = getLatestIngestRuns();
    const escapeLabel = (value: string) => value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');
    for (const run of successfulRuns) {
      if (!isKnownPipeline(run.pipeline, KNOWN_PIPELINE_MODULES)) continue;
      const pipeline = escapeLabel(run.pipeline);
      const timestamp = Date.parse(run.finished_at) / 1000;
      if (Number.isFinite(timestamp)) lines.push(`quill_ingest_last_success_timestamp_seconds{pipeline="${pipeline}"} ${timestamp}`);
    }
    for (const run of latestRuns) {
      if (!isKnownPipeline(run.pipeline, KNOWN_PIPELINE_MODULES)) continue;
      const pipeline = escapeLabel(run.pipeline);
      const records = Number.isFinite(run.records) ? Math.max(0, Math.trunc(run.records)) : 0;
      lines.push(`quill_ingest_last_run_records{pipeline="${pipeline}"} ${records}`);
      lines.push(`quill_ingest_last_run_success{pipeline="${pipeline}"} ${run.status === 'success' ? 1 : 0}`);
      // A declared no-change skip: emit when it happened so a gate that never
      // lets a pipeline through is distinguishable from one that works.
      const zeroReason = run.sources?.zeroReason ?? null;
      if (zeroReason === 'no-change-since-last-run') {
        const skipTs = Date.parse(run.finished_at) / 1000;
        if (Number.isFinite(skipTs)) {
          lines.push(`quill_ingest_last_skip_timestamp_seconds{pipeline="${pipeline}"} ${skipTs}`);
        }
      }
    }
  } catch (err) {
    log.warn({ errorType: err instanceof Error ? err.name : 'unknown' }, 'Unable to render ingestion metrics');
  }
  return `${apiMetrics.render()}${lines.join('\n')}\n`;
}

// The public API listener never exposes metrics. Use a separate ClusterIP Service
// and NetworkPolicy for the dedicated listener below.
const metricsServer = http.createServer((req, res) => {
  if (req.method !== 'GET' || req.url !== '/metrics') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found\n');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
  res.end(renderMetrics());
});

const server = http.createServer(async (req, res) => {
  const startedAt = Date.now();
  const requestMethod = normalizeApiMethod(req.method ?? 'GET');
  let status = 500;
  let route = 'unmatched';
  let metricsRecorded = false;
  const recordMetrics = () => {
    if (metricsRecorded) return;
    metricsRecorded = true;
    if (route !== 'metrics') apiMetrics.record(route, requestMethod, normalizeApiStatus(status), (Date.now() - startedAt) / 1000);
  };
  res.once('finish', recordMetrics);

  try {
    const protocol = (req.socket as { encrypted?: boolean }).encrypted ? 'https' : 'http';
    const host = req.headers.host || 'localhost';
    const url = `${protocol}://${host}${req.url || '/'}`;
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname;
    const search = parsedUrl.search;
    route = getMetricsRoute(pathname, req.method ?? 'GET');

    if (pathname === '/metrics') {
      route = 'metrics';
      status = 404;
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found\n');
      return;
    }

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
        status = 429;
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
          status = 200;
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
    status = response.status;

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
    log.error({ errorType: err instanceof Error ? err.name : 'unknown' }, 'Fatal API request error');
    status = 500;
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Server error', message_fr: 'Erreur interne du serveur' } }));
  }
});

if (!verifyStorageHealth()) {
  log.error('Health check failed — aborting startup');
  process.exit(1);
}

metricsServer.listen(METRICS_PORT, '0.0.0.0', () => {
  log.info({ port: METRICS_PORT }, 'Private API metrics listener started');
});

// Upstream maintenance probe (UPSTREAM-OUTAGES.md §6). In-process: one GET per
// host per minute, feeding a five-minute rolling window behind
// GET /v1/upstream/status. Disable with QUILL_UPSTREAM_PROBE=0.
{
  const errors = validateUpstreamConfig();
  if (errors.length > 0) {
    // A bad window in the config would silently hide scheduled maintenance, so
    // it fails the boot instead of degrading the banner.
    log.error({ errors }, 'invalid upstream-maintenance config');
    process.exit(1);
  }
  startUpstreamProber();
}

// Warm the government-releases snapshot before the first request arrives.
// GET /v1/gov/releases took 19 s on a cold process because it awaited StatCan
// on the request path (QUILL-AUDIT.md 2026-10-24, P1). The timer refreshes in
// the background, so a request reads memory instead of waiting on the WDS.
if (process.env.QUILL_RELEASES_WARMER !== '0') {
  const stopWarmer = startReleaseRefreshTimer(
    () => fetchStatCanReleases({ limit: 20 }),
    Number(process.env.QUILL_RELEASES_WARM_MS || 10 * 60 * 1000) / 2,
    (err) => log.warn({ err }, 'gov/releases snapshot refresh failed'),
  );
  log.info('gov/releases cache warmer started');
  const shutdown = (): void => stopWarmer();
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

server.listen(PORT, '0.0.0.0', () => {
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
  console.log(`     curl -X POST http://localhost:${PORT}/v1/register -H "Content-Type: application/json" -d '{"name":"My Org","email":"user@example.com"}'`);
  console.log(`  ${'─'.repeat(45)}\n`);
});

function shutdown(): void {
  metricsServer.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
