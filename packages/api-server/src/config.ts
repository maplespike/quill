/**
 * Quill — Configuration
 *
 * Central config derived from environment / wrangler vars.
 */

import type { Env } from './types.js';
import pino from 'pino';

const log = pino({
  level: process.env.QUILL_LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
    : undefined,
});

/** Curated AI model with priority for routing */
export interface CuratedModel {
  name: string;
  priority: number;
  endpoint: string;
  gpu?: string;
  local: boolean;
}

/** Default curated model list — configured via env var overrides */
export const CURATED_MODELS: CuratedModel[] = [
  { name: 'qwen3.5-27b', priority: 1, endpoint: '/v1/chat/completions', local: true },
  { name: 'qwen3.6-moe-35b', priority: 2, endpoint: '/v1/chat/completions', gpu: 'gpu-0', local: true },
  { name: 'llama-3.3-70b', priority: 3, endpoint: '/v1/chat/completions', local: false },
];

export interface AppConfig {
  version: string;
  name: string;
  environment: 'development' | 'production';
  aiEndpoint: string;
  aiModel: string;
  curatedModels: CuratedModel[];
  jwtSecret: string;
}

const DEFAULT_JWT_SECRET = 'maplespike-jwt-secret-change-in-production';

/**
 * Validate that required environment configuration is not using known
 * default/development values. In production, this throws so the server
 * fails fast rather than serving with weak secrets. In development,
 * only a warning is emitted.
 */
/**
 * Money mode of a Stripe secret key, read from its prefix only.
 *
 * Stripe signs the mode into the key: `sk_live_` / `rk_live_` (restricted key)
 * spend real money, `sk_test_` / `rk_test_` do not. Nothing else in the process
 * could tell the two apart, so a live deployment holding a test key charged
 * nobody while the UI said the customer was subscribed (QUILL-AUDIT.md
 * 2026-10-24, P2: "STRIPE_ENV is decorative").
 *
 * The value is never returned or logged — only this classification.
 */
export type StripeKeyMode = 'live' | 'test' | 'unknown' | 'absent';

export function stripeKeyMode(value: string | undefined | null): StripeKeyMode {
  const key = (value ?? '').trim();
  if (key.length === 0) return 'absent';
  if (/^(sk|rk)_live_/.test(key)) return 'live';
  if (/^(sk|rk)_test_/.test(key)) return 'test';
  return 'unknown';
}

/**
 * Refuse to run when STRIPE_ENV disagrees with the key it was handed.
 *
 * STRIPE_ENV states the money mode this process bills in; the key's prefix
 * states the mode it can actually charge in. A disagreement is a configuration
 * error, not a warning: live traffic on a test key silently charges nothing,
 * and test traffic on a live key moves real money during a drill.
 *
 * A key that is absent or carries an unrecognised prefix never matches a
 * declared mode. Absent is a warning (checkout answers 503 by design);
 * unrecognised is an error, because the mode cannot be proven.
 *
 * The message names prefixes and modes only. No key material, not even a
 * suffix, reaches the log.
 */
export function validateStripeEnv(env: Record<string, string | undefined>): void {
  const declared = (env.STRIPE_ENV ?? '').trim().toLowerCase();
  if (!declared) return; // not declared: nothing to disagree with (dev, tests)

  if (declared !== 'live' && declared !== 'test') {
    throw new Error(
      `STRIPE_ENV must be "live" or "test" (got "${declared}"). Refusing to guess a money mode.`,
    );
  }

  const secretMode = stripeKeyMode(env.STRIPE_SECRET_KEY);
  if (secretMode === 'absent') {
    log.warn(
      `STRIPE_ENV=${declared} but STRIPE_SECRET_KEY is unset — checkout and billing will answer 503.`,
    );
  } else if (secretMode === 'unknown') {
    throw new Error(
      `STRIPE_ENV=${declared} but STRIPE_SECRET_KEY has no recognisable mode prefix ` +
        '(expected sk_live_, sk_test_, rk_live_ or rk_test_). Refusing to serve billing ' +
        'with a key whose mode cannot be proven.',
    );
  } else if (secretMode !== declared) {
    throw new Error(
      `STRIPE_ENV=${declared} but STRIPE_SECRET_KEY is a ${secretMode}-mode key ` +
        `(${secretMode === 'live' ? 'sk_live_/rk_live_' : 'sk_test_/rk_test_'} prefix). ` +
        `Refusing to start: ${declared === 'live' ? 'test keys charge nobody' : 'live keys charge real cards'}.`,
    );
  }

  // The test key is an escape hatch for drills and local work. It is only ever
  // allowed to be a test key, whatever STRIPE_ENV says.
  const testSecretMode = stripeKeyMode(env.STRIPE_TEST_SECRET_KEY);
  if (testSecretMode === 'live') {
    throw new Error(
      'STRIPE_TEST_SECRET_KEY carries a live-mode key (sk_live_/rk_live_ prefix). ' +
        'Refusing to start: a drill would charge real cards.',
    );
  }
}

export function validateConfig(env: Record<string, string | undefined>): void {
  const jwtSecret = env.JWT_SECRET as string;
  if (!jwtSecret || jwtSecret === DEFAULT_JWT_SECRET) {
    const envName = env.ENVIRONMENT as string || 'development';
    const msg = 'JWT_SECRET is using the default value. Set JWT_SECRET to a unique value. '
      + 'Generate one: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"';
    if (envName === 'production') {
      throw new Error(msg);
    }
    log.warn(`Warning: ${msg}`);
  }

  // Banking configuration is validated in the same breath as the signing
  // secret: both fail closed, and both are read once at boot.
  validateStripeEnv(env);
}

export function loadConfig(env: Env | Record<string, string | undefined>): AppConfig {
  const jwtSecret = env.JWT_SECRET as string;
  return {
    version: env.QUILL_VERSION as string || '0.1.0',
    name: env.QUILL_NAME as string || 'Quill',
    environment: (env.ENVIRONMENT as 'development' | 'production') || 'development',
    aiEndpoint: env.AI_ENDPOINT as string || 'http://127.0.0.1:8080/v1',
    aiModel: env.AI_MODEL as string || 'qwen3.5-27b',
    curatedModels: CURATED_MODELS,
    jwtSecret: jwtSecret || DEFAULT_JWT_SECRET,
  };
}
