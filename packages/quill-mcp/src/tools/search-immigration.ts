import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

/**
 * Search immigration data — IRCC permanent residents, Express Entry, IRB refugee decisions,
 * and CBSA border enforcement statistics.
 */
export const definition: ToolDefinition = {
  name: 'search_immigration',
  description:
    'Search Canadian immigration data including IRCC permanent resident admissions, ' +
    'Express Entry summaries, IRB Refugee Protection Division decisions, and CBSA ' +
    'removal/enforcement statistics. Covers monthly PR admissions by province, ' +
    'country of citizenship, and category; quarterly refugee claim grant/refusal rates; ' +
    'and border enforcement actions.',
  descriptions: {
    'fr-CA': 'Rechercher des données sur l\'immigration canadienne, y compris les admissions de résidents permanents d\'IRCC, les résumés d\'Entrée express, les décisions de la Section de la protection des réfugiés de la CISR et les statistiques d\'exécution de l\'ASFC.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — country, province, category, or year (e.g., "India 2024", "refugee Syria", "Express Entry")',
      },
      source: {
        type: 'string',
        enum: ['ircc', 'irb', 'cbsa', 'all'],
        description: 'Source filter: IRCC (permanent residents/Express Entry), IRB (refugee decisions), CBSA (enforcement)',
      },
      year: {
        type: 'number',
        description: 'Filter by year',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 50,
        description: 'Maximum results (default: 10)',
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
        tool: 'search_immigration',
        query: '',
        error: 'No search query provided. Try "Canada permanent residents 2024" or "refugee claims Syria".',
      },
      isError: true,
    };
  }

  const limit = Math.min((args.limit as number) ?? 10, 50);
  const source = (args.source as string) ?? 'all';
  const year = args.year as number | undefined;

  // CKAN package_search has no field filter here, so the source is applied as
  // a query term — "ircc"/"irb"/"cbsa" all appear in the dataset titles. The
  // previous version built a `sourceKeys` array and never read it, so `source`
  // silently did nothing while the schema advertised it.
  const sourceTerm = source !== 'all' ? source : undefined;
  const q = [query, sourceTerm, year ? String(year) : undefined].filter(Boolean).join(' ');
  const result = await searchCkan(q, limit);
  let results = result.results;
  let total = result.total;

  return {
    content: {
      tool: 'search_immigration',
      query,
      source: source !== 'all' ? source : undefined,
      year,
      limit,
      results,
      totalCount: total,
    },
  };
};
