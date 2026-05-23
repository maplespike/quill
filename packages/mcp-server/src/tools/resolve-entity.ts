/**
 * resolve_entity MCP Tool — MapleSpike
 *
 * Resolve an entity across all MapleSpike modules and return
 * a cross-module profile. Proxies to the API server's /entity/resolve endpoint.
 */

import type { ToolDefinition, ToolHandler } from './types.js';

export const definition: ToolDefinition = {
  name: 'resolve_entity',
  description:
    'Resolve an entity (person/organization/location) across all MapleSpike modules. ' +
    'Returns appearances in committees, lobbying, corporate filings, GIC appointments, and more. ' +
    'Use this to find all records mentioning a specific person or organization.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Entity name or partial name to search' },
      entity_type: {
        type: 'string',
        enum: ['person', 'organization', 'location'],
        description: 'Filter by entity type',
      },
      confidence_threshold: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Minimum confidence score (0-1, default 0.6)',
      },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (params) => {
  const { query, entity_type, confidence_threshold = 0.6 } = params as Record<string, unknown>;

  try {
    const api = await import('./api-client.js');
    const apiParams: Record<string, string | number> = {
      q: query as string,
      confidence: confidence_threshold as number,
      _format: 'compact',
    };
    if (entity_type) {
      apiParams.type = entity_type as string;
    }

    const data = await api.callApi<{ entities: Record<string, unknown>[] }>('/entity/resolve', apiParams);

    return {
      content: {
        tool: 'resolve_entity',
        query,
        total_entities: data.entities?.length ?? 0,
        entities: data.entities ?? [],
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'resolve_entity',
        query,
        error: (error as Error).message,
        note: 'Entity resolution requires the API server to have entity_mentions endpoints configured.',
      },
      isError: true,
    };
  }
};
