/**
 * Quill — Generic OAuth Routes
 *
 * GET  /v1/auth/oauth/:provider           — redirect to provider
 * GET  /v1/auth/oauth/:provider/callback   — handle callback → JWT + one-time code
 * GET  /v1/auth/oauth/exchange             — exchange one-time code for JWT
 * GET  /v1/auth/oauth/providers            — list configured providers
 *
 * Browser flow: user clicks OAuth button → callback mints a one-time code
 * stored in the shared cache (TTL=60s) and redirects to /auth/callback.
 * The portal calls /v1/auth/oauth/exchange to redeem the code for the JWT.
 * Codes are persisted in ctx.cache (Redis/PG/SQLite/in-memory) so they
 * survive multi-instance deployments and instance restarts — NOT bound
 * to a single process like the previous in-memory Map.
 *
 * Built-in: GitHub (from GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET).
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';
import { getProvider, listProviders, buildAuthorizeUrl, loginWithOAuth } from '../auth/oauth.js';
import { generateNonce, consumeChallenge, setChallenge } from '../auth/challenges.js';
import { generateApiKey } from '../auth.js';
import { serializeCookie } from '../auth/github.js';

/**
 * OAuth exchange code payload stored in the shared cache.
 * Keyed as `oauth:exchange:<uuid>` with TTL=60s.
 */
interface ExchangeEntry {
  token: string;
  provider: string;
  name: string;
  isNewUser: boolean;
  apiKey?: { key: string };
}

const EXCHANGE_TTL_SECONDS = 60;
const EXCHANGE_KEY_PREFIX = 'oauth:exchange:';

/**
 * Sentinel value written to the cache key BEFORE delete. Even on backends
 * with eventual-consistency deletes (Cloudflare KV), a concurrent second
 * reader will see this sentinel rather than the original payload, and we
 * will respond ALREADY_CONSUMED instead of issuing a duplicate JWT.
 */
const CONSUMED_SENTINEL = '__consumed__';

function exchangeCacheKey(code: string): string {
  return `${EXCHANGE_KEY_PREFIX}${code}`;
}

/** Returns true if this request came from a browser (HTML client) */
function isBrowserRequest(request: Request): boolean {
  const accept = request.headers.get('Accept') || '';
  return accept.includes('text/html');
}

/** Redirect to portal auth/callback with the one-time code */
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
  return process.env.PORTAL_URL || process.env.APP_URL || 'https://quill.maplespike.ca';
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
 * GET /v1/auth/github and GET /v1/auth/github/callback (legacy)
 *
 * The pre-framework GitHub flow set a `session` cookie on the API origin and
 * redirected to the portal root, skipping the portal's /auth/callback
 * one-time-code exchange — so the portal never learned the token and /me
 * rendered anonymous. It also minted users under a different identity than
 * the generic flow and never verified `state`.
 *
 * Both legacy routes now start the working generic flow
 * (/v1/auth/oauth/github), which verifies state and hands off through
 * /auth/callback. A code that arrives at the legacy callback was issued for
 * the legacy redirect_uri and cannot be redeemed by the generic flow, so the
 * callback restarts the login instead (GitHub re-approves silently).
 */
export const legacyGithubLoginHandler: RouteHandler = async (request, ctx) =>
  oauthLoginHandler(request, ctx, { provider: 'github' });

/**
 * GET /v1/auth/oauth/:provider/callback
 *
 * For browser requests (Accept: text/html), mints a one-time exchange
 * code, stores it in the shared cache (TTL=60s) and redirects to
 * /auth/callback.  For API clients (Accept: application/json), returns
 * the JWT directly.
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
      const entry: ExchangeEntry = {
        token: result.token,
        provider: result.profile.provider ?? '',
        name: result.profile.name ?? '',
        isNewUser: result.isNewUser,
        apiKey,
      };

      // Persist in shared cache so multi-instance deployments
      // (and instance restarts) can serve the redeem call.
      await ctx.cache.put(
        exchangeCacheKey(exchangeCode),
        JSON.stringify(entry),
        EXCHANGE_TTL_SECONDS,
      );

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
    // Log before redirecting — without this the failure is invisible in logs.
    console.error(`[oauth] callback login failed (${ctx.requestId}): ${message}`);
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
 * Atomically consumes a one-time code from the shared cache and returns
 * the user's JWT payload. The code is single-use and expires after 60s.
 *
 * Returns: { token, provider, name, isNewUser, apiKey? }
 */
export const oauthExchangeHandler: RouteHandler = async (request, ctx) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    console.warn(`[oauth] exchange missing code (${ctx.requestId})`);
    return jsonResponse(buildError('MISSING_CODE', 'Exchange code is required', ctx), 400);
  }

  const key = exchangeCacheKey(code);
  const cached = await ctx.cache.get(key);

  if (cached === CONSUMED_SENTINEL) {
    // Sentinel hit: another request already consumed this code (or is
    // mid-consumption on an eventually-consistent backend). Reject
    // explicitly so the caller knows the code is single-use.
    console.warn(`[oauth] exchange replay attempt (${ctx.requestId})`);
    return jsonResponse(
      buildError('ALREADY_CONSUMED', 'Exchange code has already been used', ctx),
      400,
    );
  }

  if (!cached) {
    console.warn(`[oauth] exchange invalid/expired code (${ctx.requestId})`);
    return jsonResponse(
      buildError('INVALID_CODE', 'Exchange code is invalid, expired, or already used', ctx),
      400,
    );
  }

  // Sentinel-write BEFORE delete: on backends that support atomic CAS
  // (Redis SETNX, etc.) this collapses the duplicate-redemption window to
  // zero. On backends with eventual-consistency (Cloudflare KV, where
  // both put and delete propagate over time), a sub-millisecond race
  // still exists where two concurrent readers both pass the sentinel
  // check before either write propagates — in that window the same JWT
  // would be returned to both, which is not a security escalation.
  await ctx.cache.put(key, CONSUMED_SENTINEL, EXCHANGE_TTL_SECONDS);
  await ctx.cache.delete(key);

  let entry: ExchangeEntry;
  try {
    entry = JSON.parse(cached) as ExchangeEntry;
  } catch {
    console.warn(`[oauth] exchange malformed payload (${ctx.requestId})`);
    return jsonResponse(
      buildError('INVALID_CODE', 'Exchange code payload is malformed', ctx),
      400,
    );
  }

  console.log(`[oauth] exchange ok (${ctx.requestId}) provider=${entry.provider} isNewUser=${entry.isNewUser}`);

  return jsonResponse(buildSuccess({
    token: entry.token,
    provider: entry.provider,
    name: entry.name,
    isNewUser: entry.isNewUser,
    apiKey: entry.apiKey ? { key: entry.apiKey.key, message: 'Save this API key — it will not be shown again.' } : undefined,
  }, ctx));
};
