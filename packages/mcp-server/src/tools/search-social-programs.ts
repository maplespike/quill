import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_social_programs',
  description:
    'Search Canadian social program data — CPP/OAS benefits, Employment Insurance (EI), ' +
    'Canada Child Benefit (CCB), poverty statistics, social assistance rates, and food security data. ' +
    'Covers federal and provincial social safety net programs.',
  descriptions: {
    'fr-CA': 'Rechercher des données sur les programmes sociaux canadiens — prestations RPC/SV, assurance-emploi, Allocation canadienne pour enfants, statistiques sur la pauvreté et taux d\'aide sociale.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — program name, benefit type, province, or social topic (e.g., "CPP disability benefits", "EI eligibility 2025", "child benefit amount", "poverty rate Ontario")',
      },
      program: {
        type: 'string',
        enum: ['cpp_oas', 'ei', 'ccb', 'poverty', 'social_assistance', 'food_security', 'all'],
        description: 'Social program filter (default: all)',
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
        tool: 'search_social_programs',
        query: '',
        error: 'No search query provided. Specify a program name, benefit type, or social topic.',
      },
      isError: true,
    };
  }

  const program = (args.program as string) ?? 'all';
  const limit = Math.min((args.limit as number) ?? 10, 50);

  const categoryFilters: Record<string, string> = {
    cpp_oas: 'CPP OAS pension retirement benefit',
    ei: 'employment insurance EI benefit',
    ccb: 'Canada child benefit CCB',
    poverty: 'poverty rate low income LIM',
    social_assistance: 'social assistance welfare rate',
    food_security: 'food security hunger food bank',
  };

  let searchQuery = query;
  if (program !== 'all') {
    const filter = categoryFilters[program];
    if (filter) {
      searchQuery = `${filter} ${query}`;
    }
  }

  const result = await searchGovData(searchQuery, 'federal', limit);

  return {
    content: {
      tool: 'search_social_programs',
      query,
      program,
      limit,
      results: result.results,
      totalCount: result.total,
    },
  };
};
