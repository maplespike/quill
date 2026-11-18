// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Casdoor OIDC Authentication
 *
 * Validates Casdoor-issued access tokens (RS256 signed JWTs) via
 * JWKS fetched from the Casdoor issuer's well-known endpoint.
 *
 * Flow:
 *   Authorization: Bearer <oidc-access-token>
 *     ↓
 *   Fetch JWKS from https://auth.lan/.well-known/jwks (cached)
 *     ↓
 *   Verify RS256 signature, expiry, issuer, audience
 *     ↓
 *   Attach decoded user info to request / context
 *
 * The middleware falls through to existing auth (passkey, API key)
 * when no OIDC token is present or when validation fails — it is
 * additive, not blocking.
 */

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface OidcUserInfo {
  sub: string;
  email?: string;
  name?: string;
  preferredUsername?: string;
  groups?: string[];
  /** Raw Casdoor JWT payload for downstream inspection */
  raw: JWTPayload & Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Configuration                                                      */
/* ------------------------------------------------------------------ */

const OIDC_ISSUER = process.env.OIDC_ISSUER_URL ?? 'https://auth.lan';
const JWKS_URL = `${OIDC_ISSUER}/.well-known/jwks`;
const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID ?? 'app-maplespike-api';
const EXPECTED_ISSUER = OIDC_ISSUER;
const EXPECTED_AUDIENCE = OIDC_CLIENT_ID;

/* ------------------------------------------------------------------ */
/*  JWKS Set (lazily initialised, cached by jose)                     */
/* ------------------------------------------------------------------ */

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(JWKS_URL));
  }
  return jwks;
}

/* ------------------------------------------------------------------ */
/*  Token Validation                                                   */
/* ------------------------------------------------------------------ */

/**
 * Validate a Casdoor OIDC access token.
 *
 * @param token - The raw JWT string from Authorization: Bearer
 * @returns Decoded user info on success, null on any validation failure
 */
export async function validateOidcToken(token: string): Promise<OidcUserInfo | null> {
  try {
    const JWKS = getJwks();

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: EXPECTED_ISSUER,
      audience: EXPECTED_AUDIENCE,
      algorithms: ['RS256'],
    });

    return {
      sub: payload.sub ?? 'unknown',
      email: (payload.email as string | undefined),
      name: (payload.name as string | undefined),
      preferredUsername: (payload.preferred_username as string | undefined),
      groups: (payload.groups as string[] | undefined),
      raw: payload as JWTPayload & Record<string, unknown>,
    };
  } catch {
    // Token expired, bad signature, wrong issuer/audience, etc.
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Middleware                                                          */
/* ------------------------------------------------------------------ */

/**
 * Extract Bearer token from an Authorization header (standard Web API Request).
 * Returns null if missing or malformed.
 */
export function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  // OIDC access tokens are JWTs — three dot-separated base64 segments
  if (token.split('.').length !== 3) return null;
  return token;
}

/**
 * Attempt to authenticate a request via OIDC Bearer token.
 *
 * Compatible with the existing AuthResult shape used by authenticateRequest
 * in auth.ts so it can be trivially composed.
 *
 * Returns a partial AuthResult-like object on success, null on failure.
 */
export async function authenticateOidc(
  request: Request,
): Promise<{
  sub: string;
  email?: string;
  name?: string;
  preferredUsername?: string;
  groups?: string[];
} | null> {
  const token = extractBearerToken(request);
  if (!token) return null;

  const userInfo = await validateOidcToken(token);
  if (!userInfo) return null;

  return {
    sub: userInfo.sub,
    email: userInfo.email,
    name: userInfo.name,
    preferredUsername: userInfo.preferredUsername,
    groups: userInfo.groups,
  };
}
