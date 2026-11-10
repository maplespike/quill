// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchUtilities, UTILITY_PROVIDERS } from '@maplespike/pipeline-core/utilities';

export const definition: ToolDefinition = {
  name: 'search_utilities',
  description: 'Search Canadian utility providers by province or type. Covers a curated list of 15 major hydro, gas, and water utilities in 10 provinces and territories; Yukon, the Northwest Territories, and Nunavut are not represented.',
  inputSchema: { type: 'object', properties: {
    province: { type: 'string', description: 'Province code (ON, QC, BC, AB, etc.)' },
    type: { type: 'string', enum: ['hydro', 'gas', 'water', 'telecom'], description: 'Utility type' },
    query: { type: 'string', maxLength: 2000, description: 'Search by name or service area' },
  }},
};

export const handler: ToolHandler = async (args) => {
  const { province, type, query } = args as { province?: string; type?: string; query?: string };
  try {
    const results = searchUtilities({ province, type, query });
    return { content: { tool: 'search_utilities', total: results.length, totalProviders: UTILITY_PROVIDERS.length, utilities: results } };
  } catch (error) {
    return { content: { tool: 'search_utilities', error: (error as Error).message }, isError: true };
  }
};
