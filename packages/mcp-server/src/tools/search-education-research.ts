import type { ToolDefinition, ToolHandler } from './types.js';
import { searchGovData } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'search_education_research',
  description:
    'Search Canadian education and research data — Tri-Council grants (CIHR, NSERC, SSHRC), ' +
    'Canada Research Chairs, Canada Foundation for Innovation funding, student loan statistics, ' +
    'and post-secondary education data. Covers federal research funding and education programs.',
  descriptions: {
    'fr-CA': 'Rechercher des données sur l\'éducation et la recherche canadiennes — subventions des trois organismes (IRSC, CRSNG, CRSH), chaires de recherche du Canada, financement de la FCI et statistiques sur les prêts étudiants.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — researcher name, university, grant program, or research topic (e.g., "CIHR cancer research", "NSERC engineering grant", "Canada Research Chair AI", "student loan default rate")',
      },
      council: {
        type: 'string',
        enum: ['cihr', 'nserc', 'sshrc', 'cfi', 'crc', 'student_loans', 'all'],
        description: 'Research council/program filter (default: all)',
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
        tool: 'search_education_research',
        query: '',
        error: 'No search query provided. Specify a researcher, university, or grant program.',
      },
      isError: true,
    };
  }

  const council = (args.council as string) ?? 'all';
  const limit = Math.min((args.limit as number) ?? 10, 50);

  const categoryFilters: Record<string, string> = {
    cihr: 'CIHR health medical research grant',
    nserc: 'NSERC science engineering research grant',
    sshrc: 'SSHRC social sciences humanities research grant',
    cfi: 'CFI Canada Foundation Innovation funding',
    crc: 'Canada Research Chair CRC',
    student_loans: 'student loan CSL debt default',
  };

  let searchQuery = query;
  if (council !== 'all') {
    const filter = categoryFilters[council];
    if (filter) {
      searchQuery = `${filter} ${query}`;
    }
  }

  const result = await searchGovData(searchQuery, 'federal', limit);

  return {
    content: {
      tool: 'search_education_research',
      query,
      council,
      limit,
      results: result.results,
      totalCount: result.total,
    },
  };
};
