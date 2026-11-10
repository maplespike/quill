/**
 * Quill — Astral Key Proxy
 *
 * Proxies authentication requests to the Astral Key microservice.
 * Allows the browser to use passkey/Web3 auth without needing a separate domain.
 *
 * All /v1/auth/astral/* routes proxy to Astral Key's /api/v1/auth/* endpoints.
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, jsonResponse, buildError, type BuildContext } from '../response.js';
import { portalOrigin } from '@maplespike/pipeline-core/config/public-base-url';

function astralKeyUrl(): string | undefined {
  const value = process.env.ASTRAL_KEY_URL?.trim();
  return value || undefined;
}

async function proxyToAstral(path: string, method: string, body?: unknown, authHeader?: string): Promise<{ status: number; data: unknown }> {
  const base = astralKeyUrl();
  if (!base) {
    return {
      status: 503,
      data: {
        error: {
          code: 'ASTRAL_KEY_DISABLED',
          message: 'Astral Key is disabled. Set ASTRAL_KEY_URL to enable Web3 and passkey proxy auth.',
          message_fr: 'Astral Key est désactivé. Définissez ASTRAL_KEY_URL pour activer l’authentification.',
        },
      },
    };
  }
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authHeader) headers['Authorization'] = authHeader;

    const resp = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const data = await resp.json().catch(() => ({}));
    return { status: resp.status, data };
  } catch (err) {
    return { status: 502, data: { error: { code: 'ASTRAL_KEY_UNREACHABLE', message: 'Astral Key service is unavailable', message_fr: 'Le service Astral Key est indisponible' } } };
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

// Solana Web3: generate nonce
export const astralSolanaNonceHandler: RouteHandler = async (request, ctx) => {
  const body = await request.json().catch(() => ({}));
  const publicKey = (body.publicKey || body.address || '').toString();
  if (!publicKey) {
    return jsonResponse(buildError('VALIDATION_ERROR', 'Solana public key is required', ctx), 400);
  }

  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  const message = `MapleSpike Quill wants you to sign in with your Solana account:\n${publicKey}\n\nSign in to MapleSpike Quill\n\nURI: ${portalOrigin()}\nVersion: 1\nNonce: ${nonce}`;

  const nonceKey = `solana:nonce:${publicKey}`;
  await ctx.cache.put(nonceKey, nonce, 300); // 5 min TTL

  return jsonResponse(buildSuccess({ nonce, message, publicKey }, ctx));
};

// Solana Web3: verify signature and login
export const astralSolanaVerifyHandler: RouteHandler = async (request, ctx) => {
  const body = await request.json().catch(() => ({}));
  const { publicKey, signature, message } = body as Record<string, string>;
  if (!publicKey || !signature || !message) {
    return jsonResponse(buildError('VALIDATION_ERROR', 'publicKey, signature, and message are required', ctx), 400);
  }

  // Verify nonce was requested
  const nonceKey = `solana:nonce:${publicKey}`;
  const storedNonce = await ctx.cache.get(nonceKey);
  if (!storedNonce) {
    return jsonResponse(buildError('AUTH_ERROR', 'No nonce found. Request a nonce first.', ctx), 400);
  }
  await ctx.cache.delete(nonceKey);

  // Verify the message contains the stored nonce
  if (!message.includes(storedNonce)) {
    return jsonResponse(buildError('AUTH_ERROR', 'Nonce mismatch. Possible replay attack.', ctx), 403);
  }

  // Verify Ed25519 signature using tweetnacl
  try {
    const nacl = await import('tweetnacl');
    const bs58 = await import('bs58');

    const msgBytes = new TextEncoder().encode(message);
    const bs58Decode = (bs58 as any).default?.decode || (bs58 as any).decode;
    const sigBytes = bs58Decode(signature);
    const pubKeyBytes = bs58Decode(publicKey);

    const valid = nacl.sign.detached.verify(msgBytes, sigBytes, pubKeyBytes);
    if (!valid) {
      return jsonResponse(buildError('AUTH_ERROR', 'Invalid signature. Message was not signed by the claimed public key.', ctx), 401);
    }

    // Create/update tenant
    const tenantId = 'sol_' + publicKey.slice(0, 32);
    const { generateApiKey } = await import('../auth.js');
    const { rawKey, keyHash } = await generateApiKey();
    const keyId = 'key_' + Array.from(new Uint8Array(16)).map(() => Math.random().toString(16).slice(2, 4)).join('');
    const tenant = {
      id: tenantId, name: `Solana ${publicKey.slice(0, 8)}...`, email: '',
      emailVerified: true, tier: 'free' as const, isActive: true, journalismMode: false,
    };
    const extDb = ctx.db as any;
    if (typeof extDb.registerTenant === 'function') {
      extDb.registerTenant(tenant, keyHash, keyId);
    } else if (typeof extDb.createTenant === 'function') {
      extDb.createTenant(tenant);
      if (typeof extDb.createApiKey === 'function') {
        extDb.createApiKey(keyId, tenantId, keyHash, 'default');
      }
    }

    return jsonResponse(buildSuccess({
      tenantId,
      apiKey: { id: keyId, key: rawKey },
      message: 'Solana authentication successful. Save your API key.',
    }, ctx));
  } catch (err) {
    const message2 = err instanceof Error ? err.message : 'Signature verification failed';
    return jsonResponse(buildError('AUTH_ERROR', message2, ctx), 401);
  }
};

// Health check
export const astralHealthHandler: RouteHandler = async (_request, _ctx) => {
  const result = await proxyToAstral('/health', 'GET');
  return new Response(JSON.stringify({ astral_key: result.data, status: result.status === 200 ? 'healthy' : 'unhealthy' }), {
    status: result.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
