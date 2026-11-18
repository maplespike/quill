// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — API Key Management Endpoints
 *
 * GET    /v1/keys       — List API keys for the current tenant
 * POST   /v1/keys       — Create a new API key
 * DELETE /v1/keys/:id   — Revoke an API key
 */

import type { RouteHandler, QuillStorage, Tenant } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import { generateApiKey } from '../auth.js';
import { canAccess } from '../feature-gates.js';

/**
 * Extended storage with optional key management methods.
 * Not all storage backends implement these (MemoryStorage uses registerTenant
 * instead), so we check their presence at runtime via typeof checks.
 */
interface ExtendedStorage extends QuillStorage {
  createApiKey?: (keyId: string, tenantId: string, keyHash: string, name: string, expiresAt?: string) => void | Promise<void>;
  registerTenant?: (tenant: Tenant, keyHash: string, keyId: string) => void | Promise<void>;
  revokeApiKey?: (keyId: string, tenantId: string) => void | Promise<void>;
}

export const listKeysHandler: RouteHandler = async (_request, ctx) => {
  // ── Feature gate: API key management requires Pro tier or higher ──
  if (!canAccess(ctx.tenant.tier, 'developerConsole')) {
    return jsonResponse(buildError('UPGRADE_REQUIRED',
      'API key management requires a Pro plan or higher. Upgrade at quill.maplespike.ca/billing.',
      ctx), 402);
  }

  const keys = await ctx.db.listApiKeys(ctx.tenant.id);
  return jsonResponse(buildSuccess({
    keys,
    total: keys.length,
  }, ctx));
};

export const createKeyHandler: RouteHandler = async (_request, ctx) => {
  // ── Feature gate: API key creation requires Pro tier or higher ──
  if (!canAccess(ctx.tenant.tier, 'developerConsole')) {
    return jsonResponse(buildError('UPGRADE_REQUIRED',
      'API key creation requires a Pro plan or higher. Upgrade at quill.maplespike.ca/billing.',
      ctx), 402);
  }

  try {
    const { rawKey, keyHash } = await generateApiKey();
    const keyId = 'key_' + Array.from(new Uint8Array(16))
      .map(() => Math.random().toString(16).slice(2, 4)).join('');

    const extDb = ctx.db as ExtendedStorage;
    if (typeof extDb.createApiKey === 'function') {
      extDb.createApiKey(keyId, ctx.tenant.id, keyHash, 'default');
    } else if (typeof extDb.registerTenant === 'function') {
      // MemoryStorage: re-register the tenant with the new key
      extDb.registerTenant(ctx.tenant, keyHash, keyId);
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
  // ── Feature gate: API key revocation requires Pro tier or higher ──
  if (!canAccess(ctx.tenant.tier, 'developerConsole')) {
    return jsonResponse(buildError('UPGRADE_REQUIRED',
      'API key revocation requires a Pro plan or higher. Upgrade at quill.maplespike.ca/billing.',
      ctx), 402);
  }

  const keyId = params.id;
  if (!keyId) {
    return jsonResponse(buildError('MISSING_KEY_ID', 'Key ID is required', ctx), 400);
  }

  try {
    const extDb = ctx.db as ExtendedStorage;
    if (typeof extDb.revokeApiKey === 'function') {
      extDb.revokeApiKey(keyId, ctx.tenant.id);
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
  // ── Feature gate: key rotation requires Pro tier or higher ──
  if (!canAccess(ctx.tenant.tier, 'developerConsole')) {
    return jsonResponse(buildError('UPGRADE_REQUIRED',
      'Key rotation requires a Pro plan or higher. Upgrade at quill.maplespike.ca/billing.',
      ctx), 402);
  }

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

    const extDb = ctx.db as ExtendedStorage;
    if (typeof extDb.revokeApiKey === 'function' &&
        typeof extDb.createApiKey === 'function') {
      extDb.revokeApiKey(keyId, ctx.tenant.id);
      extDb.createApiKey(newKeyId, ctx.tenant.id, keyHash, 'rotated', expiresAt.toISOString());
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
