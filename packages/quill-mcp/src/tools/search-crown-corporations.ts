// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_crown_corporations',
  description:
    'Search Canadian Crown corporation data — annual reports, quarterly financials, ' +
    'governance information for CBC, Canada Post, CMHC, EDC, VIA Rail, BDC, and other federal Crown corporations.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — corporation name, financial data, or year (e.g., "CBC revenue 2024", "Canada Post pension", "EDC exports")',
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
  if (!query.trim()) return { content: { tool: 'search_crown_corporations', query: '', error: 'No search query provided.' }, isError: true };
  try {
    const result = await searchCkan(query, limit);
    return { content: { tool: 'search_crown_corporations', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_crown_corporations', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
