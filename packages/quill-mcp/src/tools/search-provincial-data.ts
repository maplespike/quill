// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchProvincialData } from './upstream-fetcher.js';

const PROVINCES: Record<string, string> = {
  'ns': 'Nova Scotia', 'nb': 'New Brunswick', 'on': 'Ontario',
  'bc': 'British Columbia', 'ab': 'Alberta', 'qc': 'Quebec',
  'mb': 'Manitoba', 'sk': 'Saskatchewan', 'nl': 'Newfoundland and Labrador',
  'pe': 'Prince Edward Island', 'yt': 'Yukon', 'nt': 'Northwest Territories', 'nu': 'Nunavut',
};

export const definition: ToolDefinition = {
  name: 'search_provincial_data',
  description: 'Search provincial government open data across all 13 provinces and territories. Uses CKAN, Socrata, and other APIs depending on the province. Filter by province code to narrow results.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search terms (e.g., "health", "education", "transportation")' },
      province: { type: 'string', enum: Object.keys(PROVINCES), description: 'Province code (ns, nb, on, bc, qc, ab, mb, sk, nl, pe, yt, nt, nu). Omit for all.' },
      limit: { type: 'number', minimum: 1, maximum: 50, description: 'Max results per province (default: 5)' },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '').trim();
  const province = (args.province as string) || '';
  const limit = Math.min((args.limit as number) ?? 5, 50);
  if (!query) return { content: { tool: 'search_provincial_data', error: 'No query' }, isError: true };

  try {
    const targets = province ? [province] : Object.keys(PROVINCES);
    const results: Record<string, { total: number; results: Record<string, unknown>[] }> = {};
    let totalAll = 0;

    for (const p of targets) {
      try {
        const r = await fetchProvincialData(p, query, limit);
        if (r.total > 0) { results[PROVINCES[p]] = r; totalAll += r.total; }
      } catch (err) {
        console.warn(`[search-provincial-data] Fetch failed for ${p}: ${(err as Error).message}`);
      }
    }

    return {
      content: {
        tool: 'search_provincial_data', query, provinceFilter: province || undefined,
        provincesSearched: targets.length, provincesWithResults: Object.keys(results).length,
        results, totalResults: totalAll,
        source: 'https://ouvert.canada.ca + provincial portals',
        retrievedAt: new Date().toISOString(),
        license: 'OGL-Canada / OGL-Province',
      },
    };
  } catch (error) {
    return { content: { tool: 'search_provincial_data', error: (error as Error).message }, isError: true };
  }
};
