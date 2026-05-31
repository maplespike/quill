/**
 * MapleSpike — API Key Management Routes
 *
 * GET    /v1/keys           — List API keys for the authenticated user
 * POST   /v1/keys           — Generate a new API key
 * DELETE /v1/keys/:id       — Revoke an API key
 */
import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';
import { generateApiKey, registerApiKey, revokeApiKey, listApiKeysForTenant } from '../auth.js';
import { hashApiKey } from '../auth.js';

const userKeyStore = new Map<string, Array<{ id: string; name: string; keyHash: string; keyPrefix: string; createdAt: string; lastUsed: string | null }>>();

export const listKeysHandler: RouteHandler = async (_request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  const tenantId = ctx.tenant.id;
  const keys = userKeyStore.get(tenantId) || [];
  return jsonResponse(buildSuccess({ keys: keys.map(k => ({ id: k.id, name: k.name, keyPrefix: k.keyPrefix, createdAt: k.createdAt, lastUsed: k.lastUsed })) }, bc));
};

export const createKeyHandler: RouteHandler = async (_request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  const tenantId = ctx.tenant.id;
  const { rawKey, keyHash } = await generateApiKey();
  const keyId = `key-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const keyPrefix = rawKey.slice(0, 12) + '...';

  if (!userKeyStore.has(tenantId)) userKeyStore.set(tenantId, []);
  userKeyStore.get(tenantId)!.push({ id: keyId, name: 'Default', keyHash, keyPrefix, createdAt: new Date().toISOString(), lastUsed: null });

  registerApiKey(rawKey, tenantId, 'Default');

  return jsonResponse(buildSuccess({ key: { id: keyId, rawKey, keyPrefix, name: 'Default' } }, bc));
};

export const revokeKeyHandler: RouteHandler = async (_request, ctx, params) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  const tenantId = ctx.tenant.id;
  const keyId = params?.[0];
  if (!keyId) return jsonResponse(buildError('MISSING_KEY_ID', 'Key ID required', bc), 400);

  const keys = userKeyStore.get(tenantId) || [];
  const key = keys.find(k => k.id === keyId);
  if (!key) return jsonResponse(buildError('KEY_NOT_FOUND', 'API key not found', bc), 404);

  const updated = keys.filter(k => k.id !== keyId);
  if (updated.length === 0) userKeyStore.delete(tenantId);
  else userKeyStore.set(tenantId, updated);

  return jsonResponse(buildSuccess({ revoked: keyId }, bc));
};
