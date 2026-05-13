/**
 * MapleSpike Canada — Response Envelope
 *
 * Consistent API response format for all endpoints.
 * Every response includes citations, usage meta, and OGL-C attribution.
 */

import type { ApiResponse, Tier, ResponseMeta, CitationMeta, UsageMeta } from './types.js';
import type { Tenant } from './types.js';
import { TIER_LIMITS } from './types.js';

const OGL_C_ATTRIBUTION: CitationMeta = {
  source: 'Open Government Licence – Canada',
  timestamp: new Date().toISOString(),
  hash: '',
  license: 'https://open.canada.ca/en/open-government-licence-canada',
};

/* ------------------------------------------------------------------ */
/*  Response Builders                                                  */
/* ------------------------------------------------------------------ */

export function buildSuccess<T>(
  data: T,
  ctx: { tenant: Tenant; requestId: string; startTime: number },
  extraCitations: CitationMeta[] = [],
): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
    meta: buildMeta(ctx),
    citations: [OGL_C_ATTRIBUTION, ...extraCitations].filter((c) => c.hash || c.source !== OGL_C_ATTRIBUTION.source),
  };
}

export function buildError(
  code: string,
  message: string,
  ctx: { tenant: Tenant; requestId: string; startTime: number },
  statusCode?: number,
): ApiResponse<null> {
  return {
    success: false,
    data: null,
    error: { code, message },
    meta: buildMeta(ctx),
    citations: [OGL_C_ATTRIBUTION],
  };
}

function buildMeta(ctx: { tenant: Tenant; requestId: string; startTime: number }): ResponseMeta {
  const now = new Date().toISOString();
  return {
    requestId: ctx.requestId,
    timestamp: now,
    version: '0.1.0',
    usage: {
      periodCalls: 0, // Filled by middleware
      periodLimit: TIER_LIMITS[ctx.tenant.tier]?.monthly || 1000,
      tier: ctx.tenant.tier,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Rate Limit Reset Calculation                                        */
/* ------------------------------------------------------------------ */

/**
 * Calculate the Unix timestamp (seconds) when the current rate-limit period resets.
 * For daily: next midnight UTC. For monthly: first day of next month UTC.
 */
export function calcRateLimitReset(period: 'daily' | 'monthly'): number {
  const now = new Date();
  if (period === 'daily') {
    // Midnight UTC tonight
    const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
    return Math.floor(reset.getTime() / 1000);
  }
  // First day of next month UTC
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return Math.floor(reset.getTime() / 1000);
}

/* ------------------------------------------------------------------ */
/*  HTTP Response Helpers                                              */
/* ------------------------------------------------------------------ */

export function jsonResponse<T>(
  body: ApiResponse<T>,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-MapleSpike-Version': '0.1.0',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-MapleSpike-Mode',
      ...extraHeaders,
    },
  });
}

/**
 * Attach rate-limit headers to an existing Response.
 * Returns a new Response (headers are immutable after construction).
 */
export function addRateLimitHeaders(
  response: Response,
  rateInfo: {
    remaining: number;
    resetTime: number;
  },
): Response {
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Remaining', String(Math.max(0, rateInfo.remaining)));
  headers.set('X-RateLimit-Reset', String(Math.floor(rateInfo.resetTime / 1000)));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function corsPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-MapleSpike-Mode',
      'Access-Control-Max-Age': '86400',
    },
  });
}
