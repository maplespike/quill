/**
 * MapleSpike — Registration / Self-Service Routes
 *
 * POST /v1/register — Creates a new tenant + API key
 * GET  /v1/me      — Returns current tenant info + usage (requires auth)
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import { generateApiKey } from '../auth.js';
import { TIER_LIMITS } from '../types.js';
import type { MapleSpikeStorage } from '../types.js';


interface RegisterBody {
  name?: string;
  email?: string;
}

export const registerHandler: RouteHandler = async (request, ctx) => {
  try {
    // Parse body
    let body: RegisterBody = {};
    try {
      body = await request.json() as RegisterBody;
    } catch {
      return jsonResponse(buildError('INVALID_BODY', 'Request body must be valid JSON', ctx), 400);
    }

    const name = body.name?.trim();
    if (!name) {
      return jsonResponse(buildError('VALIDATION_ERROR', 'Field "name" is required', ctx), 400);
    }

    // Generate IDs
    const tenantId = generateId('tn');
    const keyId = generateId('key');

    // Generate API key
    const { rawKey, keyHash } = await generateApiKey();

    // Create tenant (default: free tier, active)
    const tenant = {
      id: tenantId,
      name,
      email: body.email?.trim() || undefined,
      tier: 'free' as const,
      isActive: true,
      journalismMode: false,
    };

    // Persist using storage — we check if the storage supports direct creation
    // by checking for a `createTenant` method (SqliteStorage) or falling back
    // to MemoryStorage's `registerTenant`
    await persistRegistration(ctx.db, tenant, keyHash, keyId);

    return jsonResponse(buildSuccess({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        email: tenant.email,
        tier: tenant.tier,
      },
      apiKey: {
        id: keyId,
        name: 'default',
        key: rawKey, // Return raw key — only shown once
      },
      message: 'Registration successful. Save your API key — it will not be shown again.',
    }, ctx), 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    console.error('[Register] Error:', message);
    return jsonResponse(buildError('REGISTRATION_FAILED', message, ctx), 500);
  }
};


export const meHandler: RouteHandler = async (_request, ctx) => {
  try {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const yearMonth = now.toISOString().slice(0, 7);

    const [dailyUsage, monthlyUsage] = await Promise.all([
      ctx.db.getDailyUsage(ctx.tenant.id, date),
      ctx.db.getMonthlyUsage(ctx.tenant.id, yearMonth),
    ]);

    const limits = TIER_LIMITS[ctx.tenant.tier] || TIER_LIMITS.free;

    return jsonResponse(buildSuccess({
      tenant: {
        id: ctx.tenant.id,
        name: ctx.tenant.name,
        email: ctx.tenant.email,
        tier: ctx.tenant.tier,
        journalismMode: ctx.tenant.journalismMode,
      },
      usage: {
        daily: {
          calls: dailyUsage,
          limit: limits.daily,
          remaining: Math.max(0, limits.daily - dailyUsage),
          percentUsed: Math.round((dailyUsage / limits.daily) * 100),
        },
        monthly: {
          calls: monthlyUsage,
          limit: limits.monthly,
          remaining: Math.max(0, limits.monthly - monthlyUsage),
          percentUsed: Math.round((monthlyUsage / limits.monthly) * 100),
        },
      },
      resetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
    }, ctx));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse(buildError('ME_FAILED', message, ctx), 500);
  }
};


function generateId(prefix: string): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex}`;
}

async function persistRegistration(
  db: MapleSpikeStorage,
  tenant: { id: string; name: string; email?: string; tier: 'free'; isActive: boolean; journalismMode: boolean },
  keyHash: string,
  keyId: string,
): Promise<void> {
  // SqliteStorage has createTenant/createApiKey helper methods
  if (typeof (db as any).createTenant === 'function') {
    (db as any).createTenant(tenant);
    (db as any).createApiKey(keyId, tenant.id, keyHash, 'default');
    return;
  }

  // MemoryStorage has registerTenant
  if (typeof (db as any).registerTenant === 'function') {
    (db as any).registerTenant(tenant, keyHash, keyId);
    return;
  }

  throw new Error('Storage backend does not support registration');
}
