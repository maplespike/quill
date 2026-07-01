/**
 * MapleSpike — Generic OAuth Routes
 *
 * GET  /v1/auth/oauth/:provider           — redirect to provider
 * GET  /v1/auth/oauth/:provider/callback   — handle callback → JWT
 * GET  /v1/auth/oauth/exchange             — exchange one-time code for JWT
 * GET  /v1/auth/oauth/providers            — list configured providers
 *
 * Browser flow: user clicks OAuth button → callback returns a one-time
 * exchange code in a 302 redirect to /auth/callback (portal page). The
 * portal calls /v1/auth/oauth/exchange with the code to retrieve the
 * JWT. This avoids putting the 7-day JWT in URL query strings, browser
 * history, server logs, or referral headers.
 *
 * Built-in: GitHub (from GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET)
 */

import type { RouteHandler, Tenant } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';
import { getProvider, listProviders, buildAuthorizeUrl, loginWithOAuth } from '../auth/oauth.js';
import { generateNonce, setChallenge, consumeChallenge } from '../auth/challenges.js';
import { generateApiKey } from '../auth.js';
import { serializeCookie } from '../auth/github.js';

/**
 * In-memory store for OAuth one-time exchange codes.
 * Each code is single-use and expires in 60 seconds.
 * Map size is naturally bounded by traffic; we also do periodic cleanup.
 */
interface ExchangeEntry {
  token: string;
  provider: string;
  name: string;
  isNewUser: boolean;
  apiKey?: { key: string };
  expiresAt: number;
}

const EXCHANGE_TTL_MS = 60_000;
const MAX_EXCHANGE_ENTRIES = 1000;
const exchangeStore = new Map<string, ExchangeEntry>();

function setExchange(code: string, entry: Omit<ExchangeEntry, 'expiresAt'>): void {
  if (exchangeStore.size >= MAX_EXCHANGE_ENTRIES) {
    // Drop oldest entries when at capacity
    const oldestKey = exchangeStore.keys().next().value;
    if (oldestKey) exchangeStore.delete(oldestKey);
  }
  exchangeStore.set(code, { ...entry, expiresAt: Date.now() + EXCHANGE_TTL_MS });
}

function consumeExchange(code: string): ExchangeEntry | null {
  const entry = exchangeStore.get(code);
  if (!entry) return null;
  exchangeStore.delete(code);
  if (Date.now() > entry.expiresAt) return null;
  return entry;
}

/** Periodic cleanup of expired entries (every 5 minutes) */
setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of exchangeStore.entries()) {
    if (entry.expiresAt < now) exchangeStore.delete(code);
  }
}, 5 * 60_000).unref?.();

/** Returns true if this request came from a browser (HTML client) */
function isBrowserRequest(request: Request): boolean {
  const accept = request.headers.get('Accept') || '';
  return accept.includes('text/html');
}

/** Redirect to portal auth/callback with optional error query param */
function redirectToPortal(code: string, appUrl: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${appUrl}/auth/callback?code=${encodeURIComponent(code)}`,
      'Cache-Control': 'no-store',
    },
  });
}

function portalUrl(): string {
  return process.env.PORTAL_URL || process.env.APP_URL || 'http://localhost:4321';
}

/**
 * GET /v1/auth/oauth/providers
 */
export const oauthProvidersHandler: RouteHandler = async (_request, ctx) => {
  const providers = listProviders();
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  return jsonResponse(buildSuccess({ providers }, bc));
};

/**
 * GET /v1/auth/oauth/:provider
 * Redirect the user to the provider's OAuth authorization page.
 */
export const oauthLoginHandler: RouteHandler = async (_request, ctx, params) => {
  const provider = getProvider(params.provider);
  if (!provider) {
    return jsonResponse(
      buildError('OAUTH_PROVIDER_NOT_FOUND', `OAuth provider "${params.provider}" is not configured. Available: ${listProviders().map(p => p.name).join(', ')}`, ctx),
      404,
    );
  }

  const state = generateNonce();
  setChallenge(`oauth:${params.provider}:${state}`, state);

  const authorizeUrl = buildAuthorizeUrl(provider, state);

  return new Response(null, {
    status: 302,
    headers: { Location: authorizeUrl },
  });
};

/**
 * GET /v1/auth/oauth/:provider/callback
 *
 * For browser requests (Accept: text/html), generates a one-time
 * exchange code and redirects to /auth/callback.
 *
 * For API clients (Accept: application/json), returns the JWT directly.
 */
export const oauthCallbackHandler: RouteHandler = async (request, ctx, params) => {
  const provider = getProvider(params.provider);
  if (!provider) {
    return jsonResponse(
      buildError('OAUTH_PROVIDER_NOT_FOUND', `OAuth provider "${params.provider}" is not configured`, ctx),
      404,
    );
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    const error = url.searchParams.get('error') || 'Unknown OAuth error';
    if (isBrowserRequest(request)) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${portalUrl()}/auth/callback?error=${encodeURIComponent(error)}` },
      });
    }
    return jsonResponse(buildError('OAUTH_ERROR', `Provider returned: ${error}`, ctx), 400);
  }

  // Verify state to prevent CSRF
  if (state) {
    const stored = consumeChallenge(`oauth:${params.provider}:${state}`);
    if (!stored) {
      if (isBrowserRequest(request)) {
        return new Response(null, {
          status: 302,
          headers: { Location: `${portalUrl()}/auth/callback?error=${encodeURIComponent('invalid_state')}` },
        });
      }
      return jsonResponse(
        buildError('OAUTH_INVALID_STATE', 'OAuth state mismatch. Possible CSRF attack.', ctx),
        403,
      );
    }
  }

  try {
    const result = await loginWithOAuth(provider, code);

    // Auto-provision API key for new OAuth users
    let apiKey: { key: string } | undefined;
    if (result.isNewUser) {
      const tenantId = `${result.profile.provider}:${result.profile.providerId}`;
      const keyId = `key_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
      const generated = await generateApiKey();
      apiKey = { key: generated.rawKey };

      try {
        const db = ctx.db as any;
        if (typeof db.createApiKey === 'function') {
          db.createApiKey(keyId, tenantId, generated.keyHash, 'default');
        } else if (typeof db.createKey === 'function') {
          await db.createKey(tenantId, keyId, generated.keyHash, 'default');
        }
      } catch {
        // Non-fatal — user can generate key from workspace
      }
    }

    // ── Browser path: redirect to portal with one-time code ────────
    if (isBrowserRequest(request)) {
      const exchangeCode = crypto.randomUUID();
      setExchange(exchangeCode, {
        token: result.token,
        provider: result.profile.provider ?? '',
        name: result.profile.name ?? '',
        isNewUser: result.isNewUser,
        apiKey,
      });

      // Also set the HttpOnly session cookie for server-side API auth
      const redirectResponse = redirectToPortal(exchangeCode, portalUrl());
      redirectResponse.headers.append(
        'Set-Cookie',
        serializeCookie('session', result.token, 604800),
      );
      return redirectResponse;
    }

    // ── API path: return JSON with JWT directly ───────────────────
    const response = jsonResponse(buildSuccess({
      token: result.token,
      provider: result.profile.provider,
      name: result.profile.name,
      avatarUrl: result.profile.avatarUrl,
      isNewUser: result.isNewUser,
      apiKey: apiKey ? { key: apiKey.key, message: 'Save this API key — it will not be shown again.' } : undefined,
    }, ctx));

    const headers = new Headers(response.headers);
    headers.append(
      'Set-Cookie',
      serializeCookie('session', result.token, 604800),
    );

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth login failed';
    if (isBrowserRequest(request)) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${portalUrl()}/auth/callback?error=${encodeURIComponent('login_failed')}` },
      });
    }
    return jsonResponse(buildError('OAUTH_LOGIN_FAILED', message, ctx), 401);
  }
};

/**
 * GET /v1/auth/oauth/exchange?code=<one-time-code>
 *
 * Exchanges a short-lived code for the user's JWT payload.
 * The code is single-use and expires after 60 seconds.
 *
 * Returns: { token, provider, name, isNewUser, apiKey? }
 */
export const oauthExchangeHandler: RouteHandler = async (request, ctx) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return jsonResponse(buildError('MISSING_CODE', 'Exchange code is required', ctx), 400);
  }

  const entry = consumeExchange(code);
  if (!entry) {
    return jsonResponse(buildError('INVALID_CODE', 'Exchange code is invalid, expired, or already used', ctx), 400);
  }

  return jsonResponse(buildSuccess({
    token: entry.token,
    provider: entry.provider,
    name: entry.name,
    isNewUser: entry.isNewUser,
    apiKey: entry.apiKey ? { key: entry.apiKey.key, message: 'Save this API key — it will not be shown again.' } : undefined,
  }, ctx));
};
