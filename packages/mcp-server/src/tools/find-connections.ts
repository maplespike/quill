/**
 * find_connections MCP Tool — MapleSpike
 *
 * Find relationships between entities across modules.
 * Proxies to the API server's /entity/connections endpoint.
 */

import type { ToolDefinition, ToolHandler } from './types.js';

export const definition: ToolDefinition = {
  name: 'find_connections',
  description:
    'Find relationships and connections between entities (people, organizations) across modules. ' +
    'Returns a graph of directorships, lobbying relationships, employment links, and more. ' +
    'Use after resolve_entity to explore an entity\'s network.',
  inputSchema: {
    type: 'object',
    properties: {
      entity_id: { type: 'string', description: 'Entity ID (from resolve_entity output)' },
      relationship_type: {
        type: 'string',
        enum: ['works_at', 'is_director_of', 'lobbied_for', 'represents', 'all'],
        description: 'Filter by relationship type (default: all)',
      },
      max_depth: {
        type: 'number',
        minimum: 1,
        maximum: 3,
        description: 'Graph search depth (default: 2)',
      },
    },
    required: ['entity_id'],
  },
};

export const handler: ToolHandler = async (params) => {
  const { entity_id, relationship_type = 'all', max_depth = 2 } = params as Record<string, unknown>;

  try {
    const api = await import('./api-client.js');
    const data = await api.callApi<{ nodes: Record<string, unknown>[]; edges: Record<string, unknown>[] }>(
      '/entity/connections',
      {
        entity_id: entity_id as string,
        relationship: relationship_type as string,
        depth: max_depth as number,
        _format: 'compact',
      },
    );

    return {
      content: {
        tool: 'find_connections',
        root_entity: entity_id,
        depth: max_depth,
        nodes: data.nodes ?? [],
        edges: data.edges ?? [],
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'find_connections',
        entity_id,
        error: (error as Error).message,
        note: 'Entity connections require the API server to have entity_relationships endpoints configured.',
      },
      isError: true,
    };
  }
};
