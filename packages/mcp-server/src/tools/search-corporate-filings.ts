import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_corporate_filings',
  description:
    'Search Canadian corporate filings and securities data — SEDAR+ filings, ' +
    'SEDI insider trade reports, Corporations Canada returns, and business ' +
    'registry data. Cross-references officers, directors, and corporate ' +
    'relationships with lobbying and political influence data.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — company name, director name, ticker, or filing type',
      },
      filingType: {
        type: 'string',
        description: 'Filter by filing type: insider_trades, securities_filings, corporate_registry',
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
        tool: 'search_corporate_filings',
        query: '',
        error: 'No search query provided. Specify a company name, director, or ticker.',
      },
      isError: true,
    };
  }

  const limit = Math.min((args.limit as number) ?? 10, 50);
  const result = await searchGovData(query, 'all', limit);
  let results = result.results;

  const filingType = (args.filingType as string) ?? '';
  if (filingType) {
    const ft = filingType.toLowerCase();
    results = results.filter((r: any) =>
      JSON.stringify(r).toLowerCase().includes(ft)
    );
  }

  return {
    content: {
      tool: 'search_corporate_filings',
      query,
      filingType: filingType || undefined,
      limit,
      results,
      totalCount: filingType ? results.length : result.total,
    },
  };
};
