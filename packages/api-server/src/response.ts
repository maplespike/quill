/**
 * Quill — Response Envelope
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
import { normalizeFields, convertUnits } from './utils/normalize.js';
import { randomUUID } from 'node:crypto';
import { applySecurityHeaders } from './middleware/security-headers.js';
import { buildBilingualError, detectLocale } from './error-codes.js';
import type { BilingualError } from './error-codes.js';

export type { CitationMeta, QualityMeta };

/* ------------------------------------------------------------------ */
/*  Default Citation                                                   */
/* ------------------------------------------------------------------ */

export const UNKNOWN_SOURCE_CITATION: CitationMeta = {
  source_name: 'Source not specified for this response',
  source_url: '',
  retrieved_at: null,
  data_hash: '',
  license: 'No publisher license declaration was supplied for this response. Quill grants no reuse rights; consult the original source terms.',
  license_basis: 'no-publisher-declaration',
  update_frequency: 'not supplied',
};

/* ------------------------------------------------------------------ */
/*  Citation Text Builders — generates ready-to-paste strings          */
/* ------------------------------------------------------------------ */

/**
 * Generates citation_text and citation_footnote from raw citation fields.
 * These are ready-to-paste strings AI agents can use directly without
 * formatting — matches the Katzilla pattern for AI-agent-friendly citations.
 */
const PAYLOAD_ATTRIBUTION_KEYS = ['attribution', 'attribution_text', 'attributionText'] as const;
const RECORD_LIST_KEYS = ['releases', 'records', 'results', 'items'] as const;

function trimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function attributionOnRecord(record: Record<string, unknown>): string | null {
  for (const key of PAYLOAD_ATTRIBUTION_KEYS) {
    const text = trimmedString(record[key]);
    if (text) return text;
  }
  return null;
}

/**
 * Attribution the payload already carries. An envelope `attribution` wins.
 * A list is used only when every record states the same attribution.
 */
export function attributionOnPayload(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const obj = data as Record<string, unknown>;
  const direct = attributionOnRecord(obj);
  if (direct) return direct;
  for (const key of RECORD_LIST_KEYS) {
    const list = obj[key];
    if (!Array.isArray(list) || list.length === 0) continue;
    const texts: string[] = [];
    let usable = true;
    for (const item of list) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        usable = false;
        break;
      }
      const text = attributionOnRecord(item as Record<string, unknown>);
      if (!text) {
        usable = false;
        break;
      }
      texts.push(text);
    }
    if (!usable) continue;
    const unique = new Set(texts);
    if (unique.size === 1) return texts[0];
  }
  return null;
}

function sourceNameFromAttribution(attribution: string): string {
  const match = /^Source:\s*([^.]+)/.exec(attribution);
  const name = match?.[1]?.trim().replace(/,\s*$/, '');
  if (name) return name;
  return 'Publisher attribution supplied with this response';
}

function citationFromAttribution(attribution: string): CitationMeta {
  return {
    source_name: sourceNameFromAttribution(attribution),
    source_url: '',
    retrieved_at: null,
    data_hash: '',
    license: attribution,
    license_basis: 'source-configuration',
    attribution_text: attribution,
    update_frequency: 'not supplied',
  };
}

export function enrichCitation(meta: CitationMeta): CitationMeta {
  if (meta.citation_text && meta.citation_footnote) return meta;
  const d = meta.retrieved_at ? new Date(meta.retrieved_at) : null;
  const dateStr = d && Number.isFinite(d.getTime()) ? d.toISOString().split('T')[0] : null;
  const month = d && Number.isFinite(d.getTime()) ? d.toLocaleString('en', { month: 'short', timeZone: 'UTC' }) : null;
  const year = d && Number.isFinite(d.getTime()) ? d.getUTCFullYear() : null;
  return {
    ...meta,
    original_format: meta.original_format || 'JSON',
    citation_text: meta.citation_text
      || `${meta.source_name}${dateStr ? `, retrieved ${dateStr}` : ''}. ${meta.license}. ${meta.source_url}`,
    citation_footnote: meta.citation_footnote
      || (month && year ? `${meta.source_name}, ${month} ${year}` : meta.source_name),
  };
}

/* ------------------------------------------------------------------ */
/*  Builders — Internal                                                */
/* ------------------------------------------------------------------ */

export function buildQualityMeta(ctx: { tenant: Tenant; requestId: string; startTime: number }): QualityMeta {
  return {
    freshness_seconds: Math.floor((Date.now() - ctx.startTime) / 1000),
    source_uptime_7d: 0.98,
    confidence: 'high',
    certainty_score: 0.923,
    last_verified: undefined,
    data_completeness: 'complete',
  };
}

function buildResponseMeta(
  ctx: { tenant: Tenant; requestId: string; startTime: number },
  overrides?: Partial<{
    agent: string;
    action: string;
    authMethod: string;
    creditsCharged: number;
    cacheStatus: 'hit' | 'miss' | 'mock';
    durationMs: number;
    usage: Partial<UsageMeta>;
  }>,
): ResponseMeta {
  const now = new Date().toISOString();
  return {
    requestId: ctx.requestId,
    timestamp: now,
    version: '0.1.0',
    usage: {
      // 0 unless the caller measured it. The gateway fills this from storage
      // on the paths that report usage (the Free-tier 402 body, /v1/usage);
      // nothing fills it behind the caller's back — see routes/usage.ts.
      periodCalls: overrides?.usage?.periodCalls ?? 0,
      periodLimit: overrides?.usage?.periodLimit ?? (TIER_LIMITS[ctx.tenant.tier]?.monthly || 1000),
      tier: overrides?.usage?.tier ?? ctx.tenant.tier,
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

  // _normalize — normalize field names across sources
  if (opts._normalize) {
    result = normalizeFields(result);
  }

  // _units — unit conversion (metric/imperial) for numeric fields
  if (opts._units && opts._units !== 'metric') {
    result = convertUnits(result, opts._units);
  }

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
    cacheStatus: 'hit' | 'miss' | 'mock';
    durationMs: number;
    usage: Partial<UsageMeta>;
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

  const payloadAttribution = extraCitation ? null : attributionOnPayload(data);
  const citation = extraCitation
    ? enrichCitation({ ...UNKNOWN_SOURCE_CITATION, ...extraCitation })
    : enrichCitation(payloadAttribution
      ? citationFromAttribution(payloadAttribution)
      : UNKNOWN_SOURCE_CITATION);

  return {
    success: true,
    data: optimizedData,
    text: null,
    error: null,
    meta: buildResponseMeta(ctx, ctx.metaOverrides),
    quality: buildQualityMeta(ctx),
    citation,
  };
}

export function buildError(
  code: string,
  message: string,
  ctx: BuildContext,
  statusCode?: number,
  details?: unknown[],
): ApiResponse<null> {
  // Look up bilingual error for this code
  const bilingual = buildBilingualError(code);
  return {
    success: false,
    data: null,
    text: null,
    error: {
      code,
      message,
      message_fr: bilingual.fr,
      ...(details ? { details } : {}),
    },
    meta: buildResponseMeta(ctx, ctx.metaOverrides),
    quality: buildQualityMeta(ctx),
    citation: UNKNOWN_SOURCE_CITATION,
  };
}

/* ------------------------------------------------------------------ */
/*  HTTP Response Helpers                                              */
/* ------------------------------------------------------------------ */

const CORS_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS';
const CORS_ALLOWED_HEADERS = 'Content-Type, Authorization, X-API-Key, X-MapleSpike-Mode';
const CORS_EXPOSE_HEADERS =
  'X-MapleSpike-Version, X-MapleSpike-Trace-Id, X-RateLimit-Remaining, X-RateLimit-Reset, X-Attribution-Notice';

/**
 * Apply the standard MapleSpike CORS headers to a response Headers instance.
 * Pulls the allowed origin from getAllowedOrigin() so dev and prod origins
 * stay in one place. Callers use applyCorsAndSecurityHeaders.
 */
export function applyCorsHeaders(
  headers: Headers,
  requestOrigin: string | null | undefined,
): void {
  headers.set('Access-Control-Allow-Origin', getAllowedOrigin(requestOrigin));
  headers.set('Access-Control-Allow-Methods', CORS_METHODS);
  headers.set('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS);
  headers.set('Access-Control-Expose-Headers', CORS_EXPOSE_HEADERS);
}

/**
 * Apply the CORS headers and the OWASP security headers together.
 *
 * The normal handler, the Redis cache hit, preflight, rate-limit
 * rejections, and server errors all call this helper. One function
 * keeps those paths from drifting apart.
 */
export function applyCorsAndSecurityHeaders(
  headers: Headers,
  requestOrigin: string | null | undefined,
  environment?: string,
): Headers {
  applySecurityHeaders(headers, environment);
  applyCorsHeaders(headers, requestOrigin);
  return headers;
}

/**
 * Origins allowed to read API responses.
 *
 * No private-network address belongs in this list. An operator who develops
 * against a LAN host sets `ALLOWED_ORIGINS_OVERRIDE` (see the tail of this
 * list) instead — a tracked file must not publish the network plan
 * (AGENTS.md; QUILL-AUDIT.md 2026-10-24, P2 "Internal addresses in 24 files").
 */
function buildAllowedOrigins(): string[] {
  return [
    // Dev
    'http://localhost:4321',
    'http://localhost:8082',
    'http://localhost:3001',
    'http://localhost:3000',
    'http://127.0.0.1:4321',
    'http://127.0.0.1:8082',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3000',
    // Production (maplespike.ca via Cloudflare)
    'https://maplespike.ca',
    'https://www.maplespike.ca',
    'https://data.maplespike.ca',
    'https://api.maplespike.ca',
    'https://api.data.maplespike.ca',
    'https://mcp.maplespike.ca',
    'https://quill.maplespike.ca',
    'https://www.quill.maplespike.ca',
    // Production (LAN)
    'https://quill.maplespike.ca',
    'https://www.quill.maplespike.ca',
    'https://api.maplespike.ca',
    'https://quill.maplespike.ca',
    'https://mcp.maplespike.ca',
    'https://portal.maplespike.ca',
    // In-cluster LAN aliases (.lan)
    'https://quill-api.lan',
    'https://quill-portal.lan',
    'https://quill-mcp.lan',
    'https://quill.lan',
    // Dev subdomains
    'https://dev.maplespike.ca',
    'https://dev-api.maplespike.ca',
    'https://dev-mcp.maplespike.ca',
    // LAN aliases
    'https://quill.maplespike.ca',
    'https://quill.maplespike.ca',
    // Auto-derived from MAPLESPIKE_DOMAIN env var
    ...(() => {
      const d = process.env.MAPLESPIKE_DOMAIN;
      if (!d) return [] as string[];
      return [
        `https://${d}`,
        `https://api.${d}`,
        `https://mcp.${d}`,
        `https://portal.${d}`,
        `https://dev.${d}`,
        `https://dev-api.${d}`,
        `https://dev-mcp.${d}`,
    ];
  })(),
  // Operator-supplied extra origins — comma-separated env var.
  // Use for self-hosters running on custom domains not covered by the
  // hardcoded list or MAPLESPIKE_DOMAIN. Example:
  //   ALLOWED_ORIGINS_OVERRIDE="https://portal.foo.com,https://api.foo.com"
  ...(process.env.ALLOWED_ORIGINS_OVERRIDE
    ? process.env.ALLOWED_ORIGINS_OVERRIDE
        .split(',')
        .map((s) => s.trim().replace(/\/$/, ''))
        .filter(Boolean)
    : []),
  ];
}

// Rebuilt when the two env vars that shape the list change, so a test (or a
// long-lived process) never serves a list computed for a different config.
let cachedOrigins: { key: string; list: string[] } | null = null;

function allowedOrigins(): string[] {
  const key = `${process.env.MAPLESPIKE_DOMAIN ?? ''}|${process.env.ALLOWED_ORIGINS_OVERRIDE ?? ''}`;
  if (cachedOrigins?.key !== key) cachedOrigins = { key, list: buildAllowedOrigins() };
  return cachedOrigins.list;
}

export function getAllowedOrigin(requestOrigin: string | null | undefined): string {
  if (!requestOrigin) return 'null';
  const normalized = requestOrigin.replace(/\/$/, '');
  if (allowedOrigins().includes(normalized)) return normalized;
  return 'null';
}

export function jsonResponse<T>(
  body: ApiResponse<T>,
  status = 200,
  extraHeaders: Record<string, string> = {},
  requestOrigin?: string | null,
  environment?: string,
): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'X-MapleSpike-Version': '0.1.0',
    'X-MapleSpike-Trace-Id': extraHeaders['X-MapleSpike-Trace-Id'] ?? randomUUID(),
    ...extraHeaders,
  };

  // Apply OWASP security headers and CORS through the shared helper.
  const head = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    head.set(key, value);
  }
  applyCorsAndSecurityHeaders(head, requestOrigin, environment);

  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: head,
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

export function corsPreflight(requestOrigin?: string | null, environment?: string): Response {
  const headers = new Headers();
  applyCorsAndSecurityHeaders(headers, requestOrigin ?? null, environment);
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(null, { status: 204, headers });
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
