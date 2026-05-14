/**
 * MapleSpike — API Gateway (Worker Entry)
 *
 * Cloudflare Workers fetch handler + Node.js dev server compatible.
 * Multi-tenant REST API gateway wrapping pipeline-core.
 *
 * Architecture:
 *   Request → Auth middleware → Rate limit → Route dispatch → Response envelope
 *
 * Katzilla-quality response envelope with:
 *   - Quality meta (freshness, confidence, certainty)
 *   - Citation envelope
 *   - Token optimization params (_fields, _format, _limit, _mock, etc.)
 *   - Cache tracking (hit/miss)
 *   - Duration tracking
 */

import type { Env, RouteHandler, RouteContext, ApiResponse } from './types.js';
import { TIER_LIMITS, parseQueryOptions } from './types.js';
import type { QueryOptions } from './types.js';
import { authenticateRequest } from './auth.js';
import { checkRateLimit } from './rate-limit.js';
import {
  buildError,
  buildSuccess,
  jsonResponse,
  corsPreflight,
  addRateLimitHeaders,
} from './response.js';
import type { BuildContext } from './response.js';
import { loadConfig } from './config.js';
import { D1Storage, KVCache } from './storage.js';
import type { MapleSpikeStorage, MapleSpikeCache } from './types.js';
import { globalCache } from './cache.js';
import { recordIngestion, getFreshness, getConfidence, getCertainty } from './freshness.js';
import { getMockData } from './mock-data.js';
import { MOCK_DATA_SOURCES, ALL_MOCK_CATEGORIES } from './mock-data.js';
export type { ApiResponse } from './types.js';
export type { QueryOptions } from './types.js';

interface Route {
  pattern: RegExp;
  method: string;
  params: string[];
  handler: RouteHandler;
}

import { healthHandler } from './routes/health.js';
import { listReleasesHandler, searchGovHandler, dataHandler } from './routes/gov.js';
import { getCitationHandler } from './routes/citation.js';
import { auditQueryHandler } from './routes/audit.js';
import { usageHandler } from './routes/usage.js';
import { openApiHandler } from './routes/openapi.js';
import { registerHandler, meHandler } from './routes/register.js';
import { web3ChallengeHandler, web3LoginHandler } from './routes/auth-web3.js';
import {
  oauthLoginHandler,
  oauthCallbackHandler,
  oauthProvidersHandler,
} from './routes/auth-oauth.js';
import {
  passkeyRegisterBeginHandler,
  passkeyRegisterCompleteHandler,
  passkeyLoginBeginHandler,
  passkeyLoginCompleteHandler,
  passkeyListHandler,
  passkeyDeleteHandler,
} from './routes/auth-passkey.js';
// signalsHandler is lazy-loaded dynamically — see ROUTES
import { listKeysHandler, createKeyHandler, deleteKeyHandler, rotateKeyHandler } from './routes/keys.js';
import {
  githubLoginHandler,
  githubCallbackHandler,
  refreshTokenHandler,
  logoutHandler,
  meHandler as authMeHandler,
} from './auth/github.js';

const ROUTES: Route[] = [
  { pattern: /^\/v1\/health\/?$/, method: 'GET', params: [], handler: healthHandler },
  { pattern: /^\/v1\/register\/?$/, method: 'POST', params: [], handler: registerHandler },
  { pattern: /^\/v1\/me\/?$/, method: 'GET', params: [], handler: meHandler },
  { pattern: /^\/v1\/gov\/releases\/?$/, method: 'GET', params: [], handler: listReleasesHandler },
  { pattern: /^\/v1\/gov\/search\/?$/, method: 'GET', params: [], handler: searchGovHandler },
  { pattern: /^\/v1\/gov\/data\/?$/, method: 'GET', params: [], handler: dataHandler },
  { pattern: /^\/v1\/citation\/([^/]+)\/?$/, method: 'GET', params: ['id'], handler: getCitationHandler },
  { pattern: /^\/v1\/audit\/query\/?$/, method: 'POST', params: [], handler: auditQueryHandler },
  { pattern: /^\/v1\/usage\/?$/, method: 'GET', params: [], handler: usageHandler },
  { pattern: /^\/v1\/keys\/?$/, method: 'GET', params: [], handler: listKeysHandler },
  { pattern: /^\/v1\/keys\/?$/, method: 'POST', params: [], handler: createKeyHandler },
  { pattern: /^\/v1\/keys\/([^/]+)\/?$/, method: 'DELETE', params: ['id'], handler: deleteKeyHandler },
  { pattern: /^\/v1\/keys\/([^/]+)\/rotate\/?$/, method: 'POST', params: ['id'], handler: rotateKeyHandler },
  { pattern: /^\/v1\/openapi\.json\/?$/, method: 'GET', params: [], handler: openApiHandler },
  { pattern: /^\/v1\/?$/, method: 'GET', params: [], handler: openApiHandler }, // Root redirect to spec

  // --- Auth routes ---
  // Generic OAuth
  { pattern: /^\/v1\/auth\/oauth\/providers\/?$/, method: 'GET', params: [], handler: oauthProvidersHandler },
  { pattern: /^\/v1\/auth\/oauth\/([^/]+)\/?$/, method: 'GET', params: ['provider'], handler: oauthLoginHandler },
  { pattern: /^\/v1\/auth\/oauth\/([^/]+)\/callback\/?$/, method: 'GET', params: ['provider'], handler: oauthCallbackHandler },
  // Legacy GitHub-specific (kept for backward compat)
  { pattern: /^\/v1\/auth\/github\/?$/, method: 'GET', params: [], handler: githubLoginHandler },
  { pattern: /^\/v1\/auth\/github\/callback\/?$/, method: 'GET', params: [], handler: githubCallbackHandler },
  { pattern: /^\/v1\/auth\/refresh\/?$/, method: 'POST', params: [], handler: refreshTokenHandler },
  { pattern: /^\/v1\/auth\/logout\/?$/, method: 'POST', params: [], handler: logoutHandler },
  { pattern: /^\/v1\/auth\/me\/?$/, method: 'GET', params: [], handler: authMeHandler },
  // Web3 wallet auth
  { pattern: /^\/v1\/auth\/web3\/challenge\/?$/, method: 'POST', params: [], handler: web3ChallengeHandler },
  { pattern: /^\/v1\/auth\/web3\/login\/?$/, method: 'POST', params: [], handler: web3LoginHandler },
  // Passkey / WebAuthn auth
  { pattern: /^\/v1\/auth\/passkey\/register\/begin\/?$/, method: 'POST', params: [], handler: passkeyRegisterBeginHandler },
  { pattern: /^\/v1\/auth\/passkey\/register\/complete\/?$/, method: 'POST', params: [], handler: passkeyRegisterCompleteHandler },
  { pattern: /^\/v1\/auth\/passkey\/login\/begin\/?$/, method: 'POST', params: [], handler: passkeyLoginBeginHandler },
  { pattern: /^\/v1\/auth\/passkey\/login\/complete\/?$/, method: 'POST', params: [], handler: passkeyLoginCompleteHandler },
  { pattern: /^\/v1\/auth\/passkey\/credentials\/?$/, method: 'GET', params: [], handler: passkeyListHandler },
  { pattern: /^\/v1\/auth\/passkey\/credentials\/([^/]+)\/?$/, method: 'DELETE', params: ['id'], handler: passkeyDeleteHandler },
];

/**
 * Map route handler to a source name for freshness tracking.
 */
function getSourceName(handler: RouteHandler): string {
  if (handler === listReleasesHandler || handler === searchGovHandler || handler === dataHandler) return 'open.canada.ca';
  // signals handler is dynamically loaded — not referenced here
  // Default source for freshness fallback
  return 'open.canada.ca';
}

function generateRequestId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return 'maplespike-' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Signals route handler — lazy-loaded via eval to avoid tsc following cross-package imports
ROUTES.push({
  pattern: /^\/v1\/signals\/?$/,
  method: 'GET',
  params: [],
  handler: (async (req: Request, ctx: RouteContext, params: Record<string, string>) => {
    try {
      const path = '../loaders/signals.js';
      const mod = await Function('path', 'return import(path)')(path);
      return mod.signalsHandler(req, ctx, params);
    } catch {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'NOT_AVAILABLE', message: 'Signals not available (engine not built)' },
      }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
  }) as unknown as RouteHandler,
});

function matchRoute(url: string, method: string): { route: Route; params: Record<string, string> } | null {
  const pathname = new URL(url, 'http://localhost').pathname;

  for (const route of ROUTES) {
    if (route.method !== method && method !== 'OPTIONS') continue;
    const match = pathname.match(route.pattern);
    if (match) {
      const params: Record<string, string> = {};
      route.params.forEach((name, i) => {
        params[name] = match[i + 1] || '';
      });
      return { route, params };
    }
  }

  return null;
}

export async function handleRequest(
  request: Request,
  env: Record<string, string | undefined>,
  db: MapleSpikeStorage,
  cache: MapleSpikeCache,
): Promise<Response> {
  const config = loadConfig(env);
  const requestId = generateRequestId();
  const startTime = Date.now();
  const url = new URL(request.url);
  const queryOptions = parseQueryOptions(url);

  // --- Mock mode ---
  // If _mock=true, return pre-cached sample data without any upstream calls
  if (queryOptions._mock) {
    return handleMockRequest(request, url, queryOptions);
  }

  // --- CORS preflight ---
  if (request.method === 'OPTIONS') {
    return corsPreflight();
  }

  const matched = matchRoute(request.url, request.method);
  if (!matched) {
    const ctx: BuildContext = {
      tenant: { id: 'anon', name: 'Anonymous', tier: 'free', isActive: true, journalismMode: false },
      requestId,
      startTime,
      queryOptions,
      metaOverrides: { cacheStatus: 'miss', durationMs: Date.now() - startTime },
    };
    return jsonResponse(buildError('NOT_FOUND', `No route matches ${request.method} ${new URL(request.url).pathname}`, ctx), 404);
  }

  const { route, params } = matched;

  // Authentication (public routes: health, openapi, register, github login/callback, refresh, logout)
  const authExempt = route.handler === healthHandler
    || route.handler === openApiHandler
    || route.handler === getCitationHandler
    || route.handler === registerHandler
    || route.handler === githubLoginHandler
    || route.handler === githubCallbackHandler
    || route.handler === refreshTokenHandler
    || route.handler === logoutHandler
    // Generic OAuth entry points
    || route.handler === oauthProvidersHandler
    || route.handler === oauthLoginHandler
    || route.handler === oauthCallbackHandler
    // Web3 + Passkey auth entry points
    || route.handler === web3ChallengeHandler
    || route.handler === web3LoginHandler
    || route.handler === passkeyRegisterBeginHandler
    || route.handler === passkeyRegisterCompleteHandler
    || route.handler === passkeyLoginBeginHandler
    || route.handler === passkeyLoginCompleteHandler;

  const tenant = authExempt
    ? null
    : await authenticateRequest(request, db);

  if (!tenant && !authExempt) {
    const ctx: BuildContext = {
      tenant: { id: 'anon', name: 'Anonymous', tier: 'free', isActive: true, journalismMode: false },
      requestId,
      startTime,
      queryOptions,
      metaOverrides: { cacheStatus: 'miss', durationMs: Date.now() - startTime },
    };
    return jsonResponse(buildError('UNAUTHORIZED', 'Valid API key required. Get one at https://maplespike.ca', ctx), 401);
  }

  const ctx: RouteContext = {
    tenant: tenant?.tenant || { id: 'anon', name: 'Anonymous', tier: 'free', isActive: true, journalismMode: false },
    apiKeyId: tenant?.apiKeyId || '',
    requestId,
    startTime,
    env,
    db,
    cache,
  };

  // Determine auth method from the AuthResult
  const authMethod: string = tenant?.authMethod || 'api-key';
  const tier = ctx.tenant.tier;
  const creditsCharged = tier === 'free' ? 0 : 1;

  // --- Cache check for regular requests ---
  const cacheKey = `${request.method}:${url.pathname}:${url.search}`;
  const cachedResponse = globalCache.get<string>(cacheKey);
  let cacheStatus: 'hit' | 'miss' = 'miss';

  if (cachedResponse) {
    cacheStatus = 'hit';
    const cached = JSON.parse(cachedResponse);
    // Update the meta on cached response with fresh timestamps
    cached.meta.cacheStatus = 'hit';
    cached.meta.timestamp = new Date().toISOString();
    cached.meta.durationMs = Date.now() - startTime;
    cached.meta.creditsCharged = creditsCharged;
    cached.meta.authMethod = authMethod;
    cached.quality.freshness_seconds = Math.floor((Date.now() - startTime) / 1000);
    return new Response(JSON.stringify(cached, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-MapleSpike-Version': '0.1.0',
        'X-Cache': 'hit',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-MapleSpike-Mode',
      },
    });
  }

  // Rate limit (skip for health and spec)
  let rateCheck: { allowed: boolean; remaining: number; resetTime: number } | null = null;
  if (route.handler !== healthHandler && route.handler !== openApiHandler) {
    // Stricter limits for unauthenticated requests
    const isAuthenticated = tenant !== null;
    const tierLimits = TIER_LIMITS[ctx.tenant.tier];
    const windowMs = 60 * 1000; // 1-minute sliding window for aggressive check
    const maxPerWindow = isAuthenticated ? tierLimits.daily : 5; // unauthenticated: 5/min max
    const check = checkRateLimit(ctx.tenant.id, maxPerWindow, windowMs);
    rateCheck = check;
    if (!check.allowed) {
      await db.logAudit({
        tenantId: ctx.tenant.id,
        apiKeyId: ctx.apiKeyId,
        operation: 'rate_limit',
        endpoint: route.pattern.source,
        outputSummary: 'Rate limited',
        confidence: null,
        success: false,
        durationMs: Date.now() - startTime,
      });

      const bc: BuildContext = {
        tenant: ctx.tenant,
        requestId,
        startTime,
        queryOptions,
        metaOverrides: {
          cacheStatus: 'miss',
          creditsCharged,
          authMethod,
          durationMs: Date.now() - startTime,
        },
      };
      const retryAfter = rateCheck ? Math.ceil((rateCheck.resetTime - Date.now()) / 1000) : 60;
      let response = jsonResponse(buildError('RATE_LIMITED', 'Rate limit exceeded. Try again later.', bc), 429, { 'Retry-After': String(Math.max(1, retryAfter)) });
      if (rateCheck) {
        response = addRateLimitHeaders(response, rateCheck);
      }
      return response;
    }
  }

  // ── Monthly quota check (hard cap for free, soft warning for paid) ──
  const now = new Date();
  const yearMonth = now.toISOString().slice(0, 7);
  const monthlyUsage = await db.getMonthlyUsage(ctx.tenant.id, yearMonth);
  const tierLimits = TIER_LIMITS[ctx.tenant.tier];

  if (monthlyUsage >= tierLimits.monthly) {
    await db.logAudit({
      tenantId: ctx.tenant.id,
      apiKeyId: ctx.apiKeyId,
      operation: 'quota_exhausted',
      endpoint: route.pattern.source,
      outputSummary: 'Monthly quota exhausted',
      confidence: null,
      success: false,
      durationMs: Date.now() - startTime,
    });

    const bc: BuildContext = {
      tenant: ctx.tenant,
      requestId,
      startTime,
      queryOptions,
      metaOverrides: {
        cacheStatus: 'miss',
        creditsCharged,
        authMethod,
        durationMs: Date.now() - startTime,
      },
    };

    if (ctx.tenant.tier === 'free') {
      // Hard cap — reject
      const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const retryAfter = Math.floor((resetDate.getTime() - now.getTime()) / 1000);
      let response = jsonResponse(
        buildError('QUOTA_EXHAUSTED',
          'Monthly API call limit reached. Upgrade to Pro for more calls at https://maplespike.ca/pricing',
          bc),
        402,
        { 'Retry-After': String(retryAfter) },
      );
      if (rateCheck) response = addRateLimitHeaders(response, rateCheck);
      return response;
    }
    // Paid tiers: soft cap — warn via header but allow
    // (overage billing via Stripe metered usage to be implemented)
  }

  await db.incrementUsage(
    ctx.tenant.id,
    now.toISOString().slice(0, 10),
    yearMonth,
  );

  try {
    const start = Date.now();
    const response = await route.handler(request, ctx, params);
    const durationMs = Date.now() - start;

    // Update the build context with meta from this request
    // The route handlers use buildSuccess/buildError from response.ts which
    // will pick up queryOptions from the BuildContext if we pass it right.
    // Since the route handlers call buildSuccess() themselves with `ctx`,
    // and they pass the RouteContext (not BuildContext), we need to intercept
    // and wrap responses going forward.

    // For now, we parse the response body and re-wrap it with our new envelope.
    // This is a compatibility shim — route handlers will be migrated gradually.
    const responseBody = await response.text();
    let parsedBody: Record<string, unknown> | null = null;
    try {
      parsedBody = JSON.parse(responseBody);
    } catch {
      // If it's not JSON, pass through as-is
      let finalResponse = response;
      if (rateCheck) {
        finalResponse = addRateLimitHeaders(response, rateCheck);
      }
      return finalResponse;
    }

    // Record ingestion for freshness tracking
    const sourceName = getSourceName(route.handler);
    recordIngestion(sourceName);

    // Build new envelope with existing data
    const buildCtx: BuildContext = {
      tenant: ctx.tenant,
      requestId,
      startTime,
      queryOptions,
      metaOverrides: {
        cacheStatus,
        creditsCharged,
        authMethod,
        durationMs,
        action: url.pathname.replace('/v1/', '').replace(/\//g, '-') || 'api-call',
      },
    };

    // Determine freshness and quality based on source
    const freshness = getFreshness(sourceName);
    const confidence = getConfidence(sourceName);
    const certainty = getCertainty(sourceName);

    // Extract citation if present in old response
    const oldCitations = parsedBody?.citations as Array<Record<string, unknown>> | undefined;
    const citation = oldCitations && oldCitations.length > 0
      ? {
          source_name: (oldCitations[0].source as string) || sourceName,
          source_url: '',
          retrieved_at: new Date().toISOString(),
          data_hash: (oldCitations[0].hash as string) || '',
          license: (oldCitations[0].license as string) || 'https://open.canada.ca/en/open-government-licence-canada',
          update_frequency: 'daily',
        }
      : null;

    const newBody: Record<string, unknown> = {
      success: true,
      data: parsedBody?.data ?? null,
      text: null,
      error: parsedBody?.error ?? null,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        version: config.version,
        usage: {
          periodCalls: 0,
          periodLimit: TIER_LIMITS[tier]?.monthly || 1000,
          tier,
        },
        agent: 'maplespike',
        action: url.pathname.replace('/v1/', '').replace(/\//g, '-') || 'api-call',
        authMethod,
        creditsCharged,
        cacheStatus,
        durationMs,
      },
      quality: {
        freshness_seconds: freshness === Infinity ? Math.floor(durationMs / 1000) : freshness,
        source_uptime_7d: 0.98,
        confidence,
        certainty_score: certainty,
      },
      citation,
    };

    // Apply token optimization to response data
    if (queryOptions._fields && newBody.data && typeof newBody.data === 'object' && !Array.isArray(newBody.data)) {
      const filtered: Record<string, unknown> = {};
      for (const key of queryOptions._fields) {
        if (key in (newBody.data as Record<string, unknown>)) {
          filtered[key] = (newBody.data as Record<string, unknown>)[key];
        }
      }
      newBody.data = filtered;
    }

    if (queryOptions._format === 'compact') {
      newBody.data = compactObject(newBody.data);
    }

    // Cap array data if _limit
    if (queryOptions._limit && Array.isArray(newBody.data)) {
      newBody.data = (newBody.data as unknown[]).slice(0, queryOptions._limit);
    }

    // Cache successful responses for 60 seconds
    if (response.status < 500) {
      globalCache.set(cacheKey, JSON.stringify(newBody), 60);
    }

    let finalResponse = jsonResponse(newBody as unknown as ApiResponse, response.status);
    if (rateCheck) {
      finalResponse = addRateLimitHeaders(finalResponse, rateCheck);
    }

    if (tenant?.rotatedKey) {
      finalResponse = new Response(finalResponse.body, {
        status: finalResponse.status,
        headers: new Headers(finalResponse.headers),
      });
      finalResponse.headers.set('X-Key-Rotated', 'true');
      finalResponse.headers.set('X-New-Key-Id', tenant.rotatedKey.id);
      finalResponse.headers.set('X-New-Key', tenant.rotatedKey.key);
      finalResponse.headers.set('X-New-Key-Expires', tenant.rotatedKey.expiresAt);
    }

    // Log audit for mutations
    if (request.method === 'POST') {
      await db.logAudit({
        tenantId: ctx.tenant.id,
        apiKeyId: ctx.apiKeyId,
        operation: 'api_call',
        endpoint: new URL(request.url).pathname,
        outputSummary: `${response.status} in ${durationMs}ms`,
        confidence: null,
        success: response.status < 500,
        durationMs,
      });
    }

    return finalResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const errorCode = err instanceof TypeError
      ? 'BAD_REQUEST'
      : err instanceof SyntaxError
        ? 'PARSE_ERROR'
        : (err as any)?.code === 'NOT_FOUND'
          ? 'NOT_FOUND'
          : 'INTERNAL_ERROR';
    const statusCode = err instanceof TypeError
      ? 400
      : err instanceof SyntaxError
        ? 400
        : 500;

    // Log full error details
    console.error(`[API] ${errorCode} (${requestId}):`, message);
    if (err instanceof Error && (err as any).stack) {
      console.error(`[API] Stack:`, (err as any).stack?.split('\n').slice(0, 6).join('\n'));
    }

    const bc: BuildContext = {
      tenant: ctx.tenant,
      requestId,
      startTime,
      queryOptions,
      metaOverrides: {
        cacheStatus: 'miss',
        creditsCharged,
        authMethod,
        durationMs: Date.now() - startTime,
      },
    };
    let response = jsonResponse(buildError(errorCode, message, bc), statusCode);
    if (rateCheck) {
      response = addRateLimitHeaders(response, rateCheck);
    }
    return response;
  }
}

/**
 * Handle a mock request — returns cached sample data, free, no upstream hit.
 * Route pattern: /v1/mock/:category
 */
async function handleMockRequest(
  request: Request,
  url: URL,
  queryOptions: QueryOptions,
): Promise<Response> {
  // Determine which data source to mock based on path
  const pathParts = url.pathname.replace(/^\/v1\//, '').split('/');
  const category = pathParts[0] === 'mock' && pathParts[1]
    ? pathParts[1]
    : pathParts[0] || 'committees';

  // If no specific category, return all mock data
  if (category === 'mock' || category === 'data') {
    const mockData = MOCK_DATA_SOURCES;
    const freshData = queryOptions._limit
      ? Object.fromEntries(
          Object.entries(mockData).map(([key, val]) => [
            key,
            Array.isArray(val) ? val.slice(0, queryOptions._limit) : val,
          ]),
        )
      : mockData;

    return jsonResponse({
      success: true,
      data: freshData,
      text: null,
      error: null,
      meta: {
        requestId: generateRequestId(),
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        usage: { periodCalls: 0, periodLimit: 1000, tier: 'free' },
        agent: 'maplespike',
        action: 'mock-data',
        authMethod: 'none',
        creditsCharged: 0,
        cacheStatus: 'hit',
        durationMs: 0,
      },
      quality: {
        freshness_seconds: 0,
        source_uptime_7d: 1.0,
        confidence: 'high',
        certainty_score: 0.99,
      },
      citation: {
        source_name: 'MapleSpike Mock Data',
        source_url: 'https://maplespike.ca/mock',
        retrieved_at: new Date().toISOString(),
        data_hash: 'sha256:mocked-sample-data-no-upstream-call',
        license: 'Sample Data — Not for Production Use',
        update_frequency: 'manual',
      },
    });
  }

  // Return specific category mock data
  const mockArray = getMockData(category);
  if (mockArray.length === 0) {
    // If category not found, return ALL mock data as a fallback
    const mockData = MOCK_DATA_SOURCES;
    return jsonResponse({
      success: true,
      data: queryOptions._limit
        ? Object.fromEntries(
            Object.entries(mockData).map(([key, val]) => [
              key,
              Array.isArray(val) ? val.slice(0, queryOptions._limit) : val,
            ]),
          )
        : mockData,
      text: null,
      error: null,
      meta: {
        requestId: generateRequestId(),
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        usage: { periodCalls: 0, periodLimit: 1000, tier: 'free' },
        agent: 'maplespike',
        action: 'mock-data',
        authMethod: 'none',
        creditsCharged: 0,
        cacheStatus: 'hit',
        durationMs: 0,
      },
      quality: {
        freshness_seconds: 0,
        source_uptime_7d: 1.0,
        confidence: 'high',
        certainty_score: 0.99,
      },
      citation: {
        source_name: 'MapleSpike Mock Data',
        source_url: 'https://maplespike.ca/mock',
        retrieved_at: new Date().toISOString(),
        data_hash: 'sha256:mocked-sample-data-no-upstream-call',
        license: 'Sample Data — Not for Production Use',
        update_frequency: 'manual',
      },
    });
  }

  let data = mockArray;

  // Apply _limit
  if (queryOptions._limit) {
    data = data.slice(0, queryOptions._limit);
  }

  // Apply _fields
  if (queryOptions._fields) {
    data = data.map((item: unknown) => {
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        const filtered: Record<string, unknown> = {};
        for (const key of queryOptions._fields!) {
          if (key in obj) filtered[key] = obj[key];
        }
        return filtered;
      }
      return item;
    });
  }

  // Apply _format compact
  let finalData: unknown = data;
  if (queryOptions._format === 'compact') {
    finalData = compactObject(data);
  }

  return jsonResponse({
    success: true,
    data: finalData,
    text: null,
    error: null,
    meta: {
      requestId: generateRequestId(),
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      usage: { periodCalls: 0, periodLimit: 1000, tier: 'free' },
      agent: 'maplespike',
      action: `mock-${category}`,
      authMethod: 'none',
      creditsCharged: 0,
      cacheStatus: 'hit',
      durationMs: 0,
    },
    quality: {
      freshness_seconds: 0,
      source_uptime_7d: 1.0,
      confidence: 'high',
      certainty_score: 0.99,
    },
    citation: {
      source_name: 'MapleSpike Mock Data',
      source_url: 'https://maplespike.ca/mock',
      retrieved_at: new Date().toISOString(),
      data_hash: 'sha256:mocked-sample-data-no-upstream-call',
      license: 'Sample Data — Not for Production Use',
      update_frequency: 'manual',
    },
  });
}

/**
 * Recursively remove null and empty fields from an object/array.
 */
function compactObject(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value === '') return undefined;
  if (Array.isArray(value)) {
    const cleaned = value
      .map(compactObject)
      .filter((v) => v !== undefined);
    return cleaned.length > 0 ? cleaned : undefined;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      const cleaned = compactObject(val);
      if (cleaned !== undefined) {
        result[key] = cleaned;
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }
  return value;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const db = new D1Storage(env.DB);
    const cache = new KVCache(env.CACHE);
    const envVars: Record<string, string | undefined> = {
      ENVIRONMENT: env.ENVIRONMENT,
      CIVINT_VERSION: env.CIVINT_VERSION,
      CIVINT_NAME: env.CIVINT_NAME,
      FREE_LIMIT: env.FREE_LIMIT,
      PRO_LIMIT: env.PRO_LIMIT,
      BUSINESS_LIMIT: env.BUSINESS_LIMIT,
      AI_ENDPOINT: env.AI_ENDPOINT,
      AI_MODEL: env.AI_MODEL,
    };
    return handleRequest(request, envVars, db, cache);
  },
};
