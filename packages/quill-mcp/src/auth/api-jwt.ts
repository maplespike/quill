// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Verify a Quill API session JWT.
 *
 * The API signs these tokens with HMAC-SHA256 (JWT_SECRET) and the issuer
 * and audience in packages/api-server/src/auth/jwt.ts. MCP accepts the same
 * tokens so a key or a session that works on the API works here. A failed
 * check is not an API key: three-part tokens are JWTs only.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

const ISSUER = process.env.JWT_ISSUER || 'maplespike';
const AUDIENCE = process.env.JWT_AUDIENCE || 'quill-api';

export interface ApiJwtClaims {
  sub: string;
  tier?: string;
  iss?: string;
  aud?: string;
  exp?: number;
}

function base64UrlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, 'base64');
}

function sign(input: string, secret: string): string {
  return createHmac('sha256', secret).update(input).digest('base64url');
}

/**
 * Return the claims when the token is a current HS256 API session JWT.
 * Return null for any other input, including a bad signature or a wrong audience.
 */
export function verifyApiJwt(token: string, secret: string | undefined): ApiJwtClaims | null {
  if (!secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  if (!header || !payload || !signature) return null;

  try {
    const decodedHeader = JSON.parse(base64UrlDecode(header).toString('utf8')) as { alg?: string; typ?: string };
    if (decodedHeader.alg !== 'HS256' || decodedHeader.typ !== 'JWT') return null;
  } catch {
    return null;
  }

  const expected = sign(`${header}.${payload}`, secret);
  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length) return null;
  if (!timingSafeEqual(expectedBuf, signatureBuf)) return null;

  try {
    const claims = JSON.parse(base64UrlDecode(payload).toString('utf8')) as ApiJwtClaims;
    if (!claims.sub) return null;
    const now = Math.floor(Date.now() / 1000);
    if (typeof claims.exp === 'number' && claims.exp < now) return null;
    if (claims.iss && claims.iss !== ISSUER) return null;
    if (claims.aud && claims.aud !== AUDIENCE) return null;
    return claims;
  } catch {
    return null;
  }
}
