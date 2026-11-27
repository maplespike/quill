// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchStatCanTable } from './statcan-helper.js';

export const definition: ToolDefinition = {
  name: 'query_population',
  description: 'Population estimates for Canada, provinces and territories from Statistics Canada. Uses Statistics Canada data. Returns time-series data with values and reference dates.',
  inputSchema: { type: 'object', properties: {
    limit: { type: 'number', minimum: 1, maximum: 100, description: 'Data points to return' },
  } },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  try {
    const limit = Math.min((args.limit as number) ?? 20, 100);
    const { rows, header } = await fetchStatCanTable('17100009');
    return { content: { tool: 'query_population', data: rows.slice(0, limit), total: rows.length, source: 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=17100009' } };  
  } catch (error) {
    // A TypeError thrown by DecompressionStream has an empty `message`, so the
    // old handler reported the bare string "TypeError" and hid the cause for
    // weeks. Name the error type, keep the message or stack, and log it.
    const name = error instanceof Error ? error.name : 'Error';
    const detail = error instanceof Error ? (error.message || error.stack || '') : String(error);
    console.error(`[query_population] StatCan table 17100009 failed — ${name}: ${detail || '(no message)'}`);
    return {
      content: {
        tool: 'query_population',
        error: `StatCan table 17100009 could not be read — ${name}${detail ? `: ${detail.split('\n')[0]}` : ' (no message)'}`,
      },
      isError: true,
    };
  }
};
