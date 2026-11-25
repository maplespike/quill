// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Node HTTP listener for the Quill API.
 *
 * The dev server and the production pod both serve through this listener.
 * Every response — cache hit, cache miss, preflight, rate limit, and
 * server error — is written by sendNodeResponse, which applies the same
 * CORS and security headers as the handler path.
 */

import * as http from 'node:http';
import { getMetricsRoute } from './index.js';
import { apiMetrics, normalizeApiMethod, normalizeApiStatus } from './metrics.js';
import type { QuillCache, QuillStorage } from './types.js';
import logger from './logger.js';
import { credentialCacheScope } from './middleware/cache-middleware.js';
import { applyCorsAndSecurityHeaders } from './response.js';

const log = logger;

interface CacheRouteConfig {
  pattern: RegExp;
  ttl: number;
}

const CACHE_ROUTES: CacheRouteConfig[] = [
  { pattern: /^\/v1\/modules\/?$/, ttl: 300 },
  { pattern: /^\/v1\/health\/?$/, ttl: 10 },
  { pattern: /^\/v1\/explorer\/?$/, ttl: 60 },
];

const NO_CACHE_PREFIXES = ['/v1/auth/', '/v1/billing/'];

function isNoCachePath(pathname: string): boolean {
  return NO_CACHE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function matchCacheRoute(pathname: string): CacheRouteConfig | null {
  for (const cfg of CACHE_ROUTES) {
    if (cfg.pattern.test(pathname)) return cfg;
  }
  return null;
}

/** Parsed Redis (or test-double) response cache. */
export interface ResponseCache {
  get<T = string>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
}

export interface NodeRateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter: number;
}

export interface NodeRateLimiter {
  extractIP(req: http.IncomingMessage): string;
  extractTier(req: http.IncomingMessage): string;
  check(ip: string, tier: string): Promise<NodeRateLimitDecision>;
}

export type NodeRequestHandler = (
  request: Request,
  env: Record<string, string | undefined>,
  db: QuillStorage,
  cache: QuillCache,
) => Promise<Response>;

export interface NodeListenerDeps {
  responseCache: ResponseCache;
  rateLimiter: NodeRateLimiter;
  handleRequest: NodeRequestHandler;
  env: Record<string, string | undefined>;
  db: QuillStorage;
  quillCache: QuillCache;
  /** Same value handleRequest reads from env.ENVIRONMENT. Drives HSTS. */
  environment: string;
}

function requestOriginOf(req: http.IncomingMessage): string | null {
  const value = req.headers.origin;
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Write one Node response with the shared CORS and security headers.
 *
 * Headers already set on `res` (rate-limit counters) are kept when the
 * response does not already carry them. writeHead gives the response
 * headers precedence, matching the previous miss path.
 */
function sendNodeResponse(
  res: http.ServerResponse,
  status: number,
  headers: Headers,
  body: string,
  origin: string | null,
  environment: string,
): void {
  applyCorsAndSecurityHeaders(headers, origin, environment);
  for (const name of res.getHeaderNames()) {
    if (headers.has(name)) continue;
    const current = res.getHeader(name);
    if (typeof current === 'number') headers.set(name, String(current));
    else if (Array.isArray(current)) headers.set(name, current.join(', '));
    else if (typeof current === 'string') headers.set(name, current);
  }
  const outgoing: Record<string, string> = {};
  headers.forEach((value, key) => {
    outgoing[key] = value;
  });
  res.writeHead(status, outgoing);
  res.end(body);
}

export function createNodeRequestListener(deps: NodeListenerDeps): http.RequestListener {
  const { responseCache, rateLimiter, handleRequest, env, db, quillCache, environment } = deps;

  return async (req, res) => {
    const startedAt = Date.now();
    const requestMethod = normalizeApiMethod(req.method ?? 'GET');
    let status = 500;
    let route = 'unmatched';
    let origin: string | null = null;
    let metricsRecorded = false;
    const recordMetrics = () => {
      if (metricsRecorded) return;
      metricsRecorded = true;
      if (route !== 'metrics') {
        apiMetrics.record(route, requestMethod, normalizeApiStatus(status), (Date.now() - startedAt) / 1000);
      }
    };
    res.once('finish', recordMetrics);

    try {
      const protocol = (req.socket as { encrypted?: boolean }).encrypted ? 'https' : 'http';
      const host = req.headers.host || 'localhost';
      const url = `${protocol}://${host}${req.url || '/'}`;
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname;
      const search = parsedUrl.search;
      origin = requestOriginOf(req);
      route = getMetricsRoute(pathname, req.method ?? 'GET');

      // The public listener does not serve Prometheus. The private metrics
      // listener is a different server and stays plain text.
      if (pathname === '/metrics') {
        route = 'metrics';
        status = 404;
        const headers = new Headers();
        headers.set('Content-Type', 'text/plain; charset=utf-8');
        sendNodeResponse(res, 404, headers, 'Not found\n', origin, environment);
        return;
      }

      // There is no 304 path. This server does not answer conditional
      // requests with Not Modified. OPTIONS preflight is not cached; it
      // falls through to handleRequest and is written below.
      if (!pathname.startsWith('/v1/health')) {
        const ip = rateLimiter.extractIP(req);
        const tier = rateLimiter.extractTier(req);
        const rlResult = await rateLimiter.check(ip, tier);

        res.setHeader('X-RateLimit-Limit', String(rlResult.limit));
        res.setHeader('X-RateLimit-Remaining', String(rlResult.remaining));
        res.setHeader('X-RateLimit-Reset', String(rlResult.resetTime));

        if (!rlResult.allowed) {
          status = 429;
          res.setHeader('Retry-After', String(rlResult.retryAfter));
          const headers = new Headers();
          headers.set('Content-Type', 'application/json');
          sendNodeResponse(res, 429, headers, JSON.stringify({
            error: 'rate_limit_exceeded',
            retry_after: rlResult.retryAfter,
          }), origin, environment);
          return;
        }
      }

      let cacheStatus: 'hit' | 'miss' | 'bypass' = 'bypass';

      if (req.method === 'GET' && !isNoCachePath(pathname)) {
        const cacheCfg = matchCacheRoute(pathname);
        if (cacheCfg) {
          // Scope the key to the caller. Identity-dependent routes must
          // never replay one caller's body to another. Anonymous requests
          // stay shared.
          const cacheKey = `v1:GET:${pathname}${search}${credentialCacheScope(JSON.stringify(req.headers.authorization ?? ''))}`;
          const cached = await responseCache.get<string>(cacheKey);
          if (typeof cached === 'string') {
            cacheStatus = 'hit';
            status = 200;
            const headers = new Headers();
            headers.set('Content-Type', 'application/json');
            headers.set('X-Cache-Status', 'HIT');
            sendNodeResponse(res, 200, headers, cached, origin, environment);
            return;
          }

          cacheStatus = 'miss';
        }
      }

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

      const response = await handleRequest(request, env, db, quillCache);
      status = response.status;

      const responseHeaders = new Headers();
      response.headers.forEach((value, key) => {
        responseHeaders.set(key, value);
      });
      responseHeaders.set('X-Cache-Status', cacheStatus === 'miss' ? 'MISS' : 'BYPASS');

      const responseBody = await response.text();
      sendNodeResponse(res, response.status, responseHeaders, responseBody, origin, environment);

      if (cacheStatus === 'miss' && response.status >= 200 && response.status < 300) {
        const cacheCfg = matchCacheRoute(pathname);
        if (cacheCfg && req.method === 'GET') {
          const cacheKey = `v1:GET:${pathname}${search}${credentialCacheScope(JSON.stringify(req.headers.authorization ?? ''))}`;
          responseCache.set(cacheKey, responseBody, cacheCfg.ttl).catch(() => {});
        }
      }
    } catch (err) {
      log.error({ errorType: err instanceof Error ? err.name : 'unknown' }, 'Fatal API request error');
      status = 500;
      if (res.headersSent) return;
      const headers = new Headers();
      headers.set('Content-Type', 'application/json');
      sendNodeResponse(res, 500, headers, JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Server error',
          message_fr: 'Erreur interne du serveur',
        },
      }), origin, environment);
    }
  };
}
