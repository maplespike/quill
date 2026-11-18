// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_social_programs',
  description:
    'Search Canadian social programs data — CPP/OAS, Employment Insurance, Canada Child Benefit, ' +
    'poverty statistics, social assistance rates, and food security indicators.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — program, province, or year (e.g., "EI claims Ontario", "CCB payments", "poverty rate")',
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
  if (!query.trim()) return { content: { tool: 'search_social_programs', query: '', error: 'No search query provided.' }, isError: true };
  try {
    const result = await searchCkan(query, limit);
    return { content: { tool: 'search_social_programs', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_social_programs', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
