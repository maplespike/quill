// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_proactive_disclosure',
  description:
    'Search federal proactive disclosure data — government contracts over $10K, ' +
    'travel and hospitality expenses, and position reclassifications. ' +
    'Covers the contracts and expenses published in the federal proactive disclosure datasets this tool reaches; ' +
    'departments or periods absent from those datasets are not represented.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — vendor name, department, or keyword (e.g., "IBM", "PSPC", "IT consulting")',
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
        tool: 'search_proactive_disclosure',
        query: '',
        error: 'No search query provided. Try a vendor name, department, or keyword.',
      },
      isError: true,
    };
  }

  try {
    const result = await searchCkan(query, limit);
    return {
      content: {
        tool: 'search_proactive_disclosure',
        query,
        limit,
        ...result,
      },
    };
  } catch (err) {
    return {
      content: {
        tool: 'search_proactive_disclosure',
        query,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      isError: true,
    };
  }
};
