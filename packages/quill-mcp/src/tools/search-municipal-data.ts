// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { searchMunicipalData } from './upstream-fetcher.js';

const CITIES = ['toronto','vancouver','montreal','calgary','ottawa','edmonton','quebec','hamilton','mississauga'];

export const definition: ToolDefinition = {
  name: 'search_municipal_data',
  description: 'Search municipal open data across Canadian cities. Covers Toronto, Vancouver, Montreal, Calgary, Ottawa, Edmonton, Quebec City, Hamilton, Mississauga. When lang=fr, prioritizes French-language portals (donnees.montreal.ca, donnees.ville.quebec.qc.ca).',
  inputSchema: { type: 'object', properties: {
    query: { type: 'string', maxLength: 2000, description: 'Search terms (e.g., "budget", "transit", "crime", "permits")' },
    city: { type: 'string', enum: CITIES, description: 'City to search (omit for all)' },
    limit: { type: 'number', minimum: 1, maximum: 30, description: 'Results per city' },
    lang: { type: 'string', enum: ['en', 'fr'], description: 'Language. When fr, prioritizes French municipal portals. Default: en' },
  }, required: ['query'] },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '').trim();
  const city = (args.city as string) || '';
  const limit = Math.min((args.limit as number) ?? 5, 30);
  if (!query) return { content: { tool: 'search_municipal_data', error: 'No query' }, isError: true };

  try {
    const targets = city ? [city] : CITIES;
    const results: Record<string, { total: number }> = {};
    let totalAll = 0;
    for (const c of targets) {
      try { const r = await searchMunicipalData(c, query, limit); if (r.total > 0) { results[c] = { total: r.total }; totalAll += r.total; } } catch (err) {
        console.warn(`[search-municipal-data] Fetch failed for ${c}: ${(err as Error).message}`);
      }
    }
    return { content: { tool: 'search_municipal_data', query, cityFilter: city || undefined, citiesSearched: targets.length, citiesWithResults: Object.keys(results).length, results, totalResults: totalAll } };
  } catch (error) {
    return { content: { tool: 'search_municipal_data', error: (error as Error).message }, isError: true };
  }
};
