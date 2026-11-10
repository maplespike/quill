// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import * as api from './api-client.js';
import { searchCkan } from './upstream-fetcher.js';

const KNOWN_JURISDICTIONS = ['federal', 'ontario', 'british-columbia', 'alberta', 'quebec', 'all'];

/**
 * Query government data via the MapleSpike API server.
 * All data sources (pipeline, CKAN, StatCan) are queried through
 * the API, ensuring MCP and REST always return the same results.
 */
export const definition: ToolDefinition = {
  name: 'query_gov_data',
  description:
    'Query Canadian government data releases, datasets, and records. Searches across Statistics Canada (StatCan), ' +
    'open.canada.ca (CKAN), provincial data portals, and federal spending/procurement data. ' +
    'Returns machine-readable results with source metadata; record hashes and publisher terms metadata are included only where supplied, and coverage depends on which sources respond.',
  descriptions: {
    "fr-CA": "Interroger les données gouvernementales provenant de multiples sources canadiennes configurées, dont Statistique Canada, le portail CKAN ouvert.canada.ca et les portails de données ouvertes provinciaux (ON, BC, AB, QC). Prend en charge la recherche par mot-clé, juridiction et catégorie. Les résultats incluent les métadonnées de source, ainsi qu’un hachage d’enregistrement et les conditions du fournisseur uniquement lorsque celles-ci sont fournies.",
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', maxLength: 2000, description: 'Search keyword (e.g., "GDP", "housing starts", "CPI")' },
      jurisdiction: {
        type: 'string',
        maxLength: 2000,
        enum: ['federal', 'ontario', 'british-columbia', 'alberta', 'quebec', 'all'],
        description: 'Jurisdiction filter (default: all)',
      },
      category: {
        type: 'string',
        enum: ['economy', 'demographics', 'health', 'justice', 'environment', 'education', 'social', 'spending', 'all'],
        description: 'Data category filter',
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
        tool: 'query_gov_data',
        query: '',
        error: 'No search query provided. Please specify a query (e.g., "GDP", "housing starts").',
      },
      isError: true,
    };
  }

  const limit = Math.min((args.limit as number) ?? 10, 50);
  const jurisdiction = (args.jurisdiction as string) || 'all';

  // Validate jurisdiction against known values
  if (!KNOWN_JURISDICTIONS.includes(jurisdiction)) {
    return {
      content: {
        tool: 'query_gov_data',
        query,
        jurisdiction,
        limit,
        results: [],
        totalCount: 0,
        error: `Unknown jurisdiction "${jurisdiction}". Valid jurisdictions: ${KNOWN_JURISDICTIONS.join(', ')}`,
        knownJurisdictions: KNOWN_JURISDICTIONS,
      },
      isError: true,
    };
  }

  try {
    const data = await searchCkan(query, limit);

    return {
      content: {
        tool: 'query_gov_data',
        query,
        jurisdiction,
        limit,
        results: data.results,
        totalCount: data.total,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'query_gov_data',
        query,
        jurisdiction,
        limit,
        results: [],
        totalCount: 0,
        error: (error instanceof Error && error.message) || String(error),
        knownJurisdictions: KNOWN_JURISDICTIONS,
        note: 'Falling back to direct CKAN query. The API server may be unavailable.',
      },
      isError: true,
    };
  }
};
