/**
 * CivInt Canada — Response Envelope
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
/*  HTTP Response Helpers                                              */
/* ------------------------------------------------------------------ */

export function jsonResponse<T>(body: ApiResponse<T>, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-CivInt-Version': '0.1.0',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CivInt-Mode',
    },
  });
}

export function corsPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CivInt-Mode',
      'Access-Control-Max-Age': '86400',
    },
  });
}
