import type { ToolDefinition, ToolHandler } from './types.js';
import { searchRecords, getPipelineData, liveFetch } from './pipeline-data.js';

export const definition: ToolDefinition = {
  name: 'search_social_programs',
  description:
    'Search Social programs including CPP, EI, OAS, GIS data from Canadian government sources. ' +
    'Returns structured records with SHA-256 citation hashes and quality scores.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search terms' },
      limit: { type: 'number', minimum: 1, maximum: 50, description: 'Maximum results (default: 10)' },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args) => {
  const query = (args.query as string) ?? '';
  if (!query.trim()) {
    return { content: { tool: 'search_social_programs', error: 'No search query provided' }, isError: true };
  }
  const limit = Math.min((args.limit as number) ?? 10, 50);
  let results: any[], total: number;
  if (getPipelineData()) {
    const r = searchRecords(['social_programs'], query, limit);
    results = r.results; total = r.total;
  } else {
    const r = await liveFetch(['social_programs'], query, limit);
    results = r.results; total = r.total;
  }
  return { content: { tool: 'search_social_programs', query, limit, results, totalCount: total } };
};
