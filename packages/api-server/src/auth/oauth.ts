/**
 * MapleSpike — Generic OAuth Provider Framework
 *
 * Supports GitHub (built-in) plus any OAuth 2.0 provider via env config:
 *   MAPLESPIKE_OAUTH_{PROVIDER}_CLIENT_ID
 *   MAPLESPIKE_OAUTH_{PROVIDER}_CLIENT_SECRET
 *
 * Built-in: github (from env vars GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET)
 * Extensible by env: google, microsoft, apple, etc.
 *
 * Flow: redirect to /v1/auth/oauth/:provider → OAuth authorize → callback → JWT
 */

import type { GitHubProfile } from '../types.js';
import { generateToken } from './jwt.js';
import { createUser, getUser, getTenantForUser } from './users.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface OAuthProvider {
  name: string;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  mapProfile: (raw: Record<string, unknown>) => OAuthProfile;
}

export interface OAuthProfile {
  provider: string;
  providerId: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

/* ------------------------------------------------------------------ */
/*  Built-in providers                                                 */
/* ------------------------------------------------------------------ */

const BASE_REDIRECT = process.env.MAPLESPIKE_OAUTH_REDIRECT_BASE || 'http://localhost:8082/v1/auth/oauth';

const PROVIDERS: Record<string, OAuthProvider> = {};

function registerBuiltIn(): void {
  const ghId = process.env.GITHUB_CLIENT_ID || '';
  const ghSecret = process.env.GITHUB_CLIENT_SECRET || '';
  if (ghId && ghSecret) {
    PROVIDERS.github = {
      name: 'GitHub',
      clientId: ghId,
      clientSecret: ghSecret,
      authorizeUrl: `https://github.com/login/oauth/authorize?client_id=${ghId}&redirect_uri=${BASE_REDIRECT}/github/callback&scope=read:user+user:email`,
      tokenUrl: 'https://github.com/login/oauth/access_token',
      userInfoUrl: 'https://api.github.com/user',
      scope: 'read:user user:email',
      mapProfile: (raw) => ({
        provider: 'github',
        providerId: String(raw.id ?? ''),
        email: (raw.email as string) ?? null,
        name: (raw.name as string) ?? (raw.login as string) ?? null,
        avatarUrl: (raw.avatar_url as string) ?? null,
      }),
    };
  }
}

registerBuiltIn();

/* ------------------------------------------------------------------ */
/*  Dynamic provider loader — reads env vars for any OAuth provider    */
/* ------------------------------------------------------------------ */

function loadDynamicProviders(): void {
  // Scan env vars for MAPLESPIKE_OAUTH_*_CLIENT_ID patterns
  for (const key of Object.keys(process.env)) {
    const match = key.match(/^MAPLESPIKE_OAUTH_(\w+)_CLIENT_ID$/);
    if (!match) continue;
    const providerName = match[1].toLowerCase();
    if (PROVIDERS[providerName]) continue; // Skip built-in

    const clientId = process.env[key] || '';
    const clientSecret = process.env[`MAPLESPIKE_OAUTH_${match[1]}_CLIENT_SECRET`] || '';
    if (!clientId || !clientSecret) continue;

    // Generic OAuth 2.0 — requires provider to implement standard endpoints
    PROVIDERS[providerName] = {
      name: match[1],
      clientId,
      clientSecret,
      authorizeUrl: `https://${providerName}.com/o/oauth2/auth?client_id=${clientId}&redirect_uri=${BASE_REDIRECT}/${providerName}/callback&response_type=code&scope=openid+email+profile`,
      tokenUrl: `https://oauth2.${providerName}.com/token`,
      userInfoUrl: `https://openidconnect.${providerName}.com/v1/userinfo`,
      scope: 'openid email profile',
      mapProfile: (raw) => ({
        provider: providerName,
        providerId: String(raw.sub ?? raw.id ?? ''),
        email: (raw.email as string) ?? null,
        name: (raw.name as string) ?? null,
        avatarUrl: (raw.picture as string) ?? null,
      }),
    };
  }
}

loadDynamicProviders();

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export function getProvider(name: string): OAuthProvider | undefined {
  return PROVIDERS[name];
}

export function listProviders(): Array<{ name: string; label: string }> {
  return Object.entries(PROVIDERS).map(([key, p]) => ({
    name: key,
    label: p.name,
  }));
}

/**
 * Build the authorization URL to redirect the user to.
 */
export function buildAuthorizeUrl(provider: OAuthProvider, state: string): string {
  const baseUrl = provider.authorizeUrl;
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}state=${encodeURIComponent(state)}`;
}

/**
 * Exchange authorization code for an access token.
 */
export async function exchangeCode(
  provider: OAuthProvider,
  code: string,
): Promise<string> {
  const resp = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code,
      redirect_uri: `${BASE_REDIRECT}/${provider.name}/callback`,
      grant_type: 'authorization_code',
    }),
  });

  if (!resp.ok) {
    throw new Error(`Token exchange failed: ${resp.status}`);
  }

  const body = await resp.json() as Record<string, unknown>;
  return body.access_token as string;
}

/**
 * Fetch user profile from the provider's user info endpoint.
 */
export async function fetchProfile(
  provider: OAuthProvider,
  accessToken: string,
): Promise<OAuthProfile> {
  const resp = await fetch(provider.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!resp.ok) {
    throw new Error(`User info fetch failed: ${resp.status}`);
  }

  const raw = await resp.json() as Record<string, unknown>;
  return provider.mapProfile(raw);
}

/**
 * Complete OAuth login: exchange code, fetch profile, create/get user, issue JWT.
 */
export async function loginWithOAuth(
  provider: OAuthProvider,
  code: string,
): Promise<{ token: string; profile: OAuthProfile; isNewUser: boolean }> {
  const accessToken = await exchangeCode(provider, code);
  const profile = await fetchProfile(provider, accessToken);

  // Create or get user (adapt OAuth profile to existing createUser interface)
  const userId = `${profile.provider}:${profile.providerId}`;
  let user = getUser(userId);

  let isNewUser = false;
  if (!user) {
    isNewUser = true;
    const ghProfile: GitHubProfile = {
      id: parseInt(profile.providerId, 10) || 0,
      login: profile.name || profile.providerId,
      name: profile.name,
      email: profile.email,
      avatar_url: profile.avatarUrl,
      provider: profile.provider,
      provider_id: profile.providerId,
    };
    user = createUser(ghProfile);
  }

  const tenant = getTenantForUser(userId);

  const token = generateToken({
    sub: userId,
    email: profile.email ?? undefined,
    tier: tenant?.tier || 'free',
  });

  return { token, profile, isNewUser };
}
