/**
 * CivInt Canada — API Key Authentication
 *
 * Authenticates Bearer tokens against the storage backend.
 * Uses SHA-256 hashing so raw keys aren't stored (same as FG pattern).
 */

import type { Tenant, CivIntStorage } from './types.js';

/**
 * Simple SHA-256 hash for API key comparison.
 * Uses Web Crypto API — works in Workers and Node 18+.
 */
export async function hashApiKey(rawKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(rawKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extract Bearer token from Authorization header.
 * Returns null if missing or malformed.
 */
export function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

/**
 * Authenticate a request. Returns tenant info or null.
 */
export async function authenticateRequest(
  request: Request,
  db: CivIntStorage,
): Promise<{ tenant: Tenant; apiKeyId: string } | null> {
  const rawKey = extractBearerToken(request);
  if (!rawKey) return null;
  return db.authenticate(rawKey);
}

/**
 * Generate a new API key (civint_ prefix + 32 random hex chars).
 * Returns both the raw key (shown once) and the hash (stored).
 */
export async function generateApiKey(): Promise<{ rawKey: string; keyHash: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const rawKey = `civint_${hex}`;
  const keyHash = await hashApiKey(rawKey);
  return { rawKey, keyHash };
}
