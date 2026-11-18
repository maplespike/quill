// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchJson, cached } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_valet_api',
  description:
    'Search Bank of Canada Valet API — official exchange rates, interest rates, ' +
    'commodity prices, and economic indicators. More granular than the general ' +
    'Bank of Canada search (this uses the Valet REST API directly).',
  inputSchema: {
    type: 'object',
    properties: {
      series: {
        type: 'string',
        description: 'Series group or name (e.g., "FXUSDCAD" for USD/CAD, "V39079" for overnight rate, "COMMODITIES" for commodity index)',
      },
      recent: {
        type: 'number',
        description: 'Number of most recent observations to return (default 30)',
      },
    },
    required: ['series'],
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const series = String(args.series ?? '').toUpperCase();
  const recent = Number(args.recent ?? 30);

  if (!series.trim()) {
    return { content: { tool: 'search_valet_api', error: 'No series provided. Try "FXUSDCAD" for USD/CAD exchange rate.' }, isError: true };
  }

  try {
    const result = await cached('valet_api', { series, recent }, async () => {
      const url = `https://www.bankofcanada.ca/valet/observations/${series}/json?recent=${recent}`;
      const data = await fetchJson<Record<string, unknown>>(url);
      return {
        results: (data as any)?.observations ?? [],
        seriesDetail: (data as any)?.seriesDetail ?? {},
        total: (data as any)?.observations?.length ?? 0,
      };
    });

    return {
      content: {
        tool: 'search_valet_api',
        series,
        ...result,
        _citation: {
          source_name: 'Bank of Canada Valet API',
          source_url: `https://www.bankofcanada.ca/valet/observations/${series}/json`,
          license: 'Bank of Canada Terms of Use',
          retrieved_at: new Date().toISOString(),
        },
      },
    };
  } catch (err) {
    return {
      content: {
        tool: 'search_valet_api',
        series,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      isError: true,
    };
  }
};
