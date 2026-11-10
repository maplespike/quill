// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchStatCanReleases } from '@maplespike/pipeline-core';

/**
 * Get the latest government data releases from Statistics Canada and federal/provincial portals.
 */
export const definition: ToolDefinition = {
  name: 'latest_releases',
  description:
    'Get the most recent government data releases, economic indicators, and announcements ' +
    'from Statistics Canada, open.canada.ca, and federal/provincial data portals. ' +
    'Use this to stay current on new datasets, revised statistics, and government publications.',
  descriptions: {
    "fr-CA": "Obtenir les plus récentes publications de données gouvernementales canadiennes, y compris les communiqués de Statistique Canada, les mises à jour de données du portail ouvert et les annonces provinciales. Filtrer par juridiction et catégorie.",
  },
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['economy', 'demographics', 'health', 'justice', 'environment', 'education', 'social', 'spending', 'all'],
        description: 'Filter by data category (default: all)',
      },
      jurisdiction: {
        type: 'string',
        enum: ['federal', 'ontario', 'british-columbia', 'alberta', 'quebec', 'all'],
        description: 'Jurisdiction filter (default: federal)',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 20,
        description: 'Maximum results to return (default: 5)',
      },
    },
  },
};

export const handler: ToolHandler = async (args) => {
  const category = (args.category as string) ?? 'all';
  const jurisdiction = (args.jurisdiction as string) ?? 'federal';
  const limit = Math.min((args.limit as number) ?? 5, 20);

  try {
    // Fetch real StatCan data via pipeline-core
    const statcanReleases = await fetchStatCanReleases({ limit: 50 });

    // Filter by category if not 'all'
    let filtered = statcanReleases;
    if (category !== 'all') {
      filtered = filtered.filter(r => r.category === category);
    }

    // Filter by jurisdiction — StatCan is always federal
    if (jurisdiction !== 'all' && jurisdiction !== 'federal') {
      // For provincial requests, we return an empty list with a note
      // (CKAN integration coming via query_gov_data for provincial portals)
      return {
        content: {
          tool: 'latest_releases',
          category,
          jurisdiction,
          limit,
          releases: [],
          totalCount: 0,
          note: `Statistics Canada covers federal data only. Use query_gov_data with jurisdiction="${jurisdiction}" for provincial data sources.`,
        },
      };
    }

    const releases = filtered.slice(0, limit).map(r => ({
      title: r.title,
      source: 'Statistics Canada',
      category: r.category,
      jurisdiction: r.jurisdiction,
      releasedAt: r.release_date ?? null,
      summary: r.description ?? 'No description available',
      url: r.data_url,
    }));

    return {
      content: {
        tool: 'latest_releases',
        category,
        jurisdiction,
        limit,
        releases,
        totalCount: releases.length,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'latest_releases',
        category,
        jurisdiction,
        error: (error as Error).message,
        message: 'Failed to fetch government data releases',
      },
      isError: true,
    };
  }
};
