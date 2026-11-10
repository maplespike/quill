// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchStatCanReleases, fetchCKANPackages } from '@maplespike/pipeline-core';
import { withClaims } from './claims-helper.js';

/**
 * Search selected configured data sources for records related to a claim.
 * Returned references are discovery results, not independent verification.
 */
export const definition: ToolDefinition = {
  name: 'fact_check',
  description:
    'Search selected configured sources, including Statistics Canada and CKAN portals, for records related to a claim. ' +
    'Returns matching records for review; this search does not independently verify the claim. Check citations with the original publisher.',
  descriptions: {
    "fr-CA": "Rechercher dans des sources configurées des dossiers liés à une affirmation. Les résultats sont des pistes à examiner et ne constituent pas une vérification indépendante; consultez les sources originales.",
  },
  inputSchema: {
    type: 'object',
    properties: {
      claim: {
        type: 'string',
        maxLength: 2000,
        description: 'The claim to fact-check (e.g., "unemployment rate rose to 6.5%", "defence spending increased 20%")',
      },
    },
    required: ['claim'],
  },
};

/**
 * Extract likely keywords from a claim for search.
 * Strips common stopwords and number/percentage patterns.
 */
function extractKeywords(claim: string): string[] {
  const stopwords = new Set([
    'the', 'a', 'an', 'is', 'was', 'are', 'were', 'been', 'being',
    'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'can', 'shall', 'to', 'of',
    'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
    'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'out', 'off', 'over', 'under', 'again', 'further',
    'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how',
    'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
    'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
    'than', 'too', 'very', 'just', 'because', 'but', 'and', 'or',
    'if', 'while', 'that', 'this', 'these', 'those', 'it', 'its',
    'about', 'up', 'down',
  ]);

  // Remove numbers, percentages, and punctuation
  const cleaned = claim.toLowerCase().replace(/[0-9%.$%,]+/g, '').replace(/[^\w\s]/g, '');
  const words = cleaned.split(/\s+/).filter(w => w.length > 2 && !stopwords.has(w));

  // Return top 3 most specific keywords (longest first)
  return [...new Set(words)].sort((a, b) => b.length - a.length).slice(0, 3);
}

export const handler: ToolHandler = async (args) => {
  const claim = args.claim as string ?? '';
  if (!claim.trim()) {
    return {
      content: {
        tool: 'fact_check',
        claim: '',
        keywords: [],
        result: {
          status: 'no_claim',
          confidence: 0,
          evidence: [],
          summary: 'No claim provided. Please include a specific claim or statistic to fact-check (e.g., "unemployment rate rose to 6.5%").',
        },
      },
    };
  }
  const keywords = extractKeywords(claim);

  try {
    const evidence: Array<{
      source: string;
      type: string;
      title: string;
      summary: string;
      url: string | null;
      relevance: string;
    }> = [];

    // 1. Search StatCan for relevant data cubes
    if (keywords.length > 0) {
      const statcanData = await fetchStatCanReleases({ limit: 30 });
      const matchingStatCan = statcanData.filter(r =>
        keywords.some(k => r.title.toLowerCase().includes(k) || (r.description ?? '').toLowerCase().includes(k)),
      );

      for (const match of matchingStatCan.slice(0, 3)) {
        evidence.push({
          source: 'Statistics Canada',
          type: 'data_cube',
          title: match.title,
          summary: match.description ?? 'No description available',
          url: match.data_url,
          relevance: `StatCan data product related to "${keywords.join(', ')}"`,
        });
      }
    }

    // 2. Search federal CKAN portal for related datasets
    if (keywords.length > 0) {
      const ckanData = await fetchCKANPackages('https://open.canada.ca/data/en', {
        query: keywords.join(' '),
        rows: 5,
      });

      for (const pkg of ckanData.slice(0, 3)) {
        evidence.push({
          source: 'Open Government Portal',
          type: 'dataset',
          title: pkg.title,
          summary: (pkg.notes ?? 'No description').slice(0, 300),
          url: pkg.url,
          relevance: `Government dataset matching claim keywords`,
        });
      }
    }

    return {
      content: await withClaims({
        tool: 'fact_check',
        claim,
        keywords,
        result: {
          status: evidence.length > 0 ? 'evidence_found' : 'no_evidence_found',
          confidence: evidence.length > 0 ? 60 : 0,
          evidence,
          summary:
            evidence.length > 0
              ? `Found ${evidence.length} records related to the claim "${claim}" in configured sources. Review each record with its original publisher; search results do not independently verify the claim.`
              : `No direct government data matches found for "${claim}". Try rephrasing or focusing on specific statistics (e.g., "unemployment rate 2024", "GDP growth").`,
        },
      }, evidence.map(e => ({
        claim: `Evidence from ${e.source}: ${e.title}`,
        value: { source: e.source, type: e.type, title: e.title, summary: e.summary, url: e.url },
        sourceName: e.source,
        sourceUrl: e.url || '',
        transformations: ['keyword-extraction', 'search'],
      }))),
    };
  } catch (error) {
    return {
      content: {
        tool: 'fact_check',
        claim,
        keywords,
        result: {
          status: 'error',
          confidence: 0,
          evidence: [],
          summary: `Fact-checking error: ${(error as Error).message}`,
        },
      },
      isError: true,
    };
  }
};
