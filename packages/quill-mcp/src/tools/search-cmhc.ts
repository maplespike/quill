// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_cmhc',
  description:
    'Search CMHC (Canada Mortgage and Housing Corporation) data — housing starts, ' +
    'rental market reports, mortgage trends, and housing supply statistics. ' +
    'Covers national and provincial housing indicators.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — metric, province, or year (e.g., "housing starts Ontario 2024", "rental vacancy rate Toronto")',
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
    return {
      content: {
        tool: 'search_cmhc',
        query: '',
        error: 'No search query provided. Try a metric, province, or city.',
      },
      isError: true,
    };
  }

  try {
    const result = await searchCkan(query, limit);
    return {
      content: {
        tool: 'search_cmhc',
        query,
        limit,
        ...result,
      },
    };
  } catch (err) {
    return {
      content: {
        tool: 'search_cmhc',
        query,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      isError: true,
    };
  }
};
