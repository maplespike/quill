// SPDX-License-Identifier: Apache-2.0
/**
 * MapleSpike — API Gateway (Worker Entry)
 *
 * Cloudflare Workers fetch handler + Node.js dev server compatible.
 * Multi-tenant REST API gateway wrapping pipeline-core.
 *
 * Architecture:
 *   Request → Auth middleware → Rate limit → Route dispatch → Response envelope
 *
 * MapleSpike-quality response envelope with:
 *   - Quality meta (freshness, confidence, certainty)
 *   - Citation envelope
 *   - Token optimization params (_fields, _format, _limit, etc.)
 *   - Cache tracking (hit/miss)
 *   - Duration tracking
 */

import type { Env, RouteHandler, RouteContext, ApiResponse } from './types.js';
import { TIER_LIMITS, parseQueryOptions } from './types.js';
import type { QueryOptions } from './types.js';
import { authenticateRequest } from './auth.js';
import { checkRateLimit, checkKeyRateLimit, getQuotaResetTime } from './rate-limit.js';
import {
  buildError,
  buildSuccess,
  jsonResponse,
  corsPreflight,
  addRateLimitHeaders,
  addQuotaHeaders,
  getAllowedOrigin,
} from './response.js';
import type { BuildContext } from './response.js';
import { loadConfig, validateConfig } from './config.js';
import { D1Storage, KVCache } from './storage.js';
import type { MapleSpikeStorage, MapleSpikeCache } from './types.js';
import { globalCache } from './cache.js';
import { recordIngestion, getFreshness, getConfidence, getCertainty } from './freshness.js';
import { getMockData, MOCK_DATA_SOURCES, ALL_MOCK_CATEGORIES, MOCK_DATA_MAP } from './mock-data.js';
export type { ApiResponse } from './types.js';
export type { QueryOptions } from './types.js';
import { parseAgentAction, mockHandler } from './routes/mock.js';

interface Route {
  pattern: RegExp;
  method: string;
  params: string[];
  handler: RouteHandler;
}

import { healthHandler } from './routes/health.js';
import { listReleasesHandler, searchGovHandler } from './routes/gov.js';
import { getCitationHandler } from './routes/citation.js';
import { auditQueryHandler } from './routes/audit.js';
import { usageHandler } from './routes/usage.js';
import { openApiHandler } from './routes/openapi.js';
import { registerHandler, verifyHandler, meHandler } from './routes/register.js';
import { web3ChallengeHandler, web3LoginHandler } from './routes/auth-web3.js';
import { billingPlansHandler, billingCheckoutHandler } from './routes/billing.js';
import { stripeCheckoutHandler, stripeWebhookHandler } from './routes/billing-stripe.js';
import { cryptoQuoteHandler, cryptoVerifyHandler } from './routes/billing-crypto.js';
import { interacGenerateHandler, interacConfirmHandler } from './routes/billing-interac.js';
import { aiAskHandler, aiAnalyzeHandler } from './routes/ai.js';
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
import { onboardingHandler } from './routes/onboarding.js';
import { contactHandler } from './routes/contact.js';
import {
  githubLoginHandler,
  githubCallbackHandler,
  refreshTokenHandler,
  logoutHandler,
  meHandler as authMeHandler,
} from './auth/github.js';

const ROUTES: Route[] = [
  { pattern: /^\/v1\/health\/?$/, method: 'GET', params: [], handler: healthHandler },
  { pattern: /^\/v1\/onboarding\/?$/, method: 'GET', params: [], handler: onboardingHandler },
  { pattern: /^\/v1\/contact\/?$/, method: 'POST', params: [], handler: contactHandler },
  { pattern: /^\/v1\/register\/?$/, method: 'POST', params: [], handler: registerHandler },
  { pattern: /^\/v1\/verify\/([^/]+)\/?$/, method: 'GET', params: ['token'], handler: verifyHandler },
  { pattern: /^\/v1\/me\/?$/, method: 'GET', params: [], handler: meHandler },
  { pattern: /^\/v1\/gov\/releases\/?$/, method: 'GET', params: [], handler: listReleasesHandler },
  { pattern: /^\/v1\/gov\/search\/?$/, method: 'GET', params: [], handler: searchGovHandler },

  { pattern: /^\/v1\/citation\/([^/]+)\/?$/, method: 'GET', params: ['id'], handler: getCitationHandler },
  { pattern: /^\/v1\/audit\/query\/?$/, method: 'POST', params: [], handler: auditQueryHandler },
  { pattern: /^\/v1\/usage\/?$/, method: 'GET', params: [], handler: usageHandler },
  // Billing
  { pattern: /^\/v1\/billing\/plans\/?$/, method: 'GET', params: [], handler: billingPlansHandler },
  { pattern: /^\/v1\/billing\/checkout\/?$/, method: 'POST', params: [], handler: billingCheckoutHandler },
  // Billing - Stripe
  { pattern: /^\/v1\/billing\/stripe\/checkout\/?$/, method: 'POST', params: [], handler: stripeCheckoutHandler },
  { pattern: /^\/v1\/billing\/stripe\/webhook\/?$/, method: 'POST', params: [], handler: stripeWebhookHandler },
  // Billing - Crypto
  { pattern: /^\/v1\/billing\/crypto\/quote\/?$/, method: 'POST', params: [], handler: cryptoQuoteHandler },
  { pattern: /^\/v1\/billing\/crypto\/verify\/?$/, method: 'POST', params: [], handler: cryptoVerifyHandler },
  // Billing - Interac
  { pattern: /^\/v1\/billing\/interac\/generate\/?$/, method: 'POST', params: [], handler: interacGenerateHandler },
  { pattern: /^\/v1\/billing\/interac\/confirm\/?$/, method: 'POST', params: [], handler: interacConfirmHandler },
  // AI
  { pattern: /^\/v1\/ai_ask\/?$/, method: 'POST', params: [], handler: aiAskHandler }, // DEPRECATED: use /v1/ai/ask
  { pattern: /^\/v1\/ai\/ask\/?$/, method: 'POST', params: [], handler: aiAskHandler },
  { pattern: /^\/v1\/ai\/analyze\/?$/, method: 'POST', params: [], handler: aiAnalyzeHandler },
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
  if (handler === listReleasesHandler || handler === searchGovHandler) return 'open.canada.ca';
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
      const mod = await import('./loaders/signals.js');
      return mod.signalsHandler(req, ctx, params);
    } catch {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'NOT_AVAILABLE', message: 'Signals not available (engine not built)' },
      }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
  }) as unknown as RouteHandler,
});

// Graph route handler — entity relationship graph from engine
ROUTES.push({
  pattern: /^\/v1\/graph\/?$/,
  method: 'GET',
  params: [],
  handler: (async (req: Request, ctx: RouteContext, params: Record<string, string>) => {
    try {
      const mod = await import('./loaders/graph.js');
      return mod.graphHandler(req, ctx, params);
    } catch {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'NOT_AVAILABLE', message: 'Graph not available (engine not built)' },
      }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
  }) as unknown as RouteHandler,
});

// Briefs route handler — daily intelligence briefs from engine
ROUTES.push({
  pattern: /^\/v1\/briefs\/?$/,
  method: 'GET',
  params: [],
  handler: (async (req: Request, ctx: RouteContext, params: Record<string, string>) => {
    try {
      const mod = await import('./loaders/briefs.js');
      return mod.briefsHandler(req, ctx, params);
    } catch {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'NOT_AVAILABLE', message: 'Briefs not available (engine not built)' },
      }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
  }) as unknown as RouteHandler,
});

// Entities route handler — resolved persons + organizations
ROUTES.push({
  pattern: /^\/v1\/entities\/?$/,
  method: 'GET',
  params: [],
  handler: (async (req: Request, ctx: RouteContext, params: Record<string, string>) => {
    try {
      const mod = await import('./loaders/entities.js');
      return mod.entitiesHandler(req, ctx, params);
    } catch {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'NOT_AVAILABLE', message: 'Entities not available (engine not built)' },
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
  const requestOrigin = request.headers.get('Origin');

  // --- Mock mode ---
  // If _mock=true, return curated sample data for dev/testing
  if (queryOptions._mock) {
    return handleMockRequest(request, url, queryOptions);
  }

  // --- CORS preflight ---
  if (request.method === 'OPTIONS') {
    return corsPreflight(requestOrigin);
  }

  // --- TLS redirect (defense-in-depth) ---
  // If Caddy/ingress sets X-Forwarded-Proto, verify it's HTTPS
  // 307 preserves the HTTP method and body through the redirect.
  const forwardedProto = request.headers.get('X-Forwarded-Proto');
  if (forwardedProto && forwardedProto !== 'https') {
    const httpsUrl = new URL(request.url);
    httpsUrl.protocol = 'https:';
    return Response.redirect(httpsUrl.toString(), 307);
  }

  const matched = matchRoute(request.url, request.method);
  if (!matched) {
    const ctx: BuildContext = {
      tenant: { id: 'anon', name: 'Anonymous', emailVerified: false, tier: 'free', isActive: true, journalismMode: false },
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
    || route.handler === searchGovHandler
    || route.handler === openApiHandler
    || route.handler === getCitationHandler
    || route.handler === registerHandler
    || route.handler === billingPlansHandler
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
    || route.handler === passkeyLoginCompleteHandler
    // Contact form (no auth required)
    || route.handler === contactHandler;

  const tenant = authExempt
    ? null
    : await authenticateRequest(request, db);

  if (!tenant && !authExempt) {
    const ctx: BuildContext = {
      tenant: { id: 'anon', name: 'Anonymous', emailVerified: false, tier: 'free', isActive: true, journalismMode: false },
      requestId,
      startTime,
      queryOptions,
      metaOverrides: { cacheStatus: 'miss', durationMs: Date.now() - startTime },
    };
    return jsonResponse(buildError('UNAUTHORIZED', 'Valid API key required. Get one at https://maplespike.ca', ctx), 401);
  }

  const ctx: RouteContext = {
    tenant: tenant?.tenant || { id: 'anon', name: 'Anonymous', emailVerified: false, tier: 'free', isActive: true, journalismMode: false },
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
        'Access-Control-Allow-Origin': getAllowedOrigin(requestOrigin),
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-MapleSpike-Mode',
      },
    });
  }

  // Rate limit (skip for health and spec)
  let rateCheck: { allowed: boolean; remaining: number; resetTime: number; limit: number } | null = null;
  if (route.handler !== healthHandler && route.handler !== openApiHandler) {
    const isAuthenticated = tenant !== null;
    const tierLimits = TIER_LIMITS[ctx.tenant.tier];
    const windowMs = 60 * 1000; // 1-minute sliding window

    // Check per-key rate limit first (more granular)
    if (isAuthenticated && ctx.apiKeyId) {
      const keyLimit = tierLimits.perMinute;
      const keyCheck = checkKeyRateLimit(ctx.apiKeyId, keyLimit, windowMs);
      if (!keyCheck.allowed) {
        await db.logAudit({
          tenantId: ctx.tenant.id,
          apiKeyId: ctx.apiKeyId,
          operation: 'rate_limit',
          endpoint: route.pattern.source,
          outputSummary: `Per-key rate limited (${keyCheck.limit}/min)`,
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
        const retryAfter = Math.ceil((keyCheck.resetTime - Date.now()) / 1000);
        let response = jsonResponse(buildError('RATE_LIMITED', `API key rate limit exceeded (${keyCheck.limit} requests/minute).`, bc), 429, { 'Retry-After': String(Math.max(1, retryAfter)) });
        response = addRateLimitHeaders(response, keyCheck);
        return response;
      }
      rateCheck = keyCheck;
    }

    // Fallback to tenant-level rate limit for unauthenticated requests
    if (!isAuthenticated) {
      const maxPerWindow = 5; // unauthenticated: 5/min max
      const check = checkRateLimit(ctx.tenant.id, maxPerWindow, windowMs);
      rateCheck = { ...check, limit: maxPerWindow };
      if (!check.allowed) {
        await db.logAudit({
          tenantId: ctx.tenant.id,
          apiKeyId: ctx.apiKeyId,
          operation: 'rate_limit',
          endpoint: route.pattern.source,
          outputSummary: 'Rate limited (unauthenticated)',
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
  }

  // ── Monthly quota check + usage increment ──
  // Skip for public/infrastructure routes (health, spec, etc.)
  const isPublicRoute = route.handler === healthHandler || route.handler === openApiHandler;
  let quotaInfo: {
    monthlyLimit: number;
    monthlyRemaining: number;
    monthlyReset: string;
    dailyLimit: number;
    dailyRemaining: number;
    dailyReset: string;
  } | null = null;

  if (!isPublicRoute) {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const yearMonth = now.toISOString().slice(0, 7);
    const tierLimits = TIER_LIMITS[ctx.tenant.tier];

    // Get tenant-level usage
    const [monthlyUsage, dailyUsage] = await Promise.all([
      db.getMonthlyUsage(ctx.tenant.id, yearMonth),
      db.getDailyUsage(ctx.tenant.id, date),
    ]);

    // Get per-key usage if authenticated
    let keyMonthlyUsage = 0;
    let keyDailyUsage = 0;
    if (ctx.apiKeyId) {
      [keyMonthlyUsage, keyDailyUsage] = await Promise.all([
        db.getKeyMonthlyUsage(ctx.apiKeyId, yearMonth),
        db.getKeyDailyUsage(ctx.apiKeyId, date),
      ]);
    }

    // Monthly quota check (tenant-level)
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

    // Daily quota check
    if (dailyUsage >= tierLimits.daily) {
      await db.logAudit({
        tenantId: ctx.tenant.id,
        apiKeyId: ctx.apiKeyId,
        operation: 'daily_quota_exhausted',
        endpoint: route.pattern.source,
        outputSummary: 'Daily quota exhausted',
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
        const resetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
        const retryAfter = Math.floor((resetDate.getTime() - now.getTime()) / 1000);
        let response = jsonResponse(
          buildError('DAILY_QUOTA_EXHAUSTED',
            'Daily API call limit reached. Try again tomorrow or upgrade your plan.',
            bc),
          429,
          { 'Retry-After': String(Math.max(1, retryAfter)) },
        );
        if (rateCheck) response = addRateLimitHeaders(response, rateCheck);
        return response;
      }
    }

    // Increment tenant-level usage
    await db.incrementUsage(
      ctx.tenant.id,
      date,
      yearMonth,
    );

    // Increment per-key usage (if authenticated)
    if (ctx.apiKeyId) {
      await db.incrementKeyUsage(ctx.apiKeyId, date, yearMonth);
    }

    // Build quota info for headers
    quotaInfo = {
      monthlyLimit: tierLimits.monthly,
      monthlyRemaining: Math.max(0, tierLimits.monthly - monthlyUsage - 1),
      monthlyReset: getQuotaResetTime('monthly'),
      dailyLimit: tierLimits.daily,
      dailyRemaining: Math.max(0, tierLimits.daily - dailyUsage - 1),
      dailyReset: getQuotaResetTime('daily'),
    };
  }

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
      if (quotaInfo) {
        finalResponse = addQuotaHeaders(finalResponse, quotaInfo);
      }
      if (rateCheck) {
        finalResponse = addRateLimitHeaders(finalResponse, rateCheck);
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

    let finalResponse = jsonResponse(newBody as unknown as ApiResponse, response.status, {}, requestOrigin);
    if (quotaInfo) {
      finalResponse = addQuotaHeaders(finalResponse, quotaInfo);
    }
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
    if (quotaInfo) {
      response = addQuotaHeaders(response, quotaInfo);
    }
    if (rateCheck) {
      response = addRateLimitHeaders(response, rateCheck);
    }
    return response;
  }
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

/**
 * Handle _mock=true requests — return curated sample data for testing/demo.
 * First tries the new agent/action pattern (/v1/:agent/:action), then falls
 * back to the legacy flat-source pattern for backward compatibility.
 */
async function handleMockRequest(
  request: Request,
  url: URL,
  queryOptions: QueryOptions,
): Promise<Response> {
  const startTime = Date.now();
  const requestId = 'mock-' + crypto.randomUUID().slice(0, 12);
  const pathname = url.pathname;

  // Try the new agent/action pattern first
  const agentAction = parseAgentAction(pathname);
  if (agentAction) {
    const bc: BuildContext = {
      tenant: { id: 'dev', name: 'Dev User', emailVerified: true, tier: 'pro', isActive: true, journalismMode: false },
      requestId,
      startTime,
      queryOptions,
      metaOverrides: { cacheStatus: 'mock', durationMs: 0 },
    };

    // Build RouteContext-like params for mockHandler
    const routeParams = { agent: agentAction.agent, action: agentAction.action };
    return mockHandler(request, {
      tenant: bc.tenant,
      apiKeyId: '',
      requestId,
      startTime,
      env: {},
      db: undefined as unknown as MapleSpikeStorage,
      cache: undefined as unknown as MapleSpikeCache,
    }, routeParams);
  }

  // Legacy fallback for flat-source paths (/_mock=true on /v1/gov/search, etc.)
  const source = pathname === '/v1/search' || pathname === '/v1/gov/search'
    ? 'hoc'
    : pathname.replace(/^\/v1\//, '').replace(/[^a-zA-Z]/g, '');

  const data = getMockData(source);
  const allSources = url.searchParams.has('_sources')
    ? MOCK_DATA_SOURCES
    : undefined;

  const bc: BuildContext = {
    tenant: { id: 'dev', name: 'Dev User', emailVerified: true, tier: 'pro', isActive: true, journalismMode: false },
    requestId,
    startTime,
    queryOptions,
    metaOverrides: { cacheStatus: 'mock', durationMs: 0 },
  };

  return jsonResponse(buildSuccess({
    results: data,
    totalCount: data.length,
    sources: ALL_MOCK_CATEGORIES,
    mockData: allSources,
  }, bc));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const db = new D1Storage(env.DB);
    const cache = new KVCache(env.CACHE);
    const envVars: Record<string, string | undefined> = {
      ENVIRONMENT: env.ENVIRONMENT,
      MAPLESPIKE_VERSION: env.MAPLESPIKE_VERSION,
      MAPLESPIKE_NAME: env.MAPLESPIKE_NAME,
      FREE_LIMIT: env.FREE_LIMIT,
      PRO_LIMIT: env.PRO_LIMIT,
      BUSINESS_LIMIT: env.BUSINESS_LIMIT,
      AI_ENDPOINT: env.AI_ENDPOINT,
      AI_MODEL: env.AI_MODEL,
      JWT_SECRET: env.JWT_SECRET,
    };
    // Validate production config on every request (no startup lifecycle in Workers)
    try {
      validateConfig(envVars);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid configuration';
      return new Response(JSON.stringify({ success: false, error: { code: 'CONFIG_ERROR', message: msg } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return handleRequest(request, envVars, db, cache);
  },
};
