// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Shared Cookie Utilities
 *
 * Centralizes cookie serialization with consistent security flags.
 * Always sets: HttpOnly, Secure, SameSite=Lax
 * Never conditional — these flags are mandatory.
 */

export function serializeCookie(name: string, value: string, maxAgeSeconds: number): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ];

  if (maxAgeSeconds > 0) {
    parts.push(`Max-Age=${maxAgeSeconds}`);
  } else {
    parts.push('Max-Age=0');
    parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  }

  return parts.join('; ');
}
