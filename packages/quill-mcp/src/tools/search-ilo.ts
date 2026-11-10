// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_ilo',
  description:
    'Search ILO (International Labour Organization) labour statistics — employment, unemployment, wages, ' +
    'and labour force indicators across 187 countries. Covers employment-to-population ratios, ' +
    'unemployment rates, wage data, and labour force participation. Data sourced from ILOSTAT API.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search term — indicator name, country, or topic (e.g., "unemployment Canada", "employment rate", "labour force")',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 50,
        description: 'Maximum results to return (default: 10)',
      },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args) => {
  const query = (args.query as string) ?? '';
  if (!query.trim()) {
    return {
      content: {
        tool: 'search_ilo',
        query: '',
        error: 'No search query provided.',
      },
      isError: true,
    };
  }

  const limit = Math.min((args.limit as number) ?? 10, 50);

  try {
    const result = await searchGovData(query, 'all', limit);
    return {
      content: {
        tool: 'search_ilo',
        query,
        limit,
        results: result.results,
        total: result.total,
        summary: `Found ${result.total} result(s) for "${query}"`,
      },
    };
  } catch {
    return {
      content: {
        tool: 'search_ilo',
        query,
        limit,
        results: [],
        total: 0,
        error: 'Search failed. ILO data may be temporarily unavailable.',
      },
      isError: true,
    };
  }
};
