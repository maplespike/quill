/**
 * MapleSpike — GitHub OAuth Routes
 *
 * GET  /v1/auth/github          — redirect to GitHub OAuth
 * GET  /v1/auth/github/callback — handle OAuth callback
 * POST /v1/auth/refresh         — refresh JWT token
 * GET  /v1/auth/logout          — clear session
 * GET  /v1/auth/me              — current user profile
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import { generateToken, verifyToken, tokenFromRequest, refreshToken } from './jwt.js';
import { createUser, getUser, getTenantForUser, getUserKeys } from './users.js';
import type { GitHubProfile } from '../types.js';

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || 'http://localhost:8082/v1/auth/github/callback';
const JWT_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

/* ------------------------------------------------------------------ */
/*  GitHub OAuth Initiation                                            */
/* ------------------------------------------------------------------ */

/**
 * GET /v1/auth/github
 * Redirect the user to GitHub's OAuth authorization page.
 */
export const githubLoginHandler: RouteHandler = async (_request, ctx) => {
  if (!GITHUB_CLIENT_ID) {
    return jsonResponse(
      buildError('GITHUB_NOT_CONFIGURED', 'GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.', ctx),
      501,
    );
  }

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_REDIRECT_URI,
    scope: 'read:user user:email',
    state: generateState(ctx.requestId),
  });

  const redirectUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectUrl,
    },
  });
};

/* ------------------------------------------------------------------ */
/*  GitHub OAuth Callback                                              */
/* ------------------------------------------------------------------ */

/**
 * GET /v1/auth/github/callback
 * Handle the OAuth callback from GitHub.
 * Exchanges the code for an access token, fetches user info, creates/returns user.
 */
export const githubCallbackHandler: RouteHandler = async (request, ctx) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    return jsonResponse(
      buildError('GITHUB_AUTH_ERROR', 'No authorization code provided by GitHub.', ctx),
      400,
    );
  }

  // Exchange code for access token
  let accessToken: string;
  try {
    accessToken = await exchangeCodeForToken(code);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token exchange failed';
    return jsonResponse(
      buildError('GITHUB_TOKEN_ERROR', message, ctx),
      502,
    );
  }

  // Fetch GitHub user profile
  let githubProfile: GitHubProfile;
  try {
    githubProfile = await fetchGitHubUser(accessToken);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch GitHub profile';
    return jsonResponse(
      buildError('GITHUB_PROFILE_ERROR', message, ctx),
      502,
    );
  }

  // Also fetch emails if the primary email is not public
  if (!githubProfile.email) {
    try {
      const emails = await fetchGitHubEmails(accessToken);
      const primary = emails.find((e: any) => e.primary && e.verified);
      if (primary) {
        githubProfile.email = primary.email;
      }
    } catch {
      // Non-fatal — email is optional
    }
  }

  // Create or retrieve user
  const user = createUser(githubProfile);
  const tenant = getTenantForUser(user.id);

  // Generate JWT
  const token = generateToken({
    sub: user.id,
    email: user.email || undefined,
    tier: user.tier,
  });

  // Determine redirect or JSON response
  const accept = request.headers.get('Accept') || '';
  if (accept.includes('text/html')) {
    // Set cookie and redirect to app
    const appUrl = process.env.APP_URL || 'http://localhost:8082';
    return new Response(null, {
      status: 302,
      headers: {
        Location: appUrl,
        'Set-Cookie': serializeCookie('session', token, JWT_COOKIE_MAX_AGE),
      },
    });
  }

  // API response
  return jsonResponse(buildSuccess({
    user: {
      id: user.id,
      email: user.email,
      githubLogin: user.githubLogin,
      githubName: user.githubName,
      avatarUrl: user.avatarUrl,
      tier: user.tier,
    },
    tenant: tenant ? {
      id: tenant.id,
      name: tenant.name,
      tier: tenant.tier,
    } : null,
    token,
    tokenType: 'Bearer',
    expiresIn: JWT_COOKIE_MAX_AGE,
  }, ctx));
};

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
      email: user.email,
      githubLogin: user.githubLogin,
      githubName: user.githubName,
      avatarUrl: user.avatarUrl,
      tier: user.tier,
      createdAt: user.createdAt,
    } : {
      id: ctx.tenant.id,
      name: ctx.tenant.name,
      email: ctx.tenant.email,
      tier: ctx.tenant.tier,
    },
    tenant: {
      id: ctx.tenant.id,
      name: ctx.tenant.name,
      email: ctx.tenant.email,
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

function generateState(requestId: string): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${requestId}-${hex}`;
}

async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: GITHUB_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed: ${response.status}`);
  }

  const data = await response.json() as { access_token?: string; error?: string };
  if (data.error || !data.access_token) {
    throw new Error(data.error || 'No access token returned');
  }

  return data.access_token;
}

async function fetchGitHubUser(accessToken: string): Promise<GitHubProfile> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'User-Agent': 'MapleSpike-Canada',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return response.json() as Promise<GitHubProfile>;
}

async function fetchGitHubEmails(accessToken: string): Promise<any[]> {
  const response = await fetch('https://api.github.com/user/emails', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'User-Agent': 'MapleSpike-Canada',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`GitHub emails API error: ${response.status}`);
  }

  return response.json() as Promise<any[]>;
}

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
