/**
 * CivInt Canada — API Key Authentication
 *
 * Multi-tenant API key auth using an in-memory Map.
 * Supports at least two keys: demo and internal.
 * Keep all existing exports.
 */

import type { Tenant } from './types.js';

/* ------------------------------------------------------------------ */
/*  In-Memory API Key Store                                           */
/* ------------------------------------------------------------------ */

const apiKeyMap = new Map<string, { tenantId: string; name: string }>();

// Seed with demo and internal keys
apiKeyMap.set('civint-demo-key', { tenantId: 'demo-tenant', name: 'Demo User' });
apiKeyMap.set('civint-internal-key', { tenantId: 'internal-tenant', name: 'Internal Service' });

const tenantDetails: Record<string, Tenant> = {
  'demo-tenant': {
    id: 'demo-tenant',
    name: 'Demo User',
    tier: 'pro',
    isActive: true,
    journalismMode: false,
  },
  'internal-tenant': {
    id: 'internal-tenant',
    name: 'Internal Service',
    tier: 'internal',
    isActive: true,
    journalismMode: true,
  },
};

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

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
 * Authenticate a request using the in-memory API key map.
 * Returns tenant info or null.
 *
 * No longer requires a storage backend — keys are looked up directly.
 */
export async function authenticateRequest(
  request: Request,
): Promise<{ tenant: Tenant; apiKeyId: string } | null> {
  const rawKey = extractBearerToken(request);
  if (!rawKey) return null;

  const entry = apiKeyMap.get(rawKey);
  if (!entry) return null;

  const tenant = tenantDetails[entry.tenantId];
  if (!tenant || !tenant.isActive) return null;

  return { tenant, apiKeyId: `key-${entry.tenantId}` };
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
