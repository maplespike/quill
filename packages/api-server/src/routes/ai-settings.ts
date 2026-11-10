/**
 * Quill — AI Settings & Bring Your Own Key
 *
 * GET  /v1/ai/settings  — Get current AI settings (keys masked)
 * PUT  /v1/ai/settings  — Update AI settings (provider, key, model, endpoint)
 *
 * Users can provide their own AI provider credentials. When set,
 * the AI ask/analyze endpoints route to the user's provider instead
 * of the default cluster gateway.
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';
import { validateBody } from '../validate.js';

// Valid BYOK providers
const VALID_PROVIDERS = ['default', 'openai', 'anthropic', 'openrouter', 'zai', 'nvidia', 'custom'];

interface AISettings {
  provider: string;
  apiKey?: string;
  model?: string;
  endpoint?: string;
}

// In-memory settings store (keyed by tenant ID)
// In production this would be in the database
const aiSettings = new Map<string, AISettings>();

export const aiSettingsGetHandler: RouteHandler = async (_request, ctx) => {
  const settings = aiSettings.get(ctx.tenant.id) || { provider: 'default' };

  // Mask API key for security
  const masked: AISettings = {
    provider: settings.provider,
    model: settings.model || '',
    endpoint: settings.endpoint || '',
    apiKey: settings.apiKey
      ? `${settings.apiKey.slice(0, 6)}...${settings.apiKey.slice(-4)}`
      : '',
  };

  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  return jsonResponse(buildSuccess({ settings: masked }, bc));
};

export const aiSettingsUpdateHandler: RouteHandler = async (request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };

  try {
    const body = await request.json() as Record<string, unknown>;
    const errs = validateBody(body, {
      provider: { type: 'string', required: true, maxLength: 50 },
      apiKey: { type: 'string', maxLength: 500 },
      model: { type: 'string', maxLength: 200 },
      endpoint: { type: 'string', maxLength: 500 },
    });
    if (errs.length > 0) {
      return jsonResponse(buildError('VALIDATION_ERROR', errs.map((e: { field: string; message: string }) => e.message).join('; '), bc), 400);
    }

    const provider = (body.provider as string).toLowerCase();
    if (!VALID_PROVIDERS.includes(provider)) {
      return jsonResponse(buildError('VALIDATION_ERROR', `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}`, bc), 400);
    }

    const existing = aiSettings.get(ctx.tenant.id) || { provider: 'default' };

    const updated: AISettings = {
      provider,
      // Only update apiKey if a new one is provided (don't clear on empty)
      apiKey: (body.apiKey as string) || existing.apiKey,
      model: (body.model as string) || undefined,
      endpoint: (body.endpoint as string) || undefined,
    };

    aiSettings.set(ctx.tenant.id, updated);

    return jsonResponse(buildSuccess({
      provider: updated.provider,
      model: updated.model || '',
      endpoint: updated.endpoint || '',
      apiKey: updated.apiKey ? `${updated.apiKey.slice(0, 6)}...${updated.apiKey.slice(-4)}` : '',
      message: provider === 'default'
        ? 'Using cluster default AI model.'
        : `BYOK configured for ${provider}. Your AI queries will use your own key.`,
    }, bc));
  } catch (err) {
    return jsonResponse(buildError('SETTINGS_ERROR', (err as Error).message, bc), 500);
  }
};

/**
 * Get the AI settings for a tenant (internal use by ai.ts).
 * Returns null if no BYOK configured.
 */
export function getTenantAISettings(tenantId: string): AISettings | null {
  const settings = aiSettings.get(tenantId);
  if (!settings || settings.provider === 'default' || !settings.apiKey) return null;
  return settings;
}

/**
 * Resolve the chat endpoint, API key, and model for a tenant.
 * Falls back to cluster defaults if no BYOK.
 */
export function resolveAIConfig(tenantId: string): {
  endpoint: string;
  apiKey: string;
  model: string;
  source: string;
} {
  const byok = getTenantAISettings(tenantId);
  if (!byok) {
    const endpoint = process.env.QUILL_AI_ENDPOINT?.trim() || '';
    if (!endpoint) {
      return {
        endpoint: '',
        apiKey: '',
        model: process.env.QUILL_AI_MODEL || 'glm-5.2',
        source: 'disabled',
      };
    }
    return {
      endpoint,
      apiKey: '',
      model: process.env.QUILL_AI_MODEL || 'glm-5.2',
      source: 'cluster-default',
    };
  }

  // BYOK: resolve endpoint per provider
  const PROVIDER_DEFAULTS: Record<string, { endpoint: string; model: string }> = {
    openai: { endpoint: 'https://api.openai.com/v1', model: 'gpt-4o' },
    anthropic: { endpoint: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-20250514' },
    openrouter: { endpoint: 'https://openrouter.ai/api/v1', model: 'deepseek/deepseek-chat' },
    zai: { endpoint: 'https://api.z.ai/api/paas/v4', model: 'glm-5.2' },
    nvidia: { endpoint: 'https://integrate.api.nvidia.com/v1', model: 'meta/llama-3.3-70b-instruct' },
    custom: { endpoint: byok.endpoint || 'http://localhost:8080/v1', model: byok.model || 'custom' },
  };

  const defaults = PROVIDER_DEFAULTS[byok.provider] || PROVIDER_DEFAULTS.custom;

  return {
    endpoint: byok.endpoint || defaults.endpoint,
    apiKey: byok.apiKey || '',
    model: byok.model || defaults.model,
    source: `byok-${byok.provider}`,
  };
}
