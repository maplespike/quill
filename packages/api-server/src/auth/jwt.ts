/**
 * MapleSpike — JWT Token Utilities
 *
 * Uses Node.js built-in crypto (HMAC-SHA256) — no external dependencies.
 * Payload: { sub: user.id, email, tier, iat, exp }
 *
 * Public API:
 *   generateToken(payload, secret?, expiresIn?)  — create a signed JWT
 *   verifyToken(token, secret?)                   — verify and decode
 *   tokenFromRequest(request)                     — extract JWT from request
 *   extractToken(request)                         — alias for tokenFromRequest
 *   generateRefreshToken(payload)                 — longer-lived token
 *   refreshToken(oldToken)                        — re-issue from valid token
 */

import * as crypto from 'node:crypto';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_SECRET = process.env.JWT_SECRET || 'maplespike-jwt-secret-change-in-production';
const DEFAULT_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds
const REFRESH_EXPIRY = 30 * 24 * 60 * 60; // 30 days for refresh tokens

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface JwtPayload {
  sub: string;
  email?: string;
  tier: string;
  iat: number;
  exp: number;
}

export interface JwtResult {
  payload: JwtPayload;
  token: string;
}

/* ------------------------------------------------------------------ */
/*  Base64 Helpers (URL-safe)                                          */
/* ------------------------------------------------------------------ */

function base64UrlEncode(data: Buffer): string {
  return data
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): Buffer {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

/* ------------------------------------------------------------------ */
/*  HMAC-SHA256 Sign / Verify                                          */
/* ------------------------------------------------------------------ */

function sign(input: string, secret?: string): string {
  const key = secret || DEFAULT_SECRET;
  return base64UrlEncode(
    crypto.createHmac('sha256', key).update(input).digest(),
  );
}

function verify(input: string, signature: string, secret?: string): boolean {
  const expected = sign(input, secret);
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/* ------------------------------------------------------------------ */
/*  Token Generation                                                   */
/* ------------------------------------------------------------------ */

const HEADER = base64UrlEncode(
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
);

/**
 * Create a signed JWT token.
 * @param payload - Claims to embed (sub, email, tier)
 * @param secret - HMAC secret (defaults to JWT_SECRET env var)
 * @param expiresIn - Expiry in seconds (default: 7 days)
 */
export function generateToken(
  payload: { sub: string; email?: string; tier: string },
  secret?: string,
  expiresIn: number = DEFAULT_EXPIRY,
): string {
  // Accept (payload, expiresIn) or (payload, secret, expiresIn) signatures
  if (typeof secret === 'number') {
    expiresIn = secret;
    secret = undefined;
  }

  const now = Math.floor(Date.now() / 1000);
  const jwtPayload: JwtPayload = {
    sub: payload.sub,
    email: payload.email,
    tier: payload.tier,
    iat: now,
    exp: now + expiresIn,
  };

  const encodedPayload = base64UrlEncode(
    Buffer.from(JSON.stringify(jwtPayload)),
  );

  const signature = sign(`${HEADER}.${encodedPayload}`, secret);
  return `${HEADER}.${encodedPayload}.${signature}`;
}

/**
 * Verify and decode a JWT token.
 * Returns the JwtPayload if valid, null otherwise.
 */
export function verifyToken(token: string, secret?: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;

  // Verify header is correct (HS256)
  try {
    const decodedHeader = JSON.parse(base64UrlDecode(header).toString());
    if (decodedHeader.alg !== 'HS256' || decodedHeader.typ !== 'JWT') {
      return null;
    }
  } catch {
    return null;
  }

  // Verify signature
  if (!verify(`${header}.${payload}`, signature, secret)) {
    return null;
  }

  // Decode and validate payload
  try {
    const decoded: JwtPayload = JSON.parse(
      base64UrlDecode(payload).toString(),
    );

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      return null; // Token expired
    }

    // Validate required fields
    if (!decoded.sub) return null;

    return decoded;
  } catch {
    return null;
  }
}

/**
 * Extract JWT from an incoming Request.
 * Checks: Authorization header -> X-API-Key -> Cookie header.
 */
export function tokenFromRequest(request: Request): string | null {
  // 1. Authorization: Bearer ***
  const auth = request.headers.get('Authorization');
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    // Check if it looks like a JWT (three dot-separated base64 sections)
    if (token.split('.').length === 3) {
      return token;
    }
    // If it's not a JWT, it might be an API key — that's handled elsewhere
  }

  // 2. X-API-Key header (check if it looks like a JWT)
  const apiKey = request.headers.get('X-API-Key');
  if (apiKey && apiKey.split('.').length === 3) {
    return apiKey;
  }

  // 3. Cookie: session=<token>
  const cookie = request.headers.get('Cookie');
  if (cookie) {
    const match = cookie.match(/(?:^|;\s*)session=([^;]+)/);
    if (match) {
      const token = decodeURIComponent(match[1]);
      if (token.split('.').length === 3) {
        return token;
      }
    }
  }

  return null;
}

/**
 * Alias for tokenFromRequest.
 * Extracts a JWT from Authorization: Bearer, X-API-Key, or Cookie.
 */
export const extractToken = tokenFromRequest;

/**
 * Generate a refresh token (longer-lived than access token).
 */
export function generateRefreshToken(
  payload: { sub: string; email?: string; tier: string },
  secret?: string,
): string {
  return generateToken(payload, secret, REFRESH_EXPIRY);
}

/**
 * Refresh an existing token — verify the old one and issue a new one.
 * Returns null if the refresh token is invalid or expired.
 */
export function refreshToken(oldToken: string, secret?: string): string | null {
  const payload = verifyToken(oldToken, secret);
  if (!payload) return null;

  // Issue a new token with the same claims
  return generateToken({
    sub: payload.sub,
    email: payload.email,
    tier: payload.tier,
  }, secret);
}
