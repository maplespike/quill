// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — GitHub OAuth Routes
 *
 * (Legacy GET /v1/auth/github[/callback] now start the generic flow —
 *  see legacyGithubLoginHandler in routes/auth-oauth.ts.)
 * POST /v1/auth/refresh         — refresh JWT token
 * GET  /v1/auth/logout          — clear session
 * GET  /v1/auth/me              — current user profile
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import { tokenFromRequest, refreshToken } from './jwt.js';
import { getUser, getUserKeys } from './users.js';

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const JWT_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

/* ------------------------------------------------------------------ */
/*  Token Refresh                                                      */
/* ------------------------------------------------------------------ */

/**
 * POST /v1/auth/refresh
 * Validate the current JWT and issue a new one.
 * Body: { token: string } or use Authorization header.
 */
export const refreshTokenHandler: RouteHandler = async (request, ctx) => {
  // Try body first, then header/cookie
  let oldToken: string | null = null;

  try {
    const body = await request.json() as { token?: string };
    oldToken = body.token || null;
  } catch {
    // Not JSON body — try header/cookie
  }

  if (!oldToken) {
    oldToken = tokenFromRequest(request);
  }

  if (!oldToken) {
    return jsonResponse(
      buildError('MISSING_TOKEN', 'No token provided. Send JWT in body, Authorization header, or session cookie.', ctx),
      400,
    );
  }

  const newToken = refreshToken(oldToken);
  if (!newToken) {
    return jsonResponse(
      buildError('INVALID_TOKEN', 'Token is invalid or expired. Re-authenticate via GitHub OAuth.', ctx),
      401,
    );
  }

  return jsonResponse(buildSuccess({
    token: newToken,
    tokenType: 'Bearer',
    expiresIn: JWT_COOKIE_MAX_AGE,
  }, ctx));
};

/* ------------------------------------------------------------------ */
/*  Logout                                                             */
/* ------------------------------------------------------------------ */

/**
 * GET /v1/auth/logout
 * Clear the session cookie.
 */
export const logoutHandler: RouteHandler = async (_request, ctx) => {
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      'Set-Cookie': serializeCookie('session', '', 0),
    },
  });
};

/* ------------------------------------------------------------------ */
/*  Current User Profile                                               */
/* ------------------------------------------------------------------ */

/**
 * GET /v1/auth/me
 * Return the current user's profile.
 * Requires JWT or API key (handled by auth middleware).
 */
export const meHandler: RouteHandler = async (_request, ctx) => {
  const user = getUser(ctx.tenant.id);
  const keys = getUserKeys(ctx.tenant.id);

  return jsonResponse(buildSuccess({
    user: user ? {
      id: user.id,
      email: (user as any).email || user.emailHash || '',
      githubLogin: user.githubLogin,
      githubName: user.githubName,
      avatarUrl: user.avatarUrl,
      tier: user.tier,
      createdAt: user.createdAt,
    } : {
      id: ctx.tenant.id,
      name: ctx.tenant.name,
      email: (ctx.tenant as any).email || ctx.tenant.emailHash || '',
      tier: ctx.tenant.tier,
    },
    tenant: {
      id: ctx.tenant.id,
      name: ctx.tenant.name,
      email: (ctx.tenant as any).email || ctx.tenant.emailHash || '',
      tier: ctx.tenant.tier,
      journalismMode: ctx.tenant.journalismMode,
    },
    apiKeys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      isActive: k.isActive,
    })),
  }, ctx));
};

/* ------------------------------------------------------------------ */
/*  Internal Helpers                                                   */
/* ------------------------------------------------------------------ */

export function serializeCookie(name: string, value: string, maxAgeSeconds: number): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (maxAgeSeconds > 0) {
    parts.push(`Max-Age=${maxAgeSeconds}`);
  } else {
    parts.push('Max-Age=0');
    parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  }

  // Set Secure in production (HTTPS). Local dev over HTTP can't use Secure cookies.
  const isProduction = process.env.NODE_ENV === 'production' || process.env.ENVIRONMENT === 'production';
  if (isProduction) {
    parts.push('Secure');
  }

  return parts.join('; ');
}
