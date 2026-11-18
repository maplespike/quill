import type { ToolDefinition, ToolHandler } from './types.js';
import * as api from './api-client.js';

export const definition: ToolDefinition = {
  name: 'check_tier',
  description:
    'Check your current API tier and available features. Returns your tier (free/pro/business/enterprise), ' +
    'daily and monthly usage limits, and which tools require a paid plan. ' +
    'Use this to understand what you can access before calling Pro-gated tools.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const handler: ToolHandler = async () => {
  try {
    const health = await api.getHealth();
    const usage = await api.getUsage().catch(() => null);

    const tier = usage?.tenant?.tier || health.tenant?.tier || 'free';
    const tierLimits: Record<string, { daily: number; monthly: number; features: string[] }> = {
      free: { daily: 35, monthly: 1000, features: ['Public data modules', 'Basic MCP tools', 'Citation + provenance', 'Community support'] },
      pro: { daily: 1700, monthly: 50000, features: ['All free features', 'Full-text search', 'AI ask/analyze', 'Entity resolution', 'API key management', 'Priority support'] },
      business: { daily: 8500, monthly: 250000, features: ['All pro features', 'Audit log', 'Custom rate limits', 'Dedicated support'] },
      enterprise: { daily: 35000, monthly: 1000000, features: ['All business features', 'Unlimited calls', 'On-premise deployment', 'SLA'] },
      internal: { daily: 35000, monthly: 1000000, features: ['All enterprise features', 'Internal tooling'] },
    };

    const limits = tierLimits[tier] || tierLimits.free;

    return {
      content: {
        tool: 'check_tier',
        tier,
        usage: {
          daily: { calls: usage?.usage?.daily?.calls ?? health.usage?.daily ?? 0, limit: limits.daily },
          monthly: { calls: usage?.usage?.monthly?.calls ?? health.usage?.monthly ?? 0, limit: limits.monthly },
        },
        features: limits.features,
        proGatedTools: ['ai_ask', 'ai_analyze', 'ai_search_semantic', 'search_gov_data', 'query_gov_data', 'get_entity_profile', 'find_connections', 'system_health'],
        upgradeUrl: 'https://quill.maplespike.ca/pricing',
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'check_tier',
        error: (error as Error).message,
        suggestion: 'Check your API key and network connection.',
      },
      isError: true,
    };
  }
};