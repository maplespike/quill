/**
 * MapleSpike — API Key Management Endpoints
 *
 * GET    /v1/keys       — List API keys for the current tenant
 * POST   /v1/keys       — Create a new API key
 * DELETE /v1/keys/:id   — Revoke an API key
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import { generateApiKey } from '../auth.js';

export const listKeysHandler: RouteHandler = async (_request, ctx) => {
  const keys = await ctx.db.listApiKeys(ctx.tenant.id);
  return jsonResponse(buildSuccess({
    keys,
    total: keys.length,
  }, ctx));
};

export const createKeyHandler: RouteHandler = async (_request, ctx) => {
  try {
    const { rawKey, keyHash } = await generateApiKey();
    const keyId = 'key_' + Array.from(new Uint8Array(16))
      .map(() => Math.random().toString(16).slice(2, 4)).join('');

    // Persist via storage (both SqliteStorage and MemoryStorage support createApiKey/registerTenant)
    if (typeof (ctx.db as any).createApiKey === 'function') {
      (ctx.db as any).createApiKey(keyId, ctx.tenant.id, keyHash, 'default');
    } else if (typeof (ctx.db as any).registerTenant === 'function') {
      (ctx.db as any).registerTenant(ctx.tenant, keyHash, keyId);
    } else {
      return jsonResponse(buildError('STORAGE_ERROR', 'Storage backend does not support key creation', ctx), 500);
    }

    return jsonResponse(buildSuccess({
      id: keyId,
      name: 'default',
      key: rawKey,
      createdAt: new Date().toISOString(),
    }, ctx), 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Key creation failed';
    return jsonResponse(buildError('KEY_CREATION_FAILED', message, ctx), 500);
  }
};

export const deleteKeyHandler: RouteHandler = async (_request, ctx, params) => {
  const keyId = params.id;
  if (!keyId) {
    return jsonResponse(buildError('MISSING_KEY_ID', 'Key ID is required', ctx), 400);
  }

  try {
    if (typeof (ctx.db as any).revokeApiKey === 'function') {
      (ctx.db as any).revokeApiKey(keyId, ctx.tenant.id);
    } else {
      return jsonResponse(buildError('STORAGE_ERROR', 'Storage backend does not support key revocation', ctx), 500);
    }

    return jsonResponse(buildSuccess({
      id: keyId,
      revoked: true,
    }, ctx));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Key revocation failed';
    return jsonResponse(buildError('KEY_REVOCATION_FAILED', message, ctx), 500);
  }
};

/**
 * POST /v1/keys/:id/rotate — Rotate an API key (invalidate old, create new)
 * Returns the new key — shown once only (zero-knowledge)
 */
export const rotateKeyHandler: RouteHandler = async (_request, ctx, params) => {
  const keyId = params.id;
  if (!keyId) {
    return jsonResponse(buildError('MISSING_KEY_ID', 'Key ID is required', ctx), 400);
  }

  try {
    const { rawKey, keyHash } = await generateApiKey();
    const newKeyId = 'key_' + Array.from(new Uint8Array(16))
      .map(() => Math.random().toString(16).slice(2, 4)).join('');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    if (typeof (ctx.db as any).revokeApiKey === 'function' &&
        typeof (ctx.db as any).createApiKey === 'function') {
      (ctx.db as any).revokeApiKey(keyId, ctx.tenant.id);
      (ctx.db as any).createApiKey(newKeyId, ctx.tenant.id, keyHash, 'rotated', expiresAt.toISOString());
    } else {
      return jsonResponse(buildError('STORAGE_ERROR', 'Storage backend does not support key rotation', ctx), 500);
    }

    return jsonResponse(buildSuccess({
      previousKeyId: keyId,
      newKey: {
        id: newKeyId,
        key: rawKey,
        expiresAt: expiresAt.toISOString(),
      },
      message: 'Key rotated successfully. Save your new API key — it will not be shown again.',
    }, ctx));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Key rotation failed';
    return jsonResponse(buildError('KEY_ROTATION_FAILED', message, ctx), 500);
  }
};
