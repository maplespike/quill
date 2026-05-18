/**
 * MapleSpike — Authentication Middleware
 *
 * Multi-method authentication supporting:
 *   1. X-API-Key header (legacy, for server-to-server)
 *   2. Authorization: Bearer <jwt> (new, for user sessions)
 *   3. Cookie: session=<jwt> (new, for browser-based auth)
 *
 * Falls back through all three methods.
 */

import type { Tenant } from './types.js';
import { verifyToken, tokenFromRequest } from './auth/jwt.js';
import { getUser, getTenantForUser } from './auth/users.js';
import type { MapleSpikeStorage } from './types.js';

/* ------------------------------------------------------------------ */
/*  In-Memory API Key Store (legacy)                                   */
/* ------------------------------------------------------------------ */

interface ApiKeyEntry {
  tenantId: string;
  name: string;
}

const apiKeyMap = new Map<string, ApiKeyEntry>();

// Seed with demo and internal keys (backward compatibility)
apiKeyMap.set('maplespike-demo-key', { tenantId: 'demo-tenant', name: 'Demo User' });
apiKeyMap.set('maplespike-internal-key', { tenantId: 'internal-tenant', name: 'Internal Service' });
if (process.env.NODE_ENV !== 'production') {
  apiKeyMap.set('maplespike-dev-key', { tenantId: 'dev-tenant', name: 'Dev User' });
}

const tenantDetails: Record<string, Tenant> = {
  'demo-tenant': {
    id: 'demo-tenant',
    name: 'Demo User',
    emailVerified: true,
    tier: 'pro',
    isActive: true,
    journalismMode: false,
  },
  'internal-tenant': {
    id: 'internal-tenant',
    name: 'Internal Service',
    emailVerified: true,
    tier: 'internal',
    isActive: true,
    journalismMode: true,
  },
  'dev-tenant': {
    id: 'dev-tenant',
    name: 'Dev User',
    emailVerified: true,
    tier: 'pro',
    isActive: true,
    journalismMode: false,
  },
};

/* ------------------------------------------------------------------ */
/*  Auth Result Type                                                   */
/* ------------------------------------------------------------------ */

export interface AuthResult {
  tenant: Tenant;
  apiKeyId: string;
  authMethod: 'api-key' | 'jwt' | 'cookie';
  rotatedKey?: { id: string; key: string; expiresAt: string };
}

/* ------------------------------------------------------------------ */
/*  SHA-256 Hash (Web Crypto API)                                      */
/* ------------------------------------------------------------------ */

export async function hashApiKey(rawKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(rawKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ------------------------------------------------------------------ */
/*  API Key Extraction                                                 */
/* ------------------------------------------------------------------ */

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
 * Extract API key from X-API-Key header.
 */
function extractApiKeyHeader(request: Request): string | null {
  return request.headers.get('X-API-Key');
}

/* ------------------------------------------------------------------ */
/*  Multi-Method Authentication                                        */
/* ------------------------------------------------------------------ */

/**
 * Authenticate a request by trying all available auth methods in order:
 *   1. X-API-Key header (legacy)
 *   2. Authorization: Bearer <token> — check if JWT or API key
 *   3. Cookie: session=<jwt>
 *
 * Returns AuthResult or null if all methods fail.
 */
export async function authenticateRequest(
  request: Request,
  db?: MapleSpikeStorage,
): Promise<AuthResult | null> {
  // Method 1: X-API-Key header (legacy server-to-server)
  const apiKey = extractApiKeyHeader(request);
  if (apiKey) {
    const result = await authenticateWithApiKey(apiKey, db);
    if (result) return result;
  }

  // Method 2: Authorization header
  const bearerToken = extractBearerToken(request);
  if (bearerToken) {
    // Check if it's a JWT (3 dot-separated parts)
    if (bearerToken.split('.').length === 3) {
      const result = authenticateWithJwt(bearerToken, 'jwt');
      if (result) return result;
    } else {
      // Treat as legacy API key
      const result = await authenticateWithApiKey(bearerToken, db);
      if (result) return result;
    }
  }

  // Method 3: Cookie
  const cookieToken = tokenFromRequest(request);
  if (cookieToken) {
    const result = authenticateWithJwt(cookieToken, 'cookie');
    if (result) return result;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  API Key Authentication                                             */
/* ------------------------------------------------------------------ */

async function authenticateWithApiKey(
  rawKey: string,
  db?: MapleSpikeStorage,
): Promise<AuthResult | null> {
  const entry = apiKeyMap.get(rawKey);
  if (entry) {
    const tenant = tenantDetails[entry.tenantId];
    if (!tenant || !tenant.isActive) return null;
    return {
      tenant,
      apiKeyId: `key-${entry.tenantId}`,
      authMethod: 'api-key',
    };
  }

  if (!db) return null;
  const dbResult = await db.authenticate(rawKey);
  if (!dbResult) return null;
  return {
    tenant: dbResult.tenant,
    apiKeyId: dbResult.apiKeyId,
    authMethod: 'api-key',
    rotatedKey: dbResult.rotatedKey,
  };
}

/* ------------------------------------------------------------------ */
/*  JWT Authentication                                                 */
/* ------------------------------------------------------------------ */

function authenticateWithJwt(
  token: string,
  method: 'jwt' | 'cookie',
): AuthResult | null {
  const payload = verifyToken(token);
  if (!payload) return null;

  // Look up user
  const user = getUser(payload.sub);
  if (user) {
    const tenant = getTenantForUser(user.id);
    if (tenant && tenant.isActive) {
      return {
        tenant,
        apiKeyId: `jwt-${user.id}`,
        authMethod: method,
      };
    }
  }

  // Fallback: use the JWT payload directly if no user store entry
  return {
      tenant: {
        id: payload.sub,
        name: payload.email || payload.sub,
        email: payload.email,
        emailVerified: false,
        tier: payload.tier as Tenant['tier'],
        isActive: true,
        journalismMode: false,
      },
    apiKeyId: `jwt-${payload.sub}`,
    authMethod: method,
  };
}

/* ------------------------------------------------------------------ */
/*  API Key Generation (kept from original)                            */
/* ------------------------------------------------------------------ */

/**
 * Generate a new API key (maplespike_ prefix + 32 random hex chars).
 * Returns both the raw key (shown once) and the hash (stored).
 */
export async function generateApiKey(): Promise<{ rawKey: string; keyHash: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const rawKey = `maplespike_${hex}`;
  const keyHash = await hashApiKey(rawKey);
  return { rawKey, keyHash };
}

/**
 * Register a new API key entry (for dynamic key creation).
 */
export function registerApiKey(
  rawKey: string,
  tenantId: string,
  name: string,
): void {
  apiKeyMap.set(rawKey, { tenantId, name });
}

/**
 * Remove an API key entry (for revocation).
 */
export function revokeApiKey(rawKey: string): boolean {
  return apiKeyMap.delete(rawKey);
}

/**
 * List all registered API keys for a tenant.
 */
export function listApiKeysForTenant(tenantId: string): Array<{ name: string; keyPrefix: string }> {
  const keys: Array<{ name: string; keyPrefix: string }> = [];
  for (const [rawKey, entry] of apiKeyMap) {
    if (entry.tenantId === tenantId) {
      keys.push({
        name: entry.name,
        keyPrefix: rawKey.slice(0, 12) + '...',
      });
    }
  }
  return keys;
}
