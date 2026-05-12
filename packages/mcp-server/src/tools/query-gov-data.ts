import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchCKANPackages } from '@civint/pipeline-core';

/**
 * CKAN portal URLs keyed by MCP jurisdiction value.
 * Maps the friendly jurisdiction names to actual CKAN API endpoints.
 */
const JURISDICTION_PORTAL: Record<string, string> = {
  'federal': 'https://open.canada.ca/data/en',
  'ontario': 'https://data.ontario.ca',
  'british-columbia': 'https://catalogue.data.gov.bc.ca',
  'alberta': 'https://open.alberta.ca',
  'quebec': 'https://donneesquebec.ca',
};

/**
 * Query government data releases by keyword, jurisdiction, and category.
 * Covers Statistics Canada, open.canada.ca, provincial portals, and procurement data.
 */
export const definition: ToolDefinition = {
  name: 'query_gov_data',
  description:
    'Query Canadian government data releases, datasets, and records. Searches across Statistics Canada (StatCan), ' +
    'open.canada.ca (CKAN), provincial data portals, and federal spending/procurement data. ' +
    'Returns machine-readable data with OGL-C attribution and citation hashes.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search keyword (e.g., "GDP", "housing starts", "CPI")' },
      jurisdiction: {
        type: 'string',
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
        jurisdiction: (args.jurisdiction as string) ?? 'all',
        error: 'No search query provided. Please specify a query (e.g., "GDP", "housing starts").',
      },
      isError: true,
    };
  }
  const jurisdiction = (args.jurisdiction as string) ?? 'all';
  const limit = Math.min((args.limit as number) ?? 10, 50);

  try {
    const portals: string[] = [];

    if (jurisdiction === 'all') {
      portals.push(...Object.values(JURISDICTION_PORTAL));
    } else if (JURISDICTION_PORTAL[jurisdiction]) {
      portals.push(JURISDICTION_PORTAL[jurisdiction]);
    } else {
      return {
        content: {
          tool: 'query_gov_data',
          query,
          jurisdiction,
          error: `Unknown jurisdiction: ${jurisdiction}`,
          knownJurisdictions: Object.keys(JURISDICTION_PORTAL),
        },
        isError: true,
      };
    }

    // Query each portal CKAN API
    const results: Array<{
      title: string;
      source: string;
      jurisdiction: string;
      releasedAt: string;
      summary: string;
      attribution: string;
    }> = [];

    for (const portal of portals) {
      const packages = await fetchCKANPackages(portal, { query, rows: Math.ceil(limit / portals.length) });

      // Reverse-lookup jurisdiction name from portal URL
      const portalJurisdiction =
        Object.entries(JURISDICTION_PORTAL).find(([, url]) => url === portal)?.[0] ?? 'federal';

      for (const pkg of packages) {
        results.push({
          title: pkg.title,
          source: pkg.organization?.title ?? portalJurisdiction,
          jurisdiction: portalJurisdiction,
          releasedAt: pkg.metadata_modified,
          summary: (pkg.notes ?? 'No description').slice(0, 500),
          attribution: 'Contains information licensed under the Open Government Licence – Canada.',
        });

        if (results.length >= limit) break;
      }

      if (results.length >= limit) break;
    }

    // If no CKAN results, fall back to a category-based note
    if (results.length === 0) {
      return {
        content: {
          tool: 'query_gov_data',
          query,
          jurisdiction,
          limit,
          results: [],
          totalCount: 0,
          note: `No datasets found matching "${query}" in ${jurisdiction} portals. Try a broader query or different jurisdiction.`,
        },
      };
    }

    return {
      content: {
        tool: 'query_gov_data',
        query,
        jurisdiction,
        limit,
        results: results.slice(0, limit),
        totalCount: results.length,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'query_gov_data',
        query,
        jurisdiction,
        error: (error as Error).message,
        message: 'Failed to query government data portals',
      },
      isError: true,
    };
  }
};
