// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Internal Service Authentication Middleware
 *
 * Verifies signed JWT tokens carried on the `X-Internal-Token` header.
 * Used for service-to-service RPC (e.g., quill-mcp → api-server,
 * ai-inference-gateway → api-server) so that internal endpoints are not
 * exposed to anonymous or external callers.
 *
 * The shared secret is provided by `INTERNAL_JWT_SECRET`. In production it
 * must be a cryptographically random value (e.g., 32+ bytes from
 * `openssl rand -hex 32`).
 */

import { verifyToken, generateToken } from '../auth/jwt.js';

const INTERNAL_AUDIENCE = 'quill-internal';
const INTERNAL_ISSUER = 'quill-services';

export interface InternalTokenPayload {
  sub: string;
  service: string;
  aud: string;
  iss: string;
}

/**
 * Generate a short-lived internal service token.
 *
 * @param service - Name of the calling service (e.g., 'quill-mcp')
 * @param secret - Shared HMAC secret
 * @param expiresInSeconds - Token lifetime (default: 5 minutes)
 */
export function generateInternalToken(
  service: string,
  secret: string,
  expiresInSeconds = 5 * 60,
): string {
  if (!secret || secret.length < 32) {
    throw new Error('INTERNAL_JWT_SECRET must be at least 32 characters');
  }
  return generateToken(
    { sub: `svc:${service}`, email: undefined, tier: 'internal' },
    secret,
    {
      expiresIn: expiresInSeconds,
      issuer: INTERNAL_ISSUER,
      audience: INTERNAL_AUDIENCE,
    },
  );
}

/**
 * Verify an internal service token.
 * Returns the decoded payload if valid, null otherwise.
 */
export function verifyInternalToken(token: string, secret: string): InternalTokenPayload | null {
  if (!secret) return null;
  const payload = verifyToken(token, { secret, issuer: INTERNAL_ISSUER, audience: INTERNAL_AUDIENCE });
  if (!payload || !payload.iss || !payload.aud) return null;
  return {
    sub: payload.sub,
    service: payload.sub.replace(/^svc:/, ''),
    aud: payload.aud,
    iss: payload.iss,
  };
}

/**
 * Extract and verify the internal token from a request.
 */
export function authenticateInternalRequest(request: Request, secret: string): InternalTokenPayload | null {
  const header = request.headers.get('X-Internal-Token');
  if (!header) return null;
  return verifyInternalToken(header, secret);
}

/**
 * Middleware factory: reject requests without a valid internal token.
 * Use this for routes that must only be reachable from other cluster services.
 */
export function requireInternalAuth(secret: string | undefined) {
  return (request: Request): { ok: true; payload: InternalTokenPayload } | { ok: false; response: Response } => {
    if (!secret) {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({ success: false, error: { code: 'INTERNAL_AUTH_NOT_CONFIGURED', message: 'Internal authentication is not configured' } }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
      };
    }
    const payload = authenticateInternalRequest(request, secret);
    if (!payload) {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: 'Valid internal service token required' } }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        ),
      };
    }
    return { ok: true, payload };
  };
}
