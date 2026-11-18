// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_health',
  description:
    'Search Canadian health data — CIHI hospital wait times, health spending, surgical volumes, ' +
    'PHAC disease surveillance, opioid crisis data, CFIA food recalls, drug shortage alerts, ' +
    'and CADTH drug recommendation reviews. Covers federal and provincial health data from ' +
    'the Canadian Institute for Health Information, Public Health Agency of Canada, ' +
    'Canadian Food Inspection Agency, and other health agencies.',
  descriptions: {
    "fr-CA": "Rechercher des données sur la santé canadienne — temps d'attente, dépenses de santé, volumes chirurgicaux, surveillance des maladies, crise des opioïdes, rappels alimentaires, pénuries de médicaments et recommandations de la CADTH.",
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — condition, drug, procedure, agency, or province (e.g., "hip replacement wait times Ontario", "opioid deaths BC", "food recall salmonella")',
      },
      category: {
        type: 'string',
        enum: ['wait_times', 'spending', 'disease', 'opioids', 'food_safety', 'drug_shortages', 'drug_reviews', 'all'],
        description: 'Health data category filter (default: all)',
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
        tool: 'search_health',
        query: '',
        error: 'No search query provided. Specify a health condition, drug, procedure, or agency.',
      },
      isError: true,
    };
  }

  const category = (args.category as string) ?? 'all';
  const limit = Math.min((args.limit as number) ?? 10, 50);

  // Build health-specific search query by prepending health keywords
  const categoryFilters: Record<string, string> = {
    wait_times: 'wait time surgery diagnostic hospital',
    spending: 'health spending expenditure',
    disease: 'disease surveillance outbreak',
    opioids: 'opioid toxicity death overdose',
    food_safety: 'food recall inspection refusal',
    drug_shortages: 'drug shortage supply',
    drug_reviews: 'CADTH drug recommendation review',
  };

  let searchQuery = query;
  if (category !== 'all') {
    const filter = categoryFilters[category];
    if (filter) {
      searchQuery = `${filter} ${query}`;
    }
  }

  const result = await searchCkan(searchQuery, limit);
  let results = result.results;
  let total = result.total;

  return {
    content: {
      tool: 'search_health',
      query,
      category,
      limit,
      results,
      totalCount: total,
    },
  };
};
