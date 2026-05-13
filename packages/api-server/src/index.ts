/**
 * CivInt Canada — API Gateway (Worker Entry)
 *
 * Cloudflare Workers fetch handler + Node.js dev server compatible.
 * Multi-tenant REST API gateway wrapping pipeline-core.
 *
 * Architecture:
 *   Request → Auth middleware → Rate limit → Route dispatch → Response envelope
 */

import type { Env, RouteHandler, RouteContext } from './types.js';
import { authenticateRequest } from './auth.js';
import { checkRateLimit } from './rate-limit.js';
import { buildError, jsonResponse, corsPreflight, addRateLimitHeaders } from './response.js';
import { loadConfig } from './config.js';
import { D1Storage, KVCache } from './storage.js';
import type { CivIntStorage, CivIntCache } from './types.js';

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
import { signalsHandler } from './routes/signals.js';

const ROUTES: Route[] = [
  { pattern: /^\/v1\/health\/?$/, method: 'GET', params: [], handler: healthHandler },
  { pattern: /^\/v1\/signals\/?$/, method: 'GET', params: [], handler: signalsHandler },
  { pattern: /^\/v1\/register\/?$/, method: 'POST', params: [], handler: registerHandler },
  { pattern: /^\/v1\/me\/?$/, method: 'GET', params: [], handler: meHandler },
  { pattern: /^\/v1\/gov\/releases\/?$/, method: 'GET', params: [], handler: listReleasesHandler },
  { pattern: /^\/v1\/gov\/search\/?$/, method: 'GET', params: [], handler: searchGovHandler },
  { pattern: /^\/v1\/gov\/data\/?$/, method: 'GET', params: [], handler: dataHandler },
  { pattern: /^\/v1\/citation\/([^/]+)\/?$/, method: 'GET', params: ['id'], handler: getCitationHandler },
  { pattern: /^\/v1\/audit\/query\/?$/, method: 'POST', params: [], handler: auditQueryHandler },
  { pattern: /^\/v1\/usage\/?$/, method: 'GET', params: [], handler: usageHandler },
  { pattern: /^\/v1\/openapi\.json\/?$/, method: 'GET', params: [], handler: openApiHandler },
  { pattern: /^\/v1\/?$/, method: 'GET', params: [], handler: openApiHandler }, // Root redirect to spec
];



function generateRequestId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return 'civint-' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}



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
  db: CivIntStorage,
  cache: CivIntCache,
): Promise<Response> {
  const config = loadConfig(env);
  const requestId = generateRequestId();
  const startTime = Date.now();

  if (request.method === 'OPTIONS') {
    return corsPreflight();
  }

  const matched = matchRoute(request.url, request.method);
  if (!matched) {
    const ctx: RouteContext = {
      tenant: { id: 'anon', name: 'Anonymous', tier: 'free', isActive: true, journalismMode: false },
      apiKeyId: '',
      requestId,
      startTime,
      env,
      db,
      cache,
    };
    return jsonResponse(buildError('NOT_FOUND', `No route matches ${request.method} ${new URL(request.url).pathname}`, ctx), 404);
  }

  const { route, params } = matched;

  // Authentication (except health and register which are open)
  const tenant = route.handler === healthHandler || route.handler === registerHandler
    ? null
    : await authenticateRequest(request, db);

  if (!tenant && route.handler !== healthHandler && route.handler !== registerHandler) {
    const ctx: RouteContext = {
      tenant: { id: 'anon', name: 'Anonymous', tier: 'free', isActive: true, journalismMode: false },
      apiKeyId: '',
      requestId,
      startTime,
      env,
      db,
      cache,
    };
    return jsonResponse(buildError('UNAUTHORIZED', 'Valid API key required. Get one at https://civint.ca', ctx), 401);
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

  // Rate limit (skip for health and spec)
  let rateCheck: { dailyCalls: number; monthlyCalls: number; dailyLimit: number; monthlyLimit: number } | null = null;
  if (route.handler !== healthHandler && route.handler !== openApiHandler) {
    const check = await checkRateLimit(ctx.tenant, db);
    rateCheck = check; // store for response headers
    if (!check.allowed) {
      await db.logAudit({
        tenantId: ctx.tenant.id,
        apiKeyId: ctx.apiKeyId,
        operation: 'rate_limit',
        endpoint: route.pattern.source,
        outputSummary: check.reason || 'Rate limited',
        confidence: null,
        success: false,
        durationMs: Date.now() - startTime,
      });

      let response = jsonResponse(buildError('RATE_LIMITED', check.reason || 'Rate limit exceeded', ctx), 429);
      if (rateCheck) {
        response = addRateLimitHeaders(response, rateCheck);
      }
      return response;
    }
  }

  const now = new Date();
  await db.incrementUsage(
    ctx.tenant.id,
    now.toISOString().slice(0, 10),
    now.toISOString().slice(0, 7),
  );

  try {
    const start = Date.now();
    const response = await route.handler(request, ctx, params);
    const durationMs = Date.now() - start;

    // Attach rate-limit headers to authenticated responses
    let finalResponse = response;
    if (rateCheck) {
      finalResponse = addRateLimitHeaders(response, rateCheck);
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
    console.error(`[API] ${errorCode} (${ctx.requestId}):`, message);
    if (err instanceof Error && (err as any).stack) {
      console.error(`[API] Stack:`, (err as any).stack?.split('\n').slice(0, 6).join('\n'));
    }

    let response = jsonResponse(buildError(errorCode, message, ctx), statusCode);
    if (rateCheck) {
      response = addRateLimitHeaders(response, rateCheck);
    }
    return response;
  }
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
