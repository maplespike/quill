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
import { checkRateLimit } from './rate-limit.js';
import {
  buildError,
  buildSuccess,
  jsonResponse,
  corsPreflight,
  addRateLimitHeaders,
} from './response.js';
import type { BuildContext } from './response.js';
import { loadConfig, validateConfig } from './config.js';
import { D1Storage, KVCache } from './storage.js';
import type { MapleSpikeStorage, MapleSpikeCache } from './types.js';
import { recordIngestion, getFreshness, getConfidence, getCertainty } from './freshness.js';
export type { ApiResponse } from './types.js';
export type { QueryOptions } from './types.js';
import pino from 'pino';

interface Route {
  pattern: RegExp;
  method: string;
  params: string[];
  handler: RouteHandler;
  /** Per-route cache TTL in seconds. Only GET routes with ttlSeconds > 0 are cached. */
  ttlSeconds?: number;
}

import { healthHandler } from './routes/health.js';
import { addAttributionHeader } from './middleware/attribution.js';
import { withRouteCache } from './middleware/cache-middleware.js';
import { complianceHandler } from './routes/compliance.js';
import { listReleasesHandler, searchGovHandler } from './routes/gov.js';
import { getCitationHandler } from './routes/citation.js';
import { auditQueryHandler } from './routes/audit.js';
import { auditGetHandler } from './routes/audit-get.js';
import { usageHandler } from './routes/usage.js';
import { openApiHandler } from './routes/openapi.js';
import { listModulesHandler, exportModuleHandler } from './routes/export.js';
import { registerHandler, verifyHandler, meHandler } from './routes/register.js';
import { web3ChallengeHandler, web3LoginHandler } from './routes/auth-web3.js';
import { billingPlansHandler, billingOrderHandler, billingVerifyHandler } from './routes/billing.js';
import { listKeysHandler as apiKeysListHandler, createKeyHandler as apiKeysCreateHandler, revokeKeyHandler as apiKeysRevokeHandler } from './routes/api-keys.js';
import {
  listAnnotationsHandler, createAnnotationHandler, updateAnnotationHandler,
  deleteAnnotationHandler, exportAnnotationsHandler,
} from './routes/annotations.js';
import { initAnnotationStore } from './services/annotationService.js';
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
import { energyDataHandler } from './routes/energy.js';
import { realEstateDataHandler } from './routes/real-estate.js';
import { finRegDataHandler, finRegCrossRefHandler } from './routes/financial-regulation.js';
import { watcherStatusHandler, watcherEventsHandler } from './routes/watcher.js';
import {
  webhookListHandler, webhookGetHandler, webhookCreateHandler,
  webhookUpdateHandler, webhookDeleteHandler, webhookTestHandler,
  webhookDeliveriesHandler,
} from './routes/webhooks.js';
import { entityResolveHandler, entityConnectionsHandler } from './routes/entity.js';
import { municipalDataHandler, municipalCityHandler } from './routes/municipal.js';
import { dataQualityHandler } from './routes/data-quality.js';
import {
  githubLoginHandler,
  githubCallbackHandler,
  refreshTokenHandler,
  logoutHandler,
  meHandler as authMeHandler,
} from './auth/github.js';

const ROUTES: Route[] = [
  { pattern: /^\/v1\/health\/?$/, method: 'GET', params: [], handler: withRouteCache(healthHandler, 30) },
  { pattern: /^\/v1\/compliance\/?$/, method: 'GET', params: [], handler: withRouteCache(complianceHandler, 3600) },
  { pattern: /^\/v1\/onboarding\/?$/, method: 'GET', params: [], handler: withRouteCache(onboardingHandler, 3600) },
  { pattern: /^\/v1\/contact\/?$/, method: 'POST', params: [], handler: contactHandler },
  { pattern: /^\/v1\/register\/?$/, method: 'POST', params: [], handler: registerHandler },
  { pattern: /^\/v1\/verify\/([^/]+)\/?$/, method: 'GET', params: ['token'], handler: verifyHandler },
  { pattern: /^\/v1\/me\/?$/, method: 'GET', params: [], handler: withRouteCache(meHandler, 60) },
  { pattern: /^\/v1\/gov\/releases\/?$/, method: 'GET', params: [], handler: withRouteCache(listReleasesHandler, 3600) },
  { pattern: /^\/v1\/gov\/search\/?$/, method: 'GET', params: [], handler: withRouteCache(searchGovHandler, 300) },

  { pattern: /^\/v1\/citation\/([^/]+)\/?$/, method: 'GET', params: ['id'], handler: withRouteCache(getCitationHandler, 3600) },
  { pattern: /^\/v1\/audit\/query\/?$/, method: 'POST', params: [], handler: auditQueryHandler },
  { pattern: /^\/v1\/audit\/?$/, method: 'GET', params: [], handler: withRouteCache(auditGetHandler, 60) },
  { pattern: /^\/v1\/usage\/?$/, method: 'GET', params: [], handler: withRouteCache(usageHandler, 60) },
  // Billing
  { pattern: /^\/v1\/billing\/plans\/?$/, method: 'GET', params: [], handler: withRouteCache(billingPlansHandler, 3600) },
  { pattern: /^\/v1\/billing\/order\/?$/, method: 'POST', params: [], handler: billingOrderHandler },
  { pattern: /^\/v1\/billing\/verify\/?$/, method: 'POST', params: [], handler: billingVerifyHandler },

  // API Key Management
  { pattern: /^\/v1\/keys\/?$/, method: 'GET', params: [], handler: withRouteCache(apiKeysListHandler, 60) },
  { pattern: /^\/v1\/keys\/?$/, method: 'POST', params: [], handler: apiKeysCreateHandler },
  { pattern: /^\/v1\/keys\/([^/]+)\/?$/, method: 'DELETE', params: ['id'], handler: apiKeysRevokeHandler },

  // Journalism — Annotations
  { pattern: /^\/v1\/annotations\/?$/, method: 'GET', params: [], handler: withRouteCache(listAnnotationsHandler, 60) },
  { pattern: /^\/v1\/annotations\/?$/, method: 'POST', params: [], handler: createAnnotationHandler },
  { pattern: /^\/v1\/annotations\/([^/]+)\/?$/, method: 'PATCH', params: ['id'], handler: updateAnnotationHandler },
  { pattern: /^\/v1\/annotations\/([^/]+)\/?$/, method: 'DELETE', params: ['id'], handler: deleteAnnotationHandler },
  { pattern: /^\/v1\/annotations\/export\/?$/, method: 'GET', params: [], handler: withRouteCache(exportAnnotationsHandler, 60) },
  // AI
  { pattern: /^\/v1\/ai_ask\/?$/, method: 'POST', params: [], handler: aiAskHandler }, // DEPRECATED: use /v1/ai/ask
  { pattern: /^\/v1\/ai\/ask\/?$/, method: 'POST', params: [], handler: aiAskHandler },
  { pattern: /^\/v1\/ai\/analyze\/?$/, method: 'POST', params: [], handler: aiAnalyzeHandler },
  { pattern: /^\/v1\/keys\/?$/, method: 'GET', params: [], handler: withRouteCache(listKeysHandler, 60) },
  { pattern: /^\/v1\/keys\/?$/, method: 'POST', params: [], handler: createKeyHandler },
  { pattern: /^\/v1\/keys\/([^/]+)\/?$/, method: 'DELETE', params: ['id'], handler: deleteKeyHandler },
  { pattern: /^\/v1\/keys\/([^/]+)\/rotate\/?$/, method: 'POST', params: ['id'], handler: rotateKeyHandler },
  { pattern: /^\/v1\/openapi\.json\/?$/, method: 'GET', params: [], handler: withRouteCache(openApiHandler, 3600) },
  { pattern: /^\/v1\/?$/, method: 'GET', params: [], handler: withRouteCache(openApiHandler, 3600) }, // Root redirect to spec

  // --- Auth routes ---
  // Generic OAuth
  { pattern: /^\/v1\/auth\/oauth\/providers\/?$/, method: 'GET', params: [], handler: withRouteCache(oauthProvidersHandler, 3600) },
  // OAuth login/callback redirects — no cache (user-specific redirects)
  { pattern: /^\/v1\/auth\/oauth\/([^/]+)\/?$/, method: 'GET', params: ['provider'], handler: oauthLoginHandler },
  { pattern: /^\/v1\/auth\/oauth\/([^/]+)\/callback\/?$/, method: 'GET', params: ['provider'], handler: oauthCallbackHandler },
  // Legacy GitHub-specific (kept for backward compat)
  { pattern: /^\/v1\/auth\/github\/?$/, method: 'GET', params: [], handler: githubLoginHandler },
  { pattern: /^\/v1\/auth\/github\/callback\/?$/, method: 'GET', params: [], handler: githubCallbackHandler },
  { pattern: /^\/v1\/auth\/refresh\/?$/, method: 'POST', params: [], handler: refreshTokenHandler },
  { pattern: /^\/v1\/auth\/logout\/?$/, method: 'POST', params: [], handler: logoutHandler },
  { pattern: /^\/v1\/auth\/me\/?$/, method: 'GET', params: [], handler: withRouteCache(authMeHandler, 60) },
  // Web3 wallet auth
  { pattern: /^\/v1\/auth\/web3\/challenge\/?$/, method: 'POST', params: [], handler: web3ChallengeHandler },
  { pattern: /^\/v1\/auth\/web3\/login\/?$/, method: 'POST', params: [], handler: web3LoginHandler },
  // Passkey / WebAuthn auth
  { pattern: /^\/v1\/auth\/passkey\/register\/begin\/?$/, method: 'POST', params: [], handler: passkeyRegisterBeginHandler },
  { pattern: /^\/v1\/auth\/passkey\/register\/complete\/?$/, method: 'POST', params: [], handler: passkeyRegisterCompleteHandler },
  { pattern: /^\/v1\/auth\/passkey\/login\/begin\/?$/, method: 'POST', params: [], handler: passkeyLoginBeginHandler },
  { pattern: /^\/v1\/auth\/passkey\/login\/complete\/?$/, method: 'POST', params: [], handler: passkeyLoginCompleteHandler },
  { pattern: /^\/v1\/auth\/passkey\/credentials\/?$/, method: 'GET', params: [], handler: withRouteCache(passkeyListHandler, 60) },
  { pattern: /^\/v1\/auth\/passkey\/credentials\/([^/]+)\/?$/, method: 'DELETE', params: ['id'], handler: passkeyDeleteHandler },

  // Energy data
  { pattern: /^\/v1\/energy\/?$/, method: 'GET', params: [], handler: withRouteCache(energyDataHandler, 3600) },

  // Real estate data
  { pattern: /^\/v1\/real-estate\/?$/, method: 'GET', params: [], handler: withRouteCache(realEstateDataHandler, 3600) },

  // Financial regulation data
  { pattern: /^\/v1\/financial-regulation\/?$/, method: 'GET', params: [], handler: withRouteCache(finRegDataHandler, 3600) },
  { pattern: /^\/v1\/financial-regulation\/cross-reference\/?$/, method: 'GET', params: [], handler: withRouteCache(finRegCrossRefHandler, 3600) },

  // Municipal data
  { pattern: /^\/v1\/municipal\/?$/, method: 'GET', params: [], handler: withRouteCache(municipalDataHandler, 3600) },
  { pattern: /^\/v1\/municipal\/([^/]+)\/?$/, method: 'GET', params: ['city'], handler: withRouteCache(municipalCityHandler, 3600) },

  // Entity resolution
  { pattern: /^\/v1\/entity\/resolve\/?$/, method: 'POST', params: [], handler: entityResolveHandler },
  { pattern: /^\/v1\/entity\/connections\/?$/, method: 'GET', params: [], handler: withRouteCache(entityConnectionsHandler, 300) },

  // Watcher (real-time monitoring)
  { pattern: /^\/v1\/watcher\/status\/?$/, method: 'GET', params: [], handler: withRouteCache(watcherStatusHandler, 60) },
  { pattern: /^\/v1\/watcher\/events\/?$/, method: 'GET', params: [], handler: withRouteCache(watcherEventsHandler, 60) },

  // Webhook notifications
  { pattern: /^\/v1\/webhooks\/?$/, method: 'GET', params: [], handler: withRouteCache(webhookListHandler, 60) },
  { pattern: /^\/v1\/webhooks\/?$/, method: 'POST', params: [], handler: webhookCreateHandler },
  { pattern: /^\/v1\/webhooks\/([^/]+)\/?$/, method: 'GET', params: ['id'], handler: withRouteCache(webhookGetHandler, 60) },
  { pattern: /^\/v1\/webhooks\/([^/]+)\/?$/, method: 'PATCH', params: ['id'], handler: webhookUpdateHandler },
  { pattern: /^\/v1\/webhooks\/([^/]+)\/?$/, method: 'DELETE', params: ['id'], handler: webhookDeleteHandler },
  { pattern: /^\/v1\/webhooks\/([^/]+)\/test\/?$/, method: 'POST', params: ['id'], handler: webhookTestHandler },
  { pattern: /^\/v1\/webhooks\/([^/]+)\/deliveries\/?$/, method: 'GET', params: ['id'], handler: withRouteCache(webhookDeliveriesHandler, 60) },
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

const log = pino({
  level: process.env.MAPLESPIKE_LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
    : undefined,
});

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

// Engine status route — check if engine has run and data is available
import { engineStatusHandler } from './routes/engine-status.js';
ROUTES.push({
  pattern: /^\/v1\/engine\/status\/?$/,
  method: 'GET',
  params: [],
  handler: withRouteCache(engineStatusHandler, 300),
});

// Engine run route — trigger engine orchestrator
import { engineRunHandler } from './routes/engine-run.js';
ROUTES.push({
  pattern: /^\/v1\/engine\/run\/?$/,
  method: 'POST',
  params: [],
  handler: engineRunHandler,
});

// Export API — REST/JSON export for external clients
ROUTES.push(
  { pattern: /^\/v1\/export\/modules\/?$/, method: 'GET', params: [], handler: withRouteCache(listModulesHandler, 3600) },
  { pattern: /^\/v1\/export\/([^/]+)\/([^/]+)\/?$/, method: 'GET', params: ['module', 'id'], handler: withRouteCache(exportModuleHandler, 3600) },
  { pattern: /^\/v1\/export\/([^/]+)\/?$/, method: 'GET', params: ['module'], handler: withRouteCache(exportModuleHandler, 3600) },
);

// Data Quality Monitoring — feeds Grafana dashboard
ROUTES.push({
  pattern: /^\/v1\/data\/quality\/?$/,
  method: 'GET',
  params: [],
  handler: withRouteCache(dataQualityHandler, 300),
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
  const environment = config.environment || process.env.ENVIRONMENT;
  const requestId = generateRequestId();
  const startTime = Date.now();
  const url = new URL(request.url);
  const queryOptions = parseQueryOptions(url);
  const requestOrigin = request.headers.get('Origin');

  // --- CORS preflight ---
  if (request.method === 'OPTIONS') {
    return corsPreflight(requestOrigin, environment);
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
    return jsonResponse(buildError('NOT_FOUND', `No route matches ${request.method} ${new URL(request.url).pathname}`, ctx), 404, {}, undefined, environment);
  }

  const { route, params } = matched;

  // Authentication (public routes: health, openapi, register, github login/callback, refresh, logout)
  const path = url.pathname;
  const authExempt = path.startsWith('/v1/health')
    || route.handler === complianceHandler
    || route.handler === searchGovHandler
    || route.handler === openApiHandler
    || route.handler === getCitationHandler
    || route.handler === registerHandler
    || route.handler === billingPlansHandler
    || route.handler === githubLoginHandler
    || route.handler === githubCallbackHandler
    || route.handler === refreshTokenHandler
    || route.handler === logoutHandler
    || route.handler === engineStatusHandler
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
    || route.handler === contactHandler
    // Data quality monitoring (feeds Grafana dashboard)
    || route.handler === dataQualityHandler;

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
    return jsonResponse(buildError('UNAUTHORIZED', 'Valid API key required. Get one at https://maplespike.ca', ctx), 401, {}, undefined, environment);
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

  // Rate limit (skip for health, data quality, and spec)
  let rateCheck: { allowed: boolean; remaining: number; resetTime: number } | null = null;
  if (!path.startsWith('/v1/health') && path !== '/v1/data/quality' && route.handler !== openApiHandler && route.handler !== dataQualityHandler) {
    // Stricter limits for unauthenticated requests
    const isAuthenticated = tenant !== null;
    const tierLimits = TIER_LIMITS[ctx.tenant.tier];
    const windowMs = 60 * 1000; // 1-minute sliding window for aggressive check
    const maxPerWindow = isAuthenticated ? tierLimits.daily : 5; // unauthenticated: 5/min max

    // Rate-limit key: authenticated → tenant ID; anonymous → IP-based for granularity
    let rateLimitKey: string;
    if (isAuthenticated) {
      rateLimitKey = ctx.tenant.id;
    } else {
      // Use client IP when available to prevent shared-throttle attacks on public endpoints
      const clientIp = request.headers.get('CF-Connecting-IP')
        || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
        || request.headers.get('X-Real-IP')
        || 'anon';
      rateLimitKey = `anon:${clientIp}`;
    }
    const check = checkRateLimit(rateLimitKey, maxPerWindow, windowMs);
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
      let response = jsonResponse(buildError('RATE_LIMITED', 'Rate limit exceeded. Try again later.', bc), 429, { 'Retry-After': String(Math.max(1, retryAfter)) }, undefined, environment);
      if (rateCheck) {
        response = addRateLimitHeaders(response, rateCheck);
      }
      addAttributionHeader(response);
      return response;
    }
  }

  // ── Dispatch to matched route handler ──
  return route.handler(request, ctx, params);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const db = new D1Storage(env.DB);
    initAnnotationStore(env.DB);
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
