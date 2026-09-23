/**
 * Quill — Per-Route TTL-Based Caching Middleware
 *
 * Wraps individual route handlers with cache-check / cache-store logic.
 * Cache hits return the cached response without invoking the original handler.
 * Cache misses invoke the handler and, on success, store the response body in
 * the in-memory globalCache with the configured per-route TTL.
 *
 * Usage: wrap a RouteHandler at route-definition time:
 *   { pattern: /^\/v1\/example\/?$/, method: 'GET', params: [], handler: withRouteCache(exampleHandler, 3600) }
 */

import { createHash } from 'node:crypto';

import { globalCache } from '../cache.js';
import type { RouteHandler } from '../types.js';
import { applySecurityHeaders } from './security-headers.js';

/**
 * Scope a caller's credential to a short, non-reversible suffix.
 *
 * Any response that depends on WHO is asking must not share a cache entry with
 * another caller. Before this, /v1/me, /v1/usage, /v1/annotations,
 * /v1/annotations/export and /v1/auth/me were cached under one key, so the first
 * response was replayed to the next caller — a cross-tenant leak. The credential
 * is hashed, never stored raw in the key.
 */
export function credentialCacheScope(credential: string | null | undefined): string {
  if (!credential) return '';
  return ':' + createHash('sha256').update(credential).digest('hex').slice(0, 16);
}

/**
 * Generate a standardised cache key from request method + path + query string.
 *
 * Pass the caller's credential as `credentialScope` for any response that can
 * differ per caller. Anonymous/public responses pass '' and stay shared.
 */
export function makeCacheKey(
  method: string,
  pathname: string,
  search: string,
  credentialScope: string | null | undefined = '',
): string {
  return `v1:${method}:${pathname}:${search}${credentialCacheScope(credentialScope)}`;
}

/**
 * Wrap a route handler with per-route TTL-based caching.
 *
 * @param handler    The original route handler.
 * @param ttlSeconds Time-to-live in seconds. Use 0 or omit to disable caching.
 *                   Only GET requests are cached; mutations always pass through.
 */
export function withRouteCache(
  handler: RouteHandler,
  ttlSeconds: number,
): RouteHandler {
  if (ttlSeconds <= 0) return handler; // no caching

  return async (request, ctx, params) => {
    // Only cache GET requests
    if (request.method !== 'GET') {
      return handler(request, ctx, params);
    }

    const url = new URL(request.url);
    const cacheKey = makeCacheKey(request.method, url.pathname, url.search, request.headers.get('authorization'));

    // ── Cache check ──
    const cached = globalCache.get<string>(cacheKey);
    if (cached !== null) {
      try {
        const body = JSON.parse(cached);

        // Freshen metadata on every cache hit
        const now = new Date().toISOString();
        body.meta.cacheStatus = 'hit';
        body.meta.timestamp = now;
        body.meta.durationMs = Date.now() - ctx.startTime;
        body.quality.freshness_seconds = Math.floor((Date.now() - ctx.startTime) / 1000);

        const response = new Response(JSON.stringify(body, null, 2), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-MapleSpike-Version': '0.1.0',
            'X-Cache': 'hit',
            'X-MapleSpike-Trace-Id': crypto.randomUUID(),
          },
        });

        // Apply security headers
        const secureResponse = new Response(response.body, {
          status: response.status,
          headers: applySecurityHeaders(new Headers(response.headers), ctx.env.ENVIRONMENT),
        });

        return secureResponse;
      } catch {
        // Malformed cache entry — fall through to handler
        globalCache.delete(cacheKey);
      }
    }

    // ── Cache miss — dispatch to original handler ──
    const response = await handler(request, ctx, params);

    // Only cache successful 2xx responses
    if (response.status >= 200 && response.status < 300) {
      const cloned = response.clone();
      const bodyText = await cloned.text();
      globalCache.set(cacheKey, bodyText, ttlSeconds);
    }

    return response;
  };
}
