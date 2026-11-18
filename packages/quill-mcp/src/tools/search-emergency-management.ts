// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_emergency_management',
  description:
    'Search Emergency Management & Public Safety data — Canadian Disaster Database, ECCC alerts, NRCan geohazards, and provincial emergencies.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — keyword, location, or category (e.g., relevant search terms for this dataset)',
      },
      limit: {
        type: 'number',
        description: 'Max results to return (default 20)',
      },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '');
  const limit = Number(args.limit ?? 20);
  if (!query.trim()) {
    return { content: { tool: 'search_emergency_management', query: '', error: 'No search query provided.' }, isError: true };
  }
  try {
    const result = await searchCkan(query + ' emergency management disaster', limit);
    return { content: { tool: 'search_emergency_management', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_emergency_management', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
