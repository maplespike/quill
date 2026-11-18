// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchJson, cached } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_nutrient_file',
  description:
    'Search the Canadian Nutrient File — food composition data from Health Canada. ' +
    'Find nutrient values (calories, protein, fat, carbs, vitamins, minerals) for Canadian food products.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Food name to search for (e.g., "cheddar cheese", "whole wheat bread", "apple")',
      },
      lang: {
        type: 'string',
        enum: ['en', 'fr'],
        description: 'Language (en or fr, default en)',
      },
      limit: {
        type: 'number',
        description: 'Max results to return (default 10)',
      },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '');
  const lang = String(args.lang ?? 'en');
  const limit = Number(args.limit ?? 10);

  if (!query.trim()) {
    return { content: { tool: 'search_nutrient_file', error: 'No food name provided.' }, isError: true };
  }

  try {
    const baseUrl = 'https://food-nutrition.canada.ca/api/canadian-nutrient-file';

    const result = await cached('nutrient_file', { query, lang, limit }, async () => {
      const url = `${baseUrl}/food?lang=${lang}&q=${encodeURIComponent(query)}&limit=${limit}`;
      const data = await fetchJson<Record<string, unknown>[]>(url);
      return {
        results: data?.slice(0, limit) ?? [],
        total: data?.length ?? 0,
      };
    });

    return {
      content: {
        tool: 'search_nutrient_file',
        query,
        ...result,
        _citation: {
          source_name: 'Health Canada Canadian Nutrient File',
          source_url: 'https://food-nutrition.canada.ca',
          license: 'Dataset-specific publisher license declaration is not included by this endpoint; consult the publisher terms.',
          retrieved_at: new Date().toISOString(),
        },
      },
    };
  } catch (err) {
    return {
      content: {
        tool: 'search_nutrient_file',
        query,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      isError: true,
    };
  }
};
