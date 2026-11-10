// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_geospatial',
  description:
    'Search Canadian geospatial data — federal geospatial databases, CKAN-based geospatial ' +
    'data across federal and provincial portals, topographic maps, and geographic information.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 500,
        description: 'Search terms — location, map type, or dataset (e.g., "topographic map Alberta", "satellite imagery", "geospatial data Ontario")',
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
  if (!query.trim()) return { content: { tool: 'search_geospatial', query: '', error: 'No search query provided.' }, isError: true };
  try {
    const result = await searchCkan(query, limit);
    return { content: { tool: 'search_geospatial', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_geospatial', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
