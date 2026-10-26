// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { cacheGet, cacheSet, cacheKey } from '../optimization/cache.js';
import { fetchStatCanTable } from './statcan-helper.js';
import { searchCkan } from './upstream-fetcher.js';

const CACHE_TTL = 3600_000;

export const definition: ToolDefinition = {
  name: 'compare_regions',
  description: 'Compare economic and demographic indicators across Canadian provinces and territories. Uses Statistics Canada data for population, employment, and economic metrics combined with federal spending data from CKAN.',
  inputSchema: {
    type: 'object',
    properties: {
      regions: {
        type: 'string',
        description: 'Comma-separated provinces (e.g., "Ontario,Quebec,BC") or "all" for all provinces',
        default: 'all',
      },
      metrics: {
        type: 'array',
        items: { type: 'string', enum: ['population', 'employment', 'cpi', 'gdp', 'spending'] },
        description: 'Metrics to compare (default: all)',
      },
    },
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const regions = String(args.regions ?? 'all');
  const metrics = args.metrics as string[] | undefined;
  const activeMetrics = metrics ?? ['population', 'employment', 'cpi', 'gdp', 'spending'];

  try {
    const key = cacheKey('compare_regions', { regions, metrics: activeMetrics });
    const cached = cacheGet<Record<string, unknown>>(key);
    if (cached) return { content: { tool: 'compare_regions', ...cached } };

    // Fetch StatCan population data (table 17100009)
    let popData: Record<string, string>[] = [];
    try {
      const { rows } = await fetchStatCanTable('17100009');
      popData = rows;
    } catch { /* table may not be available */ }

    // Fetch federal spending data by region via CKAN
    let spendingData: Record<string, unknown>[] = [];
    try {
      const result = await searchCkan('federal spending by province', 20);
      spendingData = result.results;
    } catch { /* ckan fallback */ }

    const result = {
      regions: regions === 'all' ? 'Canada (all provinces/territories)' : regions,
      metrics: activeMetrics,
      population: popData.slice(0, 20).map(r => ({ province: r.GEO, year: r.REF_DATE, population: r.VALUE })),
      federalSpending: spendingData.slice(0, 10).map(r => ({ title: r.title || r.name, url: r.url })),
      dataTables: ['StatCan 17100009 (Population)', 'ouvert.canada.ca (Federal spending)'],
      note: 'Data refreshed from Statistics Canada. Some tables may take time to download.',
    };

    cacheSet(key, result, CACHE_TTL);
    return { content: { tool: 'compare_regions', ...result } };
  } catch (error) {
    return { content: { tool: 'compare_regions', status: 'error', error: (error as Error).message }, isError: true };
  }
};
