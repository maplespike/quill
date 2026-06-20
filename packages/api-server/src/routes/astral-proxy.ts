/**
 * MapleSpike — Astral Key Proxy
 *
 * Proxies authentication requests to the Astral Key microservice.
 * Allows the browser to use passkey/Web3 auth without needing a separate domain.
 *
 * All /v1/auth/astral/* routes proxy to Astral Key's /api/v1/auth/* endpoints.
 */

import type { RouteHandler } from '../types.js';
import { jsonResponse, buildError, type BuildContext } from '../response.js';

const ASTRAL_KEY_URL = process.env.ASTRAL_KEY_URL
  || 'http://astral-key.astral-key.svc.cluster.local:8080';

async function proxyToAstral(path: string, method: string, body?: unknown, authHeader?: string): Promise<{ status: number; data: unknown }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authHeader) headers['Authorization'] = authHeader;

    const resp = await fetch(`${ASTRAL_KEY_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const data = await resp.json().catch(() => ({}));
    return { status: resp.status, data };
  } catch (err) {
    return { status: 502, data: { error: { code: 'ASTRAL_KEY_UNREACHABLE', message: 'Astral Key service is unavailable' } } };
  }
}

// Web3 nonce
export const astralWeb3NonceHandler: RouteHandler = async (request, ctx) => {
  const body = await request.json().catch(() => ({}));
  const result = await proxyToAstral('/api/v1/auth/web3/nonce', 'POST', body);
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  return jsonResponse(result.data as any, result.status);
};

// Web3 verify (login)
export const astralWeb3VerifyHandler: RouteHandler = async (request, ctx) => {
  const body = await request.json().catch(() => ({}));
  const result = await proxyToAstral('/api/v1/auth/web3/verify', 'POST', body);
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };

  // If Astral Key returns a JWT, also create a MapleSpike tenant + API key
  if (result.status === 200 && (result.data as any)?.access_token) {
    const akData = result.data as any;
    const address = body.address || akData.user?.wallet_address || '';
    try {
      const { generateApiKey } = await import('../auth.js');
      const { rawKey, keyHash } = await generateApiKey();
      const keyId = 'key_' + Array.from(new Uint8Array(16)).map(() => Math.random().toString(16).slice(2, 4)).join('');
      const tenantId = 'tn_' + address.toLowerCase().slice(2, 18);
      const tenant = {
        id: tenantId, name: `Wallet ${address.slice(0, 8)}`, email: '',
        emailVerified: false, tier: 'free' as const, isActive: true, journalismMode: false,
      };
      const extDb = ctx.db as any;
      if (typeof extDb.registerTenant === 'function') {
        extDb.registerTenant(tenant, keyHash, keyId);
      }
      return jsonResponse({
        ...akData,
        apiKey: { id: keyId, key: rawKey },
        message: 'Web3 authentication successful. Save your API key.',
      });
    } catch {
      // Key creation failed — still return the Astral Key JWT
    }
  }

  return jsonResponse(result.data as any, result.status);
};

// FIDO2 register options
export const astralFido2RegisterOptionsHandler: RouteHandler = async (request, ctx) => {
  const authHeader = request.headers.get('Authorization') || '';
  const result = await proxyToAstral('/api/v1/auth/fido2/register/options', 'POST', {}, authHeader);
  return jsonResponse(result.data as any, result.status);
};

// FIDO2 register verify
export const astralFido2RegisterVerifyHandler: RouteHandler = async (request, ctx) => {
  const authHeader = request.headers.get('Authorization') || '';
  const body = await request.json().catch(() => ({}));
  const result = await proxyToAstral('/api/v1/auth/fido2/register/verify', 'POST', body, authHeader);
  return jsonResponse(result.data as any, result.status);
};

// FIDO2 authenticate options (login begin)
export const astralFido2AuthOptionsHandler: RouteHandler = async (request, ctx) => {
  const body = await request.json().catch(() => ({}));
  const result = await proxyToAstral('/api/v1/auth/fido2/authenticate/options', 'POST', body);
  return jsonResponse(result.data as any, result.status);
};

// FIDO2 authenticate verify (login complete)
export const astralFido2AuthVerifyHandler: RouteHandler = async (request, ctx) => {
  const body = await request.json().catch(() => ({}));
  const result = await proxyToAstral('/api/v1/auth/fido2/authenticate/verify', 'POST', body);
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };

  // If login returns JWT, create MapleSpike tenant + API key
  if (result.status === 200 && (result.data as any)?.access_token) {
    const akData = result.data as any;
    try {
      const { generateApiKey } = await import('../auth.js');
      const { rawKey, keyHash } = await generateApiKey();
      const keyId = 'key_' + Array.from(new Uint8Array(16)).map(() => Math.random().toString(16).slice(2, 4)).join('');
      const userId = akData.user?.id || akData.access_token?.slice(0, 16) || 'passkey-user';
      const tenantId = 'tn_' + userId.slice(0, 16);
      const tenant = {
        id: tenantId, name: 'Passkey User', email: '',
        emailVerified: false, tier: 'free' as const, isActive: true, journalismMode: false,
      };
      const extDb = ctx.db as any;
      if (typeof extDb.registerTenant === 'function') {
        extDb.registerTenant(tenant, keyHash, keyId);
      }
      return jsonResponse({
        ...akData,
        apiKey: { id: keyId, key: rawKey },
        message: 'Passkey authentication successful. Save your API key.',
      });
    } catch {
      // Key creation failed
    }
  }

  return jsonResponse(result.data as any, result.status);
};

// Web3 chains list
export const astralWeb3ChainsHandler: RouteHandler = async (_request, _ctx) => {
  const result = await proxyToAstral('/api/v1/auth/web3/chains', 'GET');
  return jsonResponse(result.data as any, result.status);
};

// Health check
export const astralHealthHandler: RouteHandler = async (_request, _ctx) => {
  const result = await proxyToAstral('/health', 'GET');
  return new Response(JSON.stringify({ astral_key: result.data, status: result.status === 200 ? 'healthy' : 'unhealthy' }), {
    status: result.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
