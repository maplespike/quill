// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_bank_of_canada',
  description:
    'Search Bank of Canada data — interest rate decisions, monetary policy reports, ' +
    'Financial System Reviews, and executive speeches. ' +
    'Covers overnight rate changes, quantitative easing, and monetary policy frameworks.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — topic, date, or speaker (e.g., "overnight rate 2024", "inflation outlook", "Tiff Macklem")',
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
        tool: 'search_bank_of_canada',
        query: '',
        error: 'No search query provided. Try a topic, date, or speaker name.',
      },
      isError: true,
    };
  }

  try {
    const result = await searchCkan(query, limit);
    return {
      content: {
        tool: 'search_bank_of_canada',
        query,
        limit,
        ...result,
      },
    };
  } catch (err) {
    return {
      content: {
        tool: 'search_bank_of_canada',
        query,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      isError: true,
    };
  }
};
