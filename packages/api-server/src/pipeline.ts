// SPDX-License-Identifier: Apache-2.0
/**
 * Quill — Gateway Request Pipeline
 *
 * One request's journey to a response:
 *
 *   CORS preflight → TLS → body size → route match → key gate
 *     → Free-tier boundary → rate limit → handler → envelope
 *
 * Each stage is a function below, so a stage can be read and changed on its own;
 * `handleRequest` is the order they run in and nothing else.
 */

import type { QuillStorage, QuillCache, RouteContext, QueryOptions, Tenant } from './types.js';
import { TIER_LIMITS, parseQueryOptions } from './types.js';
import type { BuildContext } from './response.js';
import {
  buildError,
  jsonResponse,
  corsPreflight,
  addRateLimitHeaders,
  applyCorsHeaders,
} from './response.js';
import { applySecurityHeaders } from './middleware/security-headers.js';
import { addAttributionHeader } from './middleware/attribution.js';
import { authenticateRequest } from './auth.js';
import { enforceRateLimit } from './rate-limit.js';
import { freeTierBlocked, rateLimitKeyFor, requiresAuthentication, skipsRateLimit } from './request-policy.js';
import { matchRoute } from './route-registry.js';
import type { Route } from './route-registry.js';
import { loadConfig } from './config.js';
import { initEmailConfig } from './email.js';
import logger from './logger.js';

/** The tenant a request is served as before anything authenticates it. */
const ANON_TENANT: Tenant = {
  id: 'anon',
  name: 'Anonymous',
  emailVerified: false,
  tier: 'free',
  isActive: true,
  journalismMode: false,
};

/**
 * What the pipeline knows about one request before it is routed: the parsed
 * URL, identity and timing for the envelope, and where the reply is going.
 */
interface RequestInFlight {
  url: URL;
  requestId: string;
  startTime: number;
  queryOptions: QueryOptions;
  environment: string | undefined;
  requestOrigin: string | null;
}

function generateRequestId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return 'maplespike-' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Wrap every outgoing response with security and CORS headers. */
export function finalizeResponse(
  response: Response,
  environment?: string,
  requestOrigin: string | null | undefined = undefined,
): Response {
  const headers = new Headers(response.headers);
  applySecurityHeaders(headers, environment);
  applyCorsHeaders(headers, requestOrigin);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** The envelope context for a request nothing has authenticated. */
function anonContext(flight: RequestInFlight, durationMs: number): BuildContext {
  return {
    tenant: { ...ANON_TENANT },
    requestId: flight.requestId,
    startTime: flight.startTime,
    queryOptions: flight.queryOptions,
    metaOverrides: { cacheStatus: 'miss', durationMs },
  };
}

/**
 * Read a tenant's current monthly call count for the response envelope.
 *
 * Returns 0 when the storage read fails: a blocked request must still return
 * its 402 with the tier boundary intact, never a 500 caused by the
 * informational meta.usage summary.
 */
async function readPeriodCalls(db: QuillStorage, tenantId: string): Promise<number> {
  try {
    const yearMonth = new Date().toISOString().slice(0, 7);
    return await db.getMonthlyUsage(tenantId, yearMonth);
  } catch (err) {
    logger.warn(
      { errorType: err instanceof Error ? err.name : 'unknown' },
      'Usage read failed — meta.usage.periodCalls reported as 0',
    );
    return 0;
  }
}

/**
 * The URL to redirect to when an ingress reports the request arrived over
 * plain HTTP. 307 preserves the method and body through the redirect.
 */
function insecureRedirectUrl(request: Request, flight: RequestInFlight): string | null {
  const forwardedProto = request.headers.get('X-Forwarded-Proto');
  if (!forwardedProto || forwardedProto === 'https') return null;
  const httpsUrl = new URL(flight.url);
  httpsUrl.protocol = 'https:';
  return httpsUrl.toString();
}

/**
 * 413 for a body over 1 MiB, before any handler sees it. Content-Length is the
 * earliest signal, and on Cloudflare Workers it reflects the body the runtime
 * will actually stream. 1 MiB matches the portal proxy (server.py:22) and the
 * citation claim-verification route.
 */
function oversizedBody(request: Request, flight: RequestInFlight): Response | null {
  const { method } = request;
  if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH') return null;

  const declared = request.headers.get('content-length');
  // A malformed value parses to NaN, which is not over the limit either.
  const bytes = declared === null ? 0 : parseInt(declared, 10);
  if (bytes > 1_048_576) {
    logger.warn({ requestId: flight.requestId, contentLength: bytes }, 'Payload too large — 413');
    return jsonResponse(
      buildError(
        'PAYLOAD_TOO_LARGE',
        'Request body exceeds the 1 MiB limit.',
        anonContext(flight, Date.now() - flight.startTime),
      ),
      413,
      {},
      undefined,
      flight.environment,
    );
  }
  return null;
}

/** 404 for a method and path no route matches. */
function routeNotFound(request: Request, flight: RequestInFlight): Response {
  const durationMs = Date.now() - flight.startTime;
  logger.warn({ requestId: flight.requestId, durationMs }, 'Route not found');
  return jsonResponse(
    buildError('NOT_FOUND', `No route matches ${request.method} ${flight.url.pathname}`, anonContext(flight, durationMs)),
    404,
    {},
    undefined,
    flight.environment,
  );
}

/** 401 when a route requires a key and none resolved. */
function unauthenticated(flight: RequestInFlight): Response {
  const durationMs = Date.now() - flight.startTime;
  logger.warn({ requestId: flight.requestId, durationMs }, 'Authentication failed');
  return jsonResponse(
    buildError(
      'UNAUTHORIZED',
      'Valid API key required. Get one at https://quill.maplespike.ca/signup',
      anonContext(flight, durationMs),
    ),
    401,
    {},
    flight.requestOrigin,
    flight.environment,
  );
}

/**
 * 402 for the Free-tier boundary (decision #803), with one audit row.
 *
 * The body is a Free tenant's window into its own consumption (#891): publish
 * the tenant's real monthly count in meta.usage, since a hardcoded zero told
 * every blocked customer they had used nothing.
 */
async function freeTierBlock(
  ctx: RouteContext,
  flight: RequestInFlight,
  path: string,
  authMethod: string,
): Promise<Response | null> {
  if (!freeTierBlocked(ctx.tenant.tier, path)) return null;

  const periodCalls = await readPeriodCalls(ctx.db, ctx.tenant.id);
  const limits = TIER_LIMITS[ctx.tenant.tier] || TIER_LIMITS.free;
  const durationMs = Date.now() - flight.startTime;
  const blocked: BuildContext = {
    tenant: ctx.tenant,
    requestId: flight.requestId,
    startTime: flight.startTime,
    queryOptions: flight.queryOptions,
    metaOverrides: {
      cacheStatus: 'miss',
      creditsCharged: 0,
      authMethod,
      durationMs,
      usage: {
        periodCalls,
        periodLimit: limits.monthly,
        tier: ctx.tenant.tier,
      },
    },
  };

  logger.warn({ requestId: flight.requestId, tier: 'free' }, 'Free-tier route blocked (upgrade required)');
  await ctx.db.logAudit({
    tenantId: ctx.tenant.id,
    apiKeyId: ctx.apiKeyId,
    operation: 'free_tier_block',
    endpoint: path,
    outputSummary: 'Blocked: requires Pro+ (data query / AI / tools)',
    confidence: null,
    success: false,
    durationMs,
  });

  return jsonResponse(
    buildError(
      'UPGRADE_REQUIRED',
      'This endpoint requires a Pro or Business plan. The Free tier includes discovery & metadata only (catalog, citations, compliance). Upgrade at https://quill.maplespike.ca/pricing',
      blocked,
    ),
    402,
    { 'Upgrade-Hint': 'pro' },
    flight.requestOrigin,
    flight.environment,
  );
}

/**
 * 429 from the limiter, with Retry-After, the limit headers every client reads,
 * and one audit row. Covers the successful path too: it returns null unless the
 * limiter says no.
 */
async function rateLimitBlock(
  ctx: RouteContext,
  flight: RequestInFlight,
  request: Request,
  route: Route,
  authMethod: string,
  isAuthenticated: boolean,
): Promise<Response | null> {
  const check = await enforceRateLimit(
    ctx.db,
    ctx.tenant.id,
    ctx.tenant.tier,
    isAuthenticated,
    rateLimitKeyFor(request, isAuthenticated ? ctx.tenant.id : null),
  );
  if (check.allowed) return null;

  const durationMs = Date.now() - flight.startTime;
  await ctx.db.logAudit({
    tenantId: ctx.tenant.id,
    apiKeyId: ctx.apiKeyId,
    operation: 'rate_limit',
    endpoint: route.pattern.source,
    outputSummary: `Rate limited (${check.reason})`,
    confidence: null,
    success: false,
    durationMs,
  });

  const limited: BuildContext = {
    tenant: ctx.tenant,
    requestId: flight.requestId,
    startTime: flight.startTime,
    queryOptions: flight.queryOptions,
    metaOverrides: {
      cacheStatus: 'miss',
      creditsCharged: ctx.tenant.tier === 'free' ? 0 : 1,
      authMethod,
      durationMs,
    },
  };
  const retryAfter = Math.ceil((check.resetTime - Date.now()) / 1000);
  const response = jsonResponse(
    buildError('RATE_LIMITED', `Rate limit exceeded (${check.reason}). Try again later.`, limited),
    429,
    { 'Retry-After': String(Math.max(1, retryAfter)) },
    undefined,
    flight.environment,
  );
  addRateLimitHeaders(response, check);
  addAttributionHeader(response);
  return response;
}

export async function handleRequest(
  request: Request,
  env: Record<string, string | undefined>,
  db: QuillStorage,
  cache: QuillCache,
): Promise<Response> {
  const url = new URL(request.url);
  const environment = loadConfig(env).environment || process.env.ENVIRONMENT;
  const flight: RequestInFlight = {
    url,
    requestId: generateRequestId(),
    startTime: Date.now(),
    queryOptions: parseQueryOptions(url),
    environment,
    requestOrigin: request.headers.get('Origin'),
  };
  const send = (response: Response) => finalizeResponse(response, environment, flight.requestOrigin);

  // Idempotent: loads SendGrid or console email config from env.
  initEmailConfig(env);
  logger.info({ requestId: flight.requestId, method: request.method }, 'Incoming request');

  if (request.method === 'OPTIONS') return send(corsPreflight(flight.requestOrigin, environment));

  const insecureUrl = insecureRedirectUrl(request, flight);
  if (insecureUrl) return send(Response.redirect(insecureUrl, 307));

  const tooLarge = oversizedBody(request, flight);
  if (tooLarge) return send(tooLarge);

  const matched = matchRoute(request.url, request.method);
  if (!matched) return send(routeNotFound(request, flight));

  const { route, params } = matched;
  const path = url.pathname;
  const mustAuthenticate = requiresAuthentication(route, path, request);
  const tenant = mustAuthenticate ? await authenticateRequest(request, db) : null;
  if (!tenant && mustAuthenticate) return send(unauthenticated(flight));

  // Tier comes from the tenant row: the DB is the only source of truth. The
  // Stripe webhook and the e-Transfer verify path write it, authenticate()
  // reads it, and no cache or cross-channel override sits between them.
  const ctx: RouteContext = {
    tenant: tenant?.tenant ?? { ...ANON_TENANT },
    apiKeyId: tenant?.apiKeyId ?? '',
    requestId: flight.requestId,
    startTime: flight.startTime,
    env,
    db,
    cache,
  };
  const authMethod = tenant?.authMethod || 'api-key';

  const blockedTier = await freeTierBlock(ctx, flight, path, authMethod);
  if (blockedTier) return send(blockedTier);

  if (!skipsRateLimit(path)) {
    const limited = await rateLimitBlock(ctx, flight, request, route, authMethod, tenant !== null);
    if (limited) return send(limited);
  }

  return send(await route.handler(request, ctx, params));
}
