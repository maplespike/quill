// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_culture',
  description:
    'Search Canadian culture and heritage data — Canadian Heritage programs, cultural spending, ' +
    'arts grants to organizations, and federal cultural funding initiatives.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — program, organization, or year (e.g., "Canada Council grants", "heritage funding Ontario", "arts programs")',
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
  if (!query.trim()) return { content: { tool: 'search_culture', query: '', error: 'No search query provided.' }, isError: true };
  try {
    const result = await searchCkan(query, limit);
    return { content: { tool: 'search_culture', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_culture', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
