// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { searchCkan } from './upstream-fetcher.js';
import { chatCompletion } from '../ai/gateway.js';

export const definition: ToolDefinition = {
  name: 'ngo_narrative_tracker',
  description:
    'Analyze NGO and think tank publications for narrative alignment, coordinated messaging, ' +
    'and influence campaigns. Detects when multiple organizations use similar framing, language, ' +
    'or policy recommendations across different publications. Assigns 5GW (fifth-generation warfare) ' +
    'classification flags when applicable. Cross-references against tracked influence actors.',
  descriptions: {
    "fr-CA": "Analyse les publications d’ONG et de groupes de réflexion pour détecter l’alignement narratif, les messages coordonnés et les campagnes d’influence. Repère lorsque plusieurs organisations utilisent un cadrage ou un langage similaires. Attribue des classifications 5GW le cas échéant.",
  },
  inputSchema: {
    type: 'object',
    properties: {
      organization: {
        type: 'string',
        maxLength: 2000,
        description: 'Filter by specific NGO/think tank organization name (e.g., "Fraser Institute", "CCPA")',
      },
      topic: {
        type: 'string',
        maxLength: 2000,
        description: 'Filter by topic or theme (e.g., "carbon tax", "affordable housing", "digital privacy")',
      },
      timeframe: {
        type: 'string',
        enum: ['7d', '30d', '90d', 'all'],
        description: 'Time range for publication analysis (default: 30d)',
      },
      narrative_type: {
        type: 'string',
        enum: ['coordinated', 'divergence', 'all'],
        description: 'Type of narrative pattern to detect (default: all)',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 50,
        description: 'Maximum results to analyze (default: 10)',
      },
    },
  },
};

export const handler: ToolHandler = async (args) => {
  const organization = (args.organization as string) ?? '';
  const topic = (args.topic as string) ?? '';
  const timeframe = (args.timeframe as string) ?? '30d';
  const narrativeType = (args.narrative_type as string) ?? 'all';
  const limit = Math.min((args.limit as number) ?? 10, 50);

  if (!organization.trim() && !topic.trim()) {
    return {
      content: {
        tool: 'ngo_narrative_tracker',
        error: 'Please provide at least an organization name or a topic to search. ' +
          'Examples: { "organization": "Fraser Institute" }, { "topic": "carbon tax" }, ' +
          'or both.',
      },
      isError: true,
    };
  }

  const query = organization || topic || '';

  try {
    const result = await searchCkan(query, limit);
    const results = result.results ?? [];
    const total = result.total ?? 0;

    if (results.length === 0) {
      return {
        content: {
          tool: 'ngo_narrative_tracker',
          query,
          timeframe,
          narrative_type: narrativeType,
          organizations_found: 0,
          narratives: [],
          coordination_signals: null,
          source_titles: [],
          raw_analysis: null,
          note: 'No publications found matching the search criteria.',
        },
      };
    }

    const sourceTitles = results.slice(0, 5).map((r: any) => r.title || r.name || 'Untitled');
    const sourceText = results
      .map((r: any) => {
        const title = r.title || r.name || 'Untitled';
        const desc = r.description || r.summary || '';
        const source = r.source || r.organization || 'Unknown';
        const date = r.date || r.published_date || '';
        return `[${source}] ${title}${date ? ` (${date})` : ''}\n${String(desc).slice(0, 500)}`;
      })
      .join('\n\n---\n\n');

    const systemPrompt =
      'You are an expert in narrative analysis and influence detection. Analyze the following ' +
      'NGO and think tank publications for coordinated messaging patterns. ' +
      'Respond ONLY with valid JSON in the format specified.';

    const formatPrompt = `{
  "narratives": [
    {
      "theme": "string — the identified narrative theme",
      "organizations": ["org names using this narrative"],
      "confidence": "high|medium|low",
      "evidence": "string — brief evidence of alignment",
      "five_gw_flags": ["5GW classification flags if applicable, or empty array"]
    }
  ],
  "coordination_signals": "string — any signs of coordinated messaging across organizations or null",
  "overall_assessment": "string — brief summary of the narrative landscape"
}`;

    const userMessage = `${formatPrompt}\n\nAnalyze the following NGO/think tank publications${organization ? ` for organization "${organization}"` : ''}${topic ? ` on topic "${topic}"` : ''} (timeframe: ${timeframe}, narrative type filter: ${narrativeType}):\n\n${sourceText}`;

    let analysis: Record<string, unknown>;
    try {
      const aiResult = await chatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        { temperature: 0.3, maxTokens: 4096, jsonMode: true },
      );

      try {
        analysis = JSON.parse(aiResult.content);
      } catch {
        analysis = { rawAnalysis: aiResult.content, note: 'Could not parse structured JSON from response' };
      }
    } catch (aiError) {
      analysis = {
        narratives: [],
        coordination_signals: null,
        overall_assessment: `AI analysis unavailable: ${(aiError as Error).message}`,
        error: 'AI gateway error — returning raw search data instead',
      };
    }

    return {
      content: {
        tool: 'ngo_narrative_tracker',
        query,
        timeframe,
        narrative_type: narrativeType,
        limit,
        organizations_found: total,
        narratives: (analysis as any).narratives ?? [],
        coordination_signals: (analysis as any).coordination_signals ?? null,
        overall_assessment: (analysis as any).overall_assessment ?? null,
        source_titles: sourceTitles,
        raw_analysis: analysis,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'ngo_narrative_tracker',
        query: organization || topic || '',
        timeframe,
        narrative_type: narrativeType,
        error: `Narrative analysis failed: ${(error as Error).message}`,
      },
      isError: true,
    };
  }
};
