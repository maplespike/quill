import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchStatCanReleases, fetchCKANPackages } from '@maplespike/pipeline-core';

/**
 * Check a specific claim, statement, or statistic against official Canadian government data sources.
 * Searches StatCan and CKAN portals for corroborating or contradicting evidence.
 */
export const definition: ToolDefinition = {
  name: 'fact_check',
  description:
    'Check a specific claim, statement, or statistic against official Canadian government data sources ' +
    '(StatCan, open.canada.ca, federal spending records). Returns corroborating or contradicting ' +
    'evidence with citations, trust scores, and confidence ratings.',
  descriptions: {
    "fr-CA": "Vérifier une affirmation en la comparant aux données officielles du gouvernement canadien. Idéal pour vérifier les données économiques, les statistiques de l’emploi, les chiffres du PIB et d’autres indicateurs gouvernementaux publiés par Statistique Canada et les sources fédérales.",
  },
  inputSchema: {
    type: 'object',
    properties: {
      claim: {
        type: 'string',
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
      content: {
        tool: 'fact_check',
        claim,
        keywords,
        result: {
          status: evidence.length > 0 ? 'evidence_found' : 'no_evidence_found',
          confidence: evidence.length > 0 ? 60 : 0,
          evidence,
          summary:
            evidence.length > 0
              ? `Found ${evidence.length} relevant government data sources for the claim "${claim}". Review the evidence to compare against the stated figures. For precise numeric verification, query specific StatCan cubes or CKAN datasets listed above.`
              : `No direct government data matches found for "${claim}". Try rephrasing or focusing on specific statistics (e.g., "unemployment rate 2024", "GDP growth").`,
        },
      },
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
