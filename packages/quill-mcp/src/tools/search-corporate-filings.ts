// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_corporate_filings',
  description:
    'Search Canadian corporate filings data — SEDAR+ regulatory filings, ' +
    'public company disclosures, annual reports, and financial statements filed with securities regulators.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — company name, ticker, or filing type (e.g., "Shopify financials", "TSX annual report", "insider report")',
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
  if (!query.trim()) return { content: { tool: 'search_corporate_filings', query: '', error: 'No search query provided.' }, isError: true };
  try {
    const result = await searchCkan(query, limit);
    return { content: { tool: 'search_corporate_filings', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_corporate_filings', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
