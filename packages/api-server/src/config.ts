/**
 * MapleSpike — Configuration
 *
 * Central config derived from environment / wrangler vars.
 */

import type { Env } from './types.js';

export interface AppConfig {
  version: string;
  name: string;
  environment: 'development' | 'production';
  aiEndpoint: string;
  aiModel: string;
  jwtSecret: string;
}

const DEFAULT_JWT_SECRET = 'maplespike-jwt-secret-change-in-production';

/**
 * Validate that required environment configuration is not using known
 * default/development values. In production, this throws so the server
 * fails fast rather than serving with weak secrets. In development,
 * only a warning is emitted.
 */
export function validateConfig(env: Record<string, string | undefined>): void {
  const jwtSecret = env.JWT_SECRET as string;
  if (!jwtSecret || jwtSecret === DEFAULT_JWT_SECRET) {
    const envName = env.ENVIRONMENT as string || 'development';
    const msg = 'JWT_SECRET is using the default value. Set JWT_SECRET to a unique value. '
      + 'Generate one: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"';
    if (envName === 'production') {
      throw new Error(msg);
    }
    console.warn('[Config] Warning: ' + msg);
  }
}

export function loadConfig(env: Env | Record<string, string | undefined>): AppConfig {
  const jwtSecret = env.JWT_SECRET as string;
  return {
    version: env.MAPLESPIKE_VERSION as string || '0.1.0',
    name: env.MAPLESPIKE_NAME as string || 'MapleSpike',
    environment: (env.ENVIRONMENT as 'development' | 'production') || 'development',
    aiEndpoint: env.AI_ENDPOINT as string || 'http://127.0.0.1:8080/v1',
    aiModel: env.AI_MODEL as string || 'qwen3.5-27b',
    jwtSecret: jwtSecret || DEFAULT_JWT_SECRET,
  };
}
