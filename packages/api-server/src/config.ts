/**
 * MapleSpike Canada — Configuration
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
}

export function loadConfig(env: Env | Record<string, string | undefined>): AppConfig {
  return {
    version: env.CIVINT_VERSION as string || '0.1.0',
    name: env.CIVINT_NAME as string || 'MapleSpike Canada',
    environment: (env.ENVIRONMENT as 'development' | 'production') || 'development',
    aiEndpoint: env.AI_ENDPOINT as string || 'http://127.0.0.1:8080/v1',
    aiModel: env.AI_MODEL as string || 'qwen3.5-27b',
  };
}
