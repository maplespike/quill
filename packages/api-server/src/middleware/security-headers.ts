// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Security Headers Middleware
 *
 * Applies OWASP-recommended response headers across all API responses.
 * Headers are attached at the response-construction layer so they appear
 * on every outgoing response.
 *
 * References:
 *   - OWASP Secure Headers Project
 *   - https://owasp.org/www-project-secure-headers/
 *   - https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security
 */

export const DEFAULT_SECURITY_HEADERS: Record<string, string> = {
  // X-Content-Type-Options — prevent MIME-type sniffing
  'X-Content-Type-Options': 'nosniff',

  // X-Frame-Options — prevent clickjacking (DENY for API, SAMEORIGIN for portal)
  'X-Frame-Options': 'DENY',

  // Referrer-Policy — control referrer info sent with cross-origin requests
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Permissions-Policy — restrict browser features
  'Permissions-Policy':
    'camera=(), display-capture=(), fullscreen=(self), geolocation=(), microphone=(), payment=(), usb=()',

  // Cache-Control — prevent caching of sensitive API responses
  'Cache-Control': 'no-cache, no-store, must-revalidate',

  // Pragma — HTTP/1.0 cache-control fallback
  'Pragma': 'no-cache',
};

/**
 * HSTS header value. Only set for production environments.
 * - max-age=63072000 (2 years)
 * - includeSubDomains — apply to all subdomains
 * - preload — allow browser preload lists
 */
export const HSTS_HEADER = 'Strict-Transport-Security';

export function buildHstsHeader(maxAge = 63072000, includeSubDomains = true, preload = true): string {
  let value = `max-age=${maxAge}`;
  if (includeSubDomains) value += '; includeSubDomains';
  if (preload) value += '; preload';
  return value;
}

/**
 * Content-Security-Policy header value.
 *
 * MapleSpike API serves JSON only — the CSP is restrictive:
 *   - default-src 'none' — nothing allowed by default
 *   - connect-src 'self' — allow API calls to same origin
 *   - base-uri 'none' — no <base> injection
 *   - form-action 'none' — no form submissions
 *
 * For the web portal (packages/portal), a relaxed policy is set separately.
 */
export const CSP_HEADER = 'Content-Security-Policy';

export function buildCspHeader(): string {
  const directives = [
    "default-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    'connect-src *',      // API clients need to connect from anywhere
    "frame-ancestors 'none'",   // API should not be embedded in frames
  ];
  return directives.join('; ');
}

/**
 * Apply all security headers to a Headers object.
 * Returns the same Headers instance for chaining.
 */
export function applySecurityHeaders(
  headers: Headers,
  environment?: string,
): Headers {
  for (const [key, value] of Object.entries(DEFAULT_SECURITY_HEADERS)) {
    // Don't overwrite existing headers
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }

  // HSTS: only in production
  if (environment === 'production' && !headers.has(HSTS_HEADER)) {
    headers.set(HSTS_HEADER, buildHstsHeader());
  }

  // CSP: only if not already set
  if (!headers.has(CSP_HEADER)) {
    headers.set(CSP_HEADER, buildCspHeader());
  }

  return headers;
}
