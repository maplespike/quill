import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_legislation',
  description:
    'Search Canadian legislation and regulations — consolidated federal laws, ' +
    'provincial statutes, regulatory proposals, and legislative instruments from ' +
    'Justice Canada, provincial publishers (e-Laws, BC Laws, Données Québec), and CKAN sources.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — act name, regulation title, jurisdiction, or keyword',
      },
      jurisdiction: {
        type: 'string',
        description: 'Filter by jurisdiction: federal, ON, BC, AB, QC, or province code',
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
        tool: 'search_legislation',
        query: '',
        error: 'No search query provided. Specify an act name, regulation, or keyword.',
      },
      isError: true,
    };
  }

  const limit = Math.min((args.limit as number) ?? 10, 50);
  const jurisdiction = (args.jurisdiction as string) ?? '';
  const result = await searchGovData(query, jurisdiction || 'all', limit);
  let results = result.results;

  if (jurisdiction) {
    const j = jurisdiction.toLowerCase();
    results = results.filter((r: any) =>
      JSON.stringify(r).toLowerCase().includes(j)
    );
  }

  return {
    content: {
      tool: 'search_legislation',
      query,
      jurisdiction: jurisdiction || undefined,
      limit,
      results,
      totalCount: jurisdiction ? results.length : result.total,
    },
  };
};
