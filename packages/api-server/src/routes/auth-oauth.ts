/**
 * MapleSpike — Generic OAuth Routes
 *
 * GET  /v1/auth/oauth/:provider           — redirect to provider
 * GET  /v1/auth/oauth/:provider/callback   — handle callback → JWT
 * GET  /v1/auth/oauth/providers            — list configured providers
 *
 * Supports any OAuth 2.0 provider configured via env vars:
 *   MAPLESPIKE_OAUTH_{NAME}_CLIENT_ID
 *   MAPLESPIKE_OAUTH_{NAME}_CLIENT_SECRET
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
 * GET /v1/auth/oauth/providers
 * List all configured OAuth providers (for frontend login buttons).
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
 * Handle the OAuth callback, exchange code for token, issue JWT.
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
    return jsonResponse(
      buildError('OAUTH_ERROR', `Provider returned: ${error}`, ctx),
      400,
    );
  }

  // Verify state to prevent CSRF
  if (state) {
    const stored = consumeChallenge(`oauth:${params.provider}:${state}`);
    if (!stored) {
      return jsonResponse(
        buildError('OAUTH_INVALID_STATE', 'OAuth state mismatch. Possible CSRF attack.', ctx),
        403,
      );
    }
  }

  try {
    const result = await loginWithOAuth(provider, code);

    // Auto-provision API key for new OAuth users
    let apiKey: { id: string; key: string } | undefined;
    if (result.isNewUser) {
      const tenantId = `${result.profile.provider}:${result.profile.providerId}`;
      const keyId = `key_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
      const generated = await generateApiKey();
      apiKey = { id: keyId, key: generated.rawKey };

      try {
        // Try SqliteStorage-style createApiKey
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

    // Return JWT as JSON (frontend stores it)
    // Also set as httpOnly cookie for browser clients
    const response = jsonResponse(buildSuccess({
      token: result.token,
      provider: result.profile.provider,
      name: result.profile.name,
      email: result.profile.email,
      avatarUrl: result.profile.avatarUrl,
      isNewUser: result.isNewUser,
      apiKey: apiKey ? { key: apiKey.key, message: 'Save this API key — it will not be shown again.' } : undefined,
    }, ctx));

    // Also set cookie for browser-based auth
    const headers = new Headers(response.headers);
    headers.set(
      'Set-Cookie',
      serializeCookie('session', result.token, 604800),
    );

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth login failed';
    return jsonResponse(buildError('OAUTH_LOGIN_FAILED', message, ctx), 401);
  }
};
