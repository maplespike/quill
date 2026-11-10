// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_regional_authorities',
  description:
    'Search Canadian regional authority data — regional districts, municipalities, ' +
    'and local governance information across Canada including regional services, planning, and transit authorities.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — region, service, or authority name (e.g., "Metro Vancouver", "Peel Region", "regional transit")',
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
  if (!query.trim()) return { content: { tool: 'search_regional_authorities', query: '', error: 'No search query provided.' }, isError: true };
  try {
    const result = await searchCkan(query, limit);
    return { content: { tool: 'search_regional_authorities', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_regional_authorities', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
