/**
 * MapleSpike — Response Envelope
 *
 * Consistent API response format for all endpoints.
 * MapleSpike-quality envelope: success/data/error/meta/quality/citation.
 * Applies token optimization (_fields, _format).
 */

import type {
  ApiResponse,
  Tier,
  ResponseMeta,
  CitationMeta,
  QualityMeta,
  UsageMeta,
  QueryOptions,
} from './types.js';
import type { Tenant } from './types.js';
import { TIER_LIMITS } from './types.js';

/* ------------------------------------------------------------------ */
/*  Default Citation                                                   */
/* ------------------------------------------------------------------ */

const OGL_C_CITATION: CitationMeta = {
  source_name: 'Open Government Licence – Canada',
  source_url: 'https://open.canada.ca/en/open-government-licence-canada',
  retrieved_at: new Date().toISOString(),
  data_hash: '',
  license: 'https://open.canada.ca/en/open-government-licence-canada',
  update_frequency: 'daily',
};

/* ------------------------------------------------------------------ */
/*  Builders — Internal                                                */
/* ------------------------------------------------------------------ */

function buildQualityMeta(ctx: { tenant: Tenant; requestId: string; startTime: number }): QualityMeta {
  return {
    freshness_seconds: Math.floor((Date.now() - ctx.startTime) / 1000),
    source_uptime_7d: 0.98,
    confidence: 'high',
    certainty_score: 0.923,
  };
}

function buildResponseMeta(
  ctx: { tenant: Tenant; requestId: string; startTime: number },
  overrides?: Partial<{
    agent: string;
    action: string;
    authMethod: string;
    creditsCharged: number;
    cacheStatus: 'hit' | 'miss';
    durationMs: number;
  }>,
): ResponseMeta {
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
    agent: overrides?.agent ?? 'maplespike',
    action: overrides?.action ?? 'api-call',
    authMethod: overrides?.authMethod ?? 'api-key',
    creditsCharged: overrides?.creditsCharged ?? 0,
    cacheStatus: overrides?.cacheStatus ?? 'miss',
    durationMs: overrides?.durationMs ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/*  Token Optimization                                                 */
/* ------------------------------------------------------------------ */

/**
 * Apply token optimization to response data based on query options.
 * - _fields: return only named top-level fields of the data object
 * - _format: 'compact' strips null/empty fields recursively
 * - _limit: cap array elements
 */
function applyTokenOptimization<T>(
  data: T,
  opts: QueryOptions,
): T {
  let result: unknown = data;

  // _limit — cap arrays
  if (opts._limit && Array.isArray(result)) {
    result = (result as unknown[]).slice(0, opts._limit);
  }

  // _fields — filter top-level keys in the data object
  if (opts._fields && result !== null && typeof result === 'object' && !Array.isArray(result)) {
    const obj = result as Record<string, unknown>;
    const filtered: Record<string, unknown> = {};
    for (const key of opts._fields) {
      if (key in obj) {
        filtered[key] = obj[key];
      }
    }
    result = filtered;
  }

  // _format: compact — strip null / empty fields
  if (opts._format === 'compact') {
    result = stripNulls(result);
  }

  // _summary — return aggregate stats if data is an array
  if (opts._summary && Array.isArray(result)) {
    const items = result as Record<string, unknown>[];
    if (items.length > 0) {
      result = {
        count: items.length,
        fields: Object.keys(items[0]),
        sample: items.slice(0, 3),
      };
    } else {
      result = { count: 0, fields: [], sample: [] };
    }
  }

  // TODO: _normalize — normalize field names across sources
  // TODO: _units — unit conversion (metric/imperial) for numeric fields

  return result as T;
}

/**
 * Recursively strip null, undefined, and empty string values from an object.
 * Preserves arrays (just filters out null entries).
 */
function stripNulls(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value === '') return undefined;
  if (Array.isArray(value)) {
    const cleaned = value
      .map(stripNulls)
      .filter((v) => v !== undefined);
    return cleaned.length > 0 ? cleaned : undefined;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      const cleaned = stripNulls(val);
      if (cleaned !== undefined) {
        result[key] = cleaned;
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }
  return value;
}

/* ------------------------------------------------------------------ */
/*  Response Builders (Public)                                         */
/* ------------------------------------------------------------------ */

export interface BuildContext {
  tenant: Tenant;
  requestId: string;
  startTime: number;
  queryOptions?: QueryOptions;
  metaOverrides?: Partial<{
    agent: string;
    action: string;
    authMethod: string;
    creditsCharged: number;
    cacheStatus: 'hit' | 'miss';
    durationMs: number;
  }>;
}

export function buildSuccess<T>(
  data: T,
  ctx: BuildContext,
  extraCitation?: Partial<CitationMeta> | null,
): ApiResponse<T> {
  const optimizedData = ctx.queryOptions
    ? applyTokenOptimization(data, ctx.queryOptions)
    : data;

  return {
    success: true,
    data: optimizedData,
    text: null,
    error: null,
    meta: buildResponseMeta(ctx, ctx.metaOverrides),
    quality: buildQualityMeta(ctx),
    citation: extraCitation
      ? { ...OGL_C_CITATION, ...extraCitation }
      : OGL_C_CITATION,
  };
}

export function buildError(
  code: string,
  message: string,
  ctx: BuildContext,
  statusCode?: number,
): ApiResponse<null> {
  return {
    success: false,
    data: null,
    text: null,
    error: { code, message },
    meta: buildResponseMeta(ctx, ctx.metaOverrides),
    quality: buildQualityMeta(ctx),
    citation: OGL_C_CITATION,
  };
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
      'Cache-Control': 'no-cache, no-store, must-revalidate',
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

/* ------------------------------------------------------------------ */
/*  Rate Limit Reset Calculation                                       */
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
