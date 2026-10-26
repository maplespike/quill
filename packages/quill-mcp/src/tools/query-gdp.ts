// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchStatCanTable } from './statcan-helper.js';

export const definition: ToolDefinition = {
  name: 'query_gdp',
  description: 'Gross Domestic Product from Statistics Canada. Uses Statistics Canada data. Returns time-series data with values and reference dates.',
  inputSchema: { type: 'object', properties: {
    limit: { type: 'number', minimum: 1, maximum: 100, description: 'Data points to return' },
  } },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  try {
    const limit = Math.min((args.limit as number) ?? 20, 100);
    const { rows, header } = await fetchStatCanTable('36100114');
    return { content: { tool: 'query_gdp', data: rows.slice(0, limit), total: rows.length, source: 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=36100114' } };  
  } catch (error) {
    return { content: { tool: 'query_gdp', error: (error instanceof Error && error.message) || String(error) }, isError: true };
  }
};
