// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_education_research',
  description:
    'Search Canadian education and research data — Tri-Council grants (CIHR/NSERC/SSHRC), ' +
    'Canada Research Chairs, Canada Foundation for Innovation, and student loan statistics.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — researcher, institution, or program (e.g., "NSERC grant UBC", "Canada Research Chair AI", "SSHRC")',
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
  if (!query.trim()) return { content: { tool: 'search_education_research', query: '', error: 'No search query provided.' }, isError: true };
  try {
    const result = await searchCkan(query, limit);
    return { content: { tool: 'search_education_research', query, limit, ...result } };
  } catch (err) {
    return { content: { tool: 'search_education_research', query, error: err instanceof Error ? err.message : 'Unknown error' }, isError: true };
  }
};
