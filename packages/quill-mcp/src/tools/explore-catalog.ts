// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { getToolNames, getAllTools } from './index.js';

const SOURCE_CATEGORIES: Record<string, { description: string; tools: string[] }> = {
  discovery: { description: 'Tool discovery and orchestration — find the right tool for any query', tools: ['discover_tools', 'datastore_query', 'datastore_stats'] },

  committees: { description: 'House of Commons and Senate committee evidence, transcripts, proceedings', tools: ['search_committees'] },
  gazette: { description: 'Canada Gazette regulations (Parts I, II, III)', tools: ['search_gazette'] },
  lobbying: { description: 'Federal lobbying registry registrations and communications', tools: ['search_corporate', 'search_provincial_lobbying'] },
  procurement: { description: 'Federal contract awards, grants, proactive disclosure', tools: ['search_goc_spending', 'search_proactive_disclosure'] },
  gic: { description: 'Governor-in-Council appointments and order-in-council', tools: ['search_gic'] },
  oversight: { description: 'OAG, PBO, Ethics Commissioner, Competition Bureau, CRTC, privacy commissioners', tools: ['search_oversight', 'search_crtc'] },
  courts: { description: 'Federal and provincial court decisions, case law', tools: ['search_canlii', 'search_a2aj', 'search_tribunals'] },
  elections: { description: 'Elections Canada third-party advertiser registry, spending', tools: ['search_elections'] },
  immigration: { description: 'IRCC immigration data: processing times, admissions, permits, citizenship', tools: ['search_immigration', 'search_ircc_citizenship', 'search_ircc_pr_admissions', 'search_ircc_work_permits', 'search_ircc_study_permits', 'search_ircc_processing_times', 'search_ircc_entry_exit', 'search_ircc_express_entry', 'search_ircc_family_sponsorship'] },
  indigenous: { description: 'Indigenous Services Canada: communities, health, education, housing, water', tools: ['search_indigenous_relations'] },
  health: { description: 'Health Canada, CIHI, PHAC, CFIA: drug approvals, medical devices, recalls', tools: ['search_health', 'search_cra_charity', 'search_nutrient_file'] },
  defence: { description: 'National Defence, veterans affairs', tools: ['search_defence', 'search_veterans'] },
  justice: { description: 'Criminal justice, corrections, parole, RCMP crime data', tools: ['search_criminal_justice'] },
  finance: { description: 'Federal budget, Bank of Canada, CMHC, OSFI, FCAC', tools: ['search_federal_budget', 'search_bank_of_canada', 'search_cmhc', 'search_valet_api', 'search_weather'] },
  corporate: { description: 'Corporations Canada and SEDAR+ filings. SEDI insider filings are not ingested.', tools: ['search_corporate_filings', 'search_sedi'] },
  influence: { description: 'NGO/think tank publications, narrative tracking, influence actors', tools: ['search_influence', 'search_ngo_rss', 'search_narrative_tracker'] },
  labour: { description: 'LMIA data, unions, social programs', tools: ['search_lmia', 'search_unions', 'search_social_programs'] },
  science: { description: 'Science and research, education, universities', tools: ['search_science', 'search_education_research', 'search_universities'] },
  environment: { description: 'Environment and climate, NRCan, species at risk, fisheries', tools: ['search_fisheries', 'search_species_at_risk', 'search_impact_assessment', 'search_npri'] },
  energy: { description: 'Energy, mining, forestry, renewable energy', tools: ['search_nrcan'] },
  transport: { description: 'Transportation, infrastructure, regional authorities', tools: ['search_transport', 'search_regional_authorities'] },
  municipal: { description: 'Municipal data, provincial legislatures', tools: ['search_municipal', 'search_provincial_legislatures'] },
  culture: { description: 'Culture, media, broadcasting, CIPO', tools: ['search_culture', 'search_cipo'] },
  geospatial: { description: 'Geospatial databases, LODE open databases', tools: ['search_geospatial', 'search_lode'] },
  provincial: { description: 'Provincial regulators, real-time feeds', tools: ['search_provincial_regulators', 'search_real_time_feeds'] },
};

export const definition: ToolDefinition = {
  name: 'explore_catalog',
  description:
    'Browse the MapleSpike data catalog. Lists all available data sources, MCP tools, and categories. ' +
    'Use this to discover what data is available before searching. ' +
    'Filter by category or search terms to find relevant tools.',
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: Object.keys(SOURCE_CATEGORIES).sort(),
        description: 'Filter by data category (e.g., "committees", "lobbying", "health")',
      },
      query: {
        type: 'string',
        maxLength: 500,
        description: 'Search for sources/tools matching text',
      },
      format: {
        type: 'string',
        enum: ['detailed', 'summary'],
        default: 'summary',
        description: 'Output format (default: summary)',
      },
    },
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const category = args.category as string | undefined;
  const query = (args.query as string)?.toLowerCase() || '';
  const format = (args.format as string) || 'summary';

  const allTools = getAllTools();
  const toolDefinitions: Record<string, { name: string; description: string; inputSchema: unknown }> = {};
  for (const tool of allTools) {
    toolDefinitions[tool.definition.name] = {
      name: tool.definition.name,
      description: tool.definition.description.slice(0, 200),
      inputSchema: tool.definition.inputSchema,
    };
  }

  let categories = Object.entries(SOURCE_CATEGORIES);

  if (category) {
    categories = categories.filter(([key]) => key === category);
  }

  if (query) {
    categories = categories.filter(([key, val]) =>
      key.includes(query) ||
      val.description.toLowerCase().includes(query) ||
      val.tools.some(t => t.includes(query))
    );
  }

  const catalog = categories.map(([key, val]) => ({
    category: key,
    description: val.description,
    tools: val.tools.map(t => ({
      name: t,
      defined: !!toolDefinitions[t],
      description: toolDefinitions[t]?.description?.slice(0, 150) || '',
    })),
    toolCount: val.tools.length,
  }));

  const totalTools = allTools.length;
  const totalSources = SOURCE_CATEGORIES.length;

  if (format === 'summary') {
    return {
      content: {
        tool: 'explore_catalog',
        summary: {
          totalTools,
          totalCategories: totalSources,
          filteredTo: category || query ? catalog.length : totalSources,
        },
        categories: catalog.map(c => ({
          category: c.category,
          description: c.description,
          toolCount: c.toolCount,
          tools: c.tools.map(t => t.name),
        })),
      },
    };
  }

  return {
    content: {
      tool: 'explore_catalog',
      summary: { totalTools, totalCategories: totalSources },
      categories: catalog,
      allToolNames: Object.keys(toolDefinitions).sort(),
    },
  };
};
