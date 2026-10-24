// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchProvincialData } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_qc_data',
  description: 'Search Quebec (QC) government open data — RAMQ health insurance, immigration (MIFI), Cour du Québec records, education ministry data, environment, and more. Queries donneesquebec.ca CKAN portal.',
  descriptions: {
    'fr-CA': 'Rechercher des données ouvertes du gouvernement du Québec — données de la RAMQ, de l\'immigration, de la Cour du Québec, du ministère de l\'Éducation et plus. Interroge le portail CKAN de données Québec.',
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', maxLength: 2000, description: 'Search terms / termes de recherche (e.g., "santé", "immigration", "éducation", "environnement")' },
      limit: { type: 'number', minimum: 1, maximum: 50, description: 'Maximum results to return (default: 10)' },
      lang: { type: 'string', enum: ['en', 'fr'], description: 'Language hint. When fr, prioritizes French portal (donneesquebec.ca). Default: en' },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '').trim();
  const limit = Math.min((args.limit as number) ?? 10, 50);
  const lang = (args.lang as string) ?? 'en';
  if (!query) return { content: { tool: 'search_qc_data', error: 'No query' }, isError: true };

  try {
    const result = await fetchProvincialData('qc', query, limit, lang);
    return {
      content: {
        tool: 'search_qc_data',
        query,
        limit,
        lang,
        results: result.results,
        totalCount: result.total,
        province: 'Quebec',
        source: 'https://www.donneesquebec.ca',
        license: 'Dataset-specific publisher license declarations are included on individual results where supplied; no blanket Quebec license is asserted.',
        retrievedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return { content: { tool: 'search_qc_data', error: (error as Error).message }, isError: true };
  }
};
