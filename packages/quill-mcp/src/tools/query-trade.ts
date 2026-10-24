// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchStatCanTable } from './statcan-helper.js';

export const definition: ToolDefinition = {
  name: 'query_trade',
  description: 'International merchandise trade data from Statistics Canada. Uses Statistics Canada data. Returns time-series data with values and reference dates.',
  inputSchema: { type: 'object', properties: {
    limit: { type: 'number', minimum: 1, maximum: 100, description: 'Data points to return' },
  } },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  try {
    const limit = Math.min((args.limit as number) ?? 20, 100);
    const { rows, header } = await fetchStatCanTable('12100090');
    return { content: { tool: 'query_trade', data: rows.slice(0, limit), total: rows.length, source: 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=12100090' } };  
  } catch (error) {
    return { content: { tool: 'query_trade', error: (error instanceof Error && error.message) || String(error) }, isError: true };
  }
};
