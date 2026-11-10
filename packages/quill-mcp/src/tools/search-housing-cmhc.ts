// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_housing_cmhc',
  description:
    'Search CMHC (Canada Mortgage and Housing Corporation) housing data — ' +
    'housing starts, rental market surveys, vacancy rates, average rents, ' +
    'housing affordability, mortgage arrears, and NHIP program data. ' +
    'More specific to CMHC than the general housing search.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — city, province, or topic (e.g., "Toronto rental vacancy", "housing starts Ontario", "affordable housing")',
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
    return { content: { tool: 'search_housing_cmhc', query: '', error: 'No search query provided.' }, isError: true };
  }
  try {
    const result = await searchCkan(`cmhc housing ${query}`, limit);
    return { content: { tool: 'search_housing_cmhc', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_housing_cmhc', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
