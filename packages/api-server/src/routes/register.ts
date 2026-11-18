// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Registration / Self-Service Routes
 *
 * POST /v1/register — Creates a new tenant + API key
 * GET  /v1/me      — Returns current tenant info + usage (requires auth)
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import { generateApiKey } from '../auth.js';
import { TIER_LIMITS } from '../types.js';
import type { Tenant, QuillStorage } from '../types.js';
import { sendVerificationEmail, sendWelcomeEmail } from '../email.js';
import { registerSchema, validateBody, validationError } from '../validation.js';
import pino from 'pino';

const log = pino({
  level: process.env.QUILL_LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
    : undefined,
});


// Decision 0002: registration accepts `email` but only the
// `emailHash` is persisted. The plaintext is consumed once for
// sending the verification mail and immediately discarded. We
// never echo `email` back in the response.

interface RegisterBody {
  name?: string;
  email?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const registerHandler: RouteHandler = async (request, ctx) => {
  try {
    // Rate limit: allow max 5 registration attempts per IP per minute
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
    const rateKey = `rate:register:${ip}`;
    const attempts = parseInt(await ctx.cache.get(rateKey) || '0', 10);
    if (attempts >= 5) {
      return jsonResponse(buildError('RATE_LIMITED', 'Too many registration attempts. Try again later.', ctx), 429);
    }
    await ctx.cache.put(rateKey, String(attempts + 1), 60);

    // Parse body
    let body: RegisterBody = {};
    try {
      body = await request.json() as RegisterBody;
    } catch {
      return jsonResponse(buildError('INVALID_BODY', 'Request body must be valid JSON', ctx), 400);
    }

    const parsed = validateBody(registerSchema, body);
    if (!parsed.success) {
      return validationError(parsed.error, ctx, parsed.issues);
    }

    const name = parsed.data.name.trim();

    const email = parsed.data.email.trim();
    if (!email) {
      return jsonResponse(buildError('VALIDATION_ERROR', 'Field "email" is required', ctx), 400);
    }
    if (!EMAIL_RE.test(email)) {
      return jsonResponse(buildError('VALIDATION_ERROR', 'Invalid email format', ctx), 400);
    }

    // Hash the plaintext email immediately. After this line,
    // `emailHash` is the only durable artifact on our side.
    const { hashPii } = await import('../auth/pii-hash.js');
    const emailHash = hashPii(email);

    // Generate IDs
    const tenantId = generateId('tn');
    const keyId = generateId('key');

    // Generate API key + email verification token
    const { rawKey, keyHash } = await generateApiKey();
    const verificationToken = generateToken();

    const tenant: Tenant = {
      id: tenantId,
      name,
      emailHash,
      emailVerified: false,
      verificationToken,
      tier: 'free',
      isActive: true,
      journalismMode: false,
    };

    await persistRegistration(ctx.db, tenant, keyHash, keyId);

    // Send verification email (async, non-blocking). The
    // plaintext email leaves us here and never returns.
    sendVerificationEmail({ to: email, name, token: verificationToken }).catch(err =>
      log.error({ requestId: ctx.requestId }, `Failed to send verification email: ${err}`)
    );

    // Send welcome/onboarding email immediately (the plaintext email
    // is consumed here and never stored — Decision 0002 allows this
    // one-time use). Welcome email is separate from verification so
    // users get getting-started info even before clicking the link.
    sendWelcomeEmail({ to: email, name }).catch(err =>
      log.error({ requestId: ctx.requestId }, `Failed to send welcome email: ${err}`)
    );

    // Decision 0002: response echoes `emailVerified: false` but
    // never the plaintext email. The hash is internal-only.
    return jsonResponse(buildSuccess({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        emailVerified: false,
        tier: tenant.tier,
      },
      apiKey: {
        id: keyId,
        name: 'default',
        key: rawKey,
      },
      verificationUrl: `/v1/verify/${verificationToken}`,
      message: 'Registration successful. Verify your email to activate all features. Save your API key — it will not be shown again.',
    }, ctx), 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    log.error({ requestId: ctx.requestId }, `Register error: ${message}`);
    return jsonResponse(buildError('REGISTRATION_FAILED', message, ctx), 500);
  }
};


export const verifyHandler: RouteHandler = async (request, ctx, params) => {
  try {
    const token = params?.token;
    if (!token || token.length < 10) {
      return jsonResponse(buildError('INVALID_TOKEN', 'Invalid verification token', ctx), 400);
    }

    // Look up tenant by verification token (iterate — only feasible for small user base)
    // In production, add a lookup index. For now, we check via storage adaptation.
    // Scan tenants by trying to find a matching token
    const db = ctx.db as any;

    // Check if storage has a verifyEmail method (SqliteStorage)
    if (typeof db.verifyEmail === 'function') {
      const result = db.verifyEmail(token);
      if (!result) {
        return jsonResponse(buildError('INVALID_TOKEN', 'Verification token not found or expired', ctx), 404);
      }
      // Decision 0002: result contains `emailHash` only. The
      // original plaintext never returns from the verify path,
      // so we cannot re-send a welcome email here. The user
      // authenticates via Astral-key on next request and the
      // verification flag is enough.
      return jsonResponse(buildSuccess({ verified: true, message: 'Email verified successfully.' }, ctx));
    }

    return jsonResponse(buildError('NOT_SUPPORTED', 'Verification not available on this storage backend', ctx), 501);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verification failed';
    log.error({ requestId: ctx.requestId }, `Verify error: ${message}`);
    return jsonResponse(buildError('VERIFICATION_FAILED', message, ctx), 500);
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

    // Decision 0002: response shape now omits `email`. The hash is
    // internal-only and never leaks to API callers.
    return jsonResponse(buildSuccess({
      tenant: {
        id: ctx.tenant.id,
        name: ctx.tenant.name,
        emailVerified: ctx.tenant.emailVerified,
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
  db: QuillStorage,
  tenant: Tenant,
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
