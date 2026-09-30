// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchJson, cached } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_yukon_data',
  description: 'Search Yukon government open data from the CKAN portal at open.yukon.ca (3,785 datasets across 25 organizations including Yukon Geological Survey, Geomatics Yukon, Environment, Health and Social Services, etc.).',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', maxLength: 2000, description: 'Search terms (e.g., "geology", "mining", "environment", "demographics")' },
      limit: { type: 'number', minimum: 1, maximum: 50, description: 'Maximum results to return (default: 10)' },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '').trim();
  const limit = Math.min(Math.max((args.limit as number) ?? 10, 1), 50);
  if (!query) return { content: { tool: 'search_yukon_data', error: 'No query' }, isError: true };

  try {
    const { results, total } = await cached('yukon', { query, limit }, async () => {
      const json = await fetchJson<{ result: { results: Record<string, unknown>[]; total: number } }>(
        `https://open.yukon.ca/api/3/action/package_search?q=${encodeURIComponent(query)}&rows=${limit}`,
      );
      return { results: json.result?.results ?? [], total: json.result?.total ?? 0 };
    });
    return {
      content: {
        tool: 'search_yukon_data',
        query,
        limit,
        results,
        totalCount: total,
        province: 'Yukon',
        source: 'https://open.yukon.ca',
        license: 'Dataset-specific publisher license declarations are included on individual results where supplied; no blanket Yukon license is asserted.',
        retrievedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return { content: { tool: 'search_yukon_data', error: (error as Error).message }, isError: true };
  }
};
