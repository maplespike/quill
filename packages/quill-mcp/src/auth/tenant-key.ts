// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Tenant API-key verification for the MCP surface.
 *
 * MCP and the HTTP API are separate services that must agree on what an API key
 * is. Before this, MCP accepted ONLY its single static QUILL_API_KEY (plus
 * delegated/Casdoor tokens), so every key a tenant was issued at signup got a
 * 401 on GET /sse — the surface was single-tenant in production.
 *
 * The API owns the key store, so MCP asks it: GET {QUILL_API_URL}/v1/auth/me
 * with the presented bearer. The API resolves the key to its tenant, and the
 * answer is accepted only when it names a real tenant.
 *
 * Fail closed: a timeout, a transport error, a non-2xx answer or an anon tenant
 * all mean "not authorized".
 */

export interface ApiVerifyResult {
  /** True only when the API resolved the token to a real (non-anon) tenant. */
  valid: boolean;
  /** Why it was rejected — for logs, never for the client. */
  reason: 'ok' | 'no-api-url' | 'no-token' | 'http-error' | 'unreachable' | 'anonymous';
  /** The tenant the API reported, when valid. */
  tenantId?: string;
}

const TIMEOUT_MS = 5000;

/**
 * Ask the API whether this bearer token belongs to a real tenant.
 *
 * @param token     The raw token from the Authorization header (no "Bearer ").
 * @param apiUrl    Base URL of the API server (QUILL_API_URL).
 * @param fetchImpl Injectable fetch, so this is testable without a network.
 */
export async function verifyTenantKeyWithApi(
  token: string,
  apiUrl: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<ApiVerifyResult> {
  if (!apiUrl) return { valid: false, reason: 'no-api-url' };
  if (!token) return { valid: false, reason: 'no-token' };

  const base = apiUrl.replace(/\/+$/, '');
  try {
    const res = await fetchImpl(`${base}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { valid: false, reason: 'http-error' };

    const body = (await res.json()) as { data?: { tenant?: { id?: string } } };
    const tenantId = body?.data?.tenant?.id;
    if (!tenantId || tenantId === 'anon') return { valid: false, reason: 'anonymous' };

    return { valid: true, reason: 'ok', tenantId };
  } catch {
    return { valid: false, reason: 'unreachable' };
  }
}
