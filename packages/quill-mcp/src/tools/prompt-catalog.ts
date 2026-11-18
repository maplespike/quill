// SPDX-License-Identifier: AGPL-3.0-only
// Guided prompt catalog — curated workflows that chain multiple Quill MCP tools.
// Each prompt is a reusable template an agent can run with minimal adaptation.
// Imported by explore-catalog.ts and the MCP server's prompts handler.

export interface PromptTemplate {
  name: string;
  description: string;
  category: string;
  tools: string[];
  prompt: string;
}

export const promptCatalog: PromptTemplate[] = [
  {
    name: 'track-bill',
    description: 'Track a bill through Parliament: find the bill, its committee review, debates, votes, and related lobbying.',
    category: 'legislative',
    tools: ['search_bills', 'search_committees', 'search_debates', 'search_votes', 'search_influence'],
    prompt: 'Start by searching for the bill using search_bills. Then find which committee is reviewing it with search_committees. Check for related debates in search_debates. Look up voting records with search_votes. Finally, check lobbying activity related to the bill topic using search_influence. Summarize the bill status, committee, key dates, and lobbying contacts.',
  },
  {
    name: 'research-organization',
    description: 'Research an organization: procurement contracts, lobbying, court cases, regulatory filings.',
    category: 'corporate',
    tools: ['search_corporate', 'search_procurement', 'search_influence', 'search_canlii', 'search_gazette'],
    prompt: 'Search for the organization in search_corporate to find registration details. Check procurement contracts via the procurement tool. Look up lobbying registry entries in search_influence. Search for related court cases in search_canlii. Check recent regulatory notices in search_gazette. Cross-reference all findings.',
  },
  {
    name: 'monitor-policy',
    description: 'Monitor a policy area: Gazette notices, committee meetings, bills, and parliamentary questions.',
    category: 'legislative',
    tools: ['search_gazette', 'search_committees', 'search_bills', 'search_debates'],
    prompt: 'Search recent Canada Gazette notices for the policy area. Find relevant committee meetings and transcripts. Check for related bills in Parliament. Review written questions and debates on the topic. Compile a timeline of recent developments.',
  },
  {
    name: 'procurement-intel',
    description: 'Procurement intelligence: find tenders, awarded contracts, company registry, and budget allocations.',
    category: 'finance',
    tools: ['search_goc_spending', 'search_corporate', 'search_federal_budget', 'search_proactive_disclosure'],
    prompt: 'Search for recent tenders and awarded contracts. Look up the company registration details. Check the federal budget for relevant program allocations. Review proactive disclosure reports for contracting activity. Compile a competitive intelligence report.',
  },
  {
    name: 'immigration-policy',
    description: 'Immigration policy research: IRCC data, parliamentary questions, regulatory changes, and court decisions.',
    category: 'immigration',
    tools: ['search_immigration', 'search_ircc_processing_times', 'search_bills', 'search_gazette', 'search_canlii'],
    prompt: 'Check IRCC processing times and admissions data. Search for related bills and parliamentary questions. Check Gazette for regulatory changes. Search CanLII for immigration-related court decisions. Summarize the policy landscape.',
  },
  {
    name: 'lobbying-influence',
    description: 'Map lobbying influence on a policy area: registrations, communications, committee appearances, political contributions.',
    category: 'influence',
    tools: ['search_influence', 'search_committees', 'search_elections', 'search_provincial_lobbying'],
    prompt: 'Search lobbying registry for the policy area or organization. Find related committee appearances. Check political contributions and election financing data. Cross-reference provincial lobbying if applicable. Build an influence network map.',
  },
  {
    name: 'weather-impact',
    description: 'Weather impact analysis: current conditions, forecasts, alerts, and historical climate data for a region.',
    category: 'environment',
    tools: ['search_weather', 'search_climate_data', 'search_impact_assessment', 'search_nrcan'],
    prompt: 'Check current weather conditions and forecasts for the region. Look up active weather alerts. Find historical climate data and normals. Search for related environmental impact assessments. Review NRCan data for geohazards or resource considerations.',
  },
];

export function getPromptCatalog(): PromptTemplate[] {
  return promptCatalog;
}

// Register in the MCP server's prompts
export const mcpPrompts = promptCatalog.map(p => ({
  name: p.name,
  description: p.description,
  arguments: [
    {
      name: 'topic',
      description: `The specific topic or entity for this ${p.category} workflow`,
      required: true,
    },
  ],
}));
