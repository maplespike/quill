// SPDX-License-Identifier: AGPL-3.0-only
/**
 * MapleSpike MCP — Casdoor OIDC Token Validation
 *
 * Validates Casdoor-issued access/MCP tokens via JWKS.
 * Used for authenticating MCP session tokens and server-to-server calls.
 *
 * JWKS is fetched from Casdoor's well-known OpenID Configuration endpoint:
 *   https://auth.lan/.well-known/openid-configuration → jwks_uri
 *
 * The JWKS is cached for 1 hour.
 *
 * @module auth/oidc
 */

import * as jose from 'jose';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CASDOOR_ISSUER = process.env.CASDOOR_ISSUER || 'https://auth.lan';
const OIDC_CONFIG_URL = `${CASDOOR_ISSUER}/.well-known/openid-configuration`;
const JWKS_CACHE_TTL_MS = process.env.CASDOOR_JWKS_CACHE_TTL
  ? parseInt(process.env.CASDOOR_JWKS_CACHE_TTL, 10)
  : 60 * 60 * 1000; // 1 hour

const VALID_MCP_CLIENT_IDS = [
  'maplespike-mcp',
  'maplespike-api',
];

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface OidcUserInfo {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  client_id?: string;
  [key: string]: unknown;
}

export interface OidcAuthResult {
  authenticated: boolean;
  user?: OidcUserInfo;
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  JWKS Cache                                                         */
/* ------------------------------------------------------------------ */

let jwksCache: { keys: jose.JSONWebKeySet['keys']; expiresAt: number } | null = null;

/**
 * Fetch the JWKS from Casdoor's well-known endpoint.
 * Results are cached for 1 hour by default (configurable via CASDOOR_JWKS_CACHE_TTL).
 */
async function fetchJWKS(): Promise<jose.JSONWebKeySet['keys']> {
  if (jwksCache && jwksCache.expiresAt > Date.now()) {
    return jwksCache.keys;
  }

  // Discover jwks_uri from OpenID configuration
  const configResp = await fetch(OIDC_CONFIG_URL, {
    signal: AbortSignal.timeout(10_000),
    headers: { Accept: 'application/json' },
  });

  if (!configResp.ok) {
    throw new Error(`Failed to fetch OIDC config: ${configResp.status}`);
  }

  const config = await configResp.json() as { jwks_uri?: string };
  const jwksUri = config.jwks_uri || `${CASDOOR_ISSUER}/.well-known/jwks`;

  // Fetch the JWKS
  const jwksResp = await fetch(jwksUri, {
    signal: AbortSignal.timeout(10_000),
    headers: { Accept: 'application/json' },
  });

  if (!jwksResp.ok) {
    throw new Error(`Failed to fetch JWKS: ${jwksResp.status}`);
  }

  const jwks = await jwksResp.json() as jose.JSONWebKeySet;
  if (!jwks.keys || jwks.keys.length === 0) {
    throw new Error('JWKS response contains no keys');
  }

  jwksCache = { keys: jwks.keys, expiresAt: Date.now() + JWKS_CACHE_TTL_MS };
  return jwks.keys;
}

/**
 * Clear the JWKS cache (useful after key rotation testing).
 */
export function clearJwksCache(): void {
  jwksCache = null;
}

/* ------------------------------------------------------------------ */
/*  Token Validation                                                   */
/* ------------------------------------------------------------------ */

/**
 * Validate a Casdoor-issued access/MCP token using JWKS.
 *
 * Steps:
 *   1. Quick-decode to check the token was issued by a valid MCP client
 *   2. Fetch JWKS (cached)
 *   3. Verify the JWT signature
 *   4. Return decoded payload
 *
 * Returns OidcAuthResult — does NOT throw on invalid tokens.
 */
export async function validateCasdoorToken(
  token: string,
): Promise<OidcAuthResult> {
  try {
    // Step 1: Quick decode for issuer/client_id pre-check
    const unverified = jose.decodeJwt(token);
    if (!unverified) {
      return { authenticated: false, error: 'Malformed token' };
    }

    // Validate issuer
    if (unverified.iss) {
      const iss = (unverified.iss as string).replace(/\/+$/, '');
      if (iss !== CASDOOR_ISSUER.replace(/\/+$/, '')) {
        return { authenticated: false, error: `Invalid issuer: ${unverified.iss}` };
      }
    }

    // Validate client_id — must be one of the valid MCP clients
    const clientId = unverified.client_id as string | undefined;
    if (clientId && !VALID_MCP_CLIENT_IDS.includes(clientId)) {
      return { authenticated: false, error: `Invalid client_id: ${clientId}` };
    }

    // Step 2-3: Fetch JWKS and verify
    const keys = await fetchJWKS();
    const JWKS = jose.createLocalJWKSet({ keys });

    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer: CASDOOR_ISSUER,
    });

    return {
      authenticated: true,
      user: payload as unknown as OidcUserInfo,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('JWT expired')) {
      return { authenticated: false, error: 'Token expired' };
    }
    if (message.includes('JWKS')) {
      return { authenticated: false, error: `JWKS validation failed` };
    }

    return { authenticated: false, error: message };
  }
}

/**
 * Quick pre-check: is this token a Casdoor-issued MCP token?
 * Checks if it's a 3-part JWT with a valid Casdoor client_id claim.
 */
export function isCasdoorToken(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString(),
    ) as Record<string, unknown>;

    const clientId = payload.client_id as string | undefined;
    return !!clientId && VALID_MCP_CLIENT_IDS.includes(clientId);
  } catch {
    return false;
  }
}

/**
 * Strict validation: token MUST be a valid Casdoor-issued MCP token.
 * Throws on invalid/expired tokens. Returns user info on success.
 *
 * Used for MCP session authentication and server-to-server calls.
 */
export async function requireValidToken(token: string): Promise<OidcUserInfo> {
  const result = await validateCasdoorToken(token);
  if (!result.authenticated || !result.user) {
    throw new Error(`OIDC authentication failed: ${result.error || 'Unknown error'}`);
  }
  return result.user;
}

/**
 * Validate a token and return a boolean.
 * Convenience wrapper for use in request handlers.
 */
export async function authenticateToken(token: string): Promise<boolean> {
  const result = await validateCasdoorToken(token);
  return result.authenticated;
}
