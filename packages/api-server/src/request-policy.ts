// SPDX-License-Identifier: Apache-2.0
/**
 * Quill — Gateway Request Policy
 *
 * The decisions the gateway makes about an incoming request, as pure functions
 * over the matched route, the request path, and the request headers. The gateway
 * (index.ts) owns the effects: resolving the key, writing audits, and building
 * the response envelope.
 */

import { isFreeTierRoute, isOperatorRoute } from './feature-gates.js';
import type { Route } from './route-registry.js';

/**
 * Whether the bearer-key gate must run. The ROUTES entry owns this: no
 * declaration means 'key' (a tenant API key must resolve), 'public' takes no
 * credentials at all, and 'handler' authenticates the request itself.
 *
 * /v1/auth/me is public, but a presented bearer key must still resolve: it
 * reports WHOSE credentials were presented (login and OAuth callbacks must be
 * reachable with no credentials at all). Without that, a caller holding a
 * perfectly valid key was answered as the anon tenant and saw no keys of its own.
 */
export function requiresAuthentication(route: Route, path: string, request: Request): boolean {
  const keyRequired = route.auth === undefined || route.auth === 'key';
  const identityRoute = path.startsWith('/v1/auth/me');
  const presentedBearer = /^Bearer\s+\S/i.test(request.headers.get('authorization') ?? '');
  return keyRequired || (identityRoute && presentedBearer);
}

/**
 * Liveness probes and the freshness summary must not consume a rate-limit
 * budget: kubelet probes and the cluster health check read them on a timer.
 */
export function skipsRateLimit(path: string): boolean {
  return path.startsWith('/v1/health') || path.startsWith('/v1/astral/health') || path === '/v1/data/quality';
}

/**
 * Free = discovery and metadata only (decision #803). Data queries, AI and tool
 * execution are Pro+, enforced here and nowhere else, so a free tenant cannot
 * slip past a per-route gate.
 */
export function freeTierBlocked(tier: string, path: string): boolean {
  return tier === 'free' && !isFreeTierRoute(path) && !isOperatorRoute(path);
}

/** Identified callers are limited per tenant; anonymous callers per client IP. */
export function rateLimitKeyFor(request: Request, tenantId: string | null): string {
  if (tenantId) return tenantId;
  // Only trust proxy headers when TRUST_PROXY is set: clients can spoof them.
  const trustProxy = process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1';
  const forwardedIp = request.headers.get('X-Real-IP')
    || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
    || '';
  const clientIp = request.headers.get('CF-Connecting-IP') || (trustProxy ? forwardedIp : '') || 'anon';
  return `anon:${clientIp}`;
}
