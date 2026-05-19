import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_bank_of_canada',
  description:
    'Search Bank of Canada data — interest rate decisions, monetary policy reports, ' +
    'Financial System Review, executive speeches, and economic indicators. ' +
    'Covers the overnight rate target, inflation forecasts, and financial stability assessments.',
  descriptions: {
    'fr-CA': 'Rechercher des données de la Banque du Canada — décisions sur les taux d\'intérêt, rapports de politique monétaire, Revue du système financier et discours des dirigeants.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — rate decision date, policy topic, speech topic, or economic indicator (e.g., "overnight rate decision 2025", "inflation forecast", "housing financial stability")',
      },
      category: {
        type: 'string',
        enum: ['rate_decisions', 'monetary_policy', 'financial_review', 'speeches', 'all'],
        description: 'Bank of Canada data category filter (default: all)',
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
        tool: 'search_bank_of_canada',
        query: '',
        error: 'No search query provided. Specify a rate decision, policy topic, or speech.',
      },
      isError: true,
    };
  }

  const category = (args.category as string) ?? 'all';
  const limit = Math.min((args.limit as number) ?? 10, 50);

  const categoryFilters: Record<string, string> = {
    rate_decisions: 'overnight rate target interest decision',
    monetary_policy: 'monetary policy report inflation forecast MPR',
    financial_review: 'financial system review stability risk FSR',
    speeches: 'speech governor senior deputy address',
  };

  let searchQuery = query;
  if (category !== 'all') {
    const filter = categoryFilters[category];
    if (filter) {
      searchQuery = `${filter} ${query}`;
    }
  }

  const result = await searchGovData(searchQuery, 'federal', limit);

  return {
    content: {
      tool: 'search_bank_of_canada',
      query,
      category,
      limit,
      results: result.results,
      totalCount: result.total,
    },
  };
};
