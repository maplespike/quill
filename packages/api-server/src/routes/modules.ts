// SPDX-License-Identifier: Apache-2.0

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import type { BuildContext } from '../response.js';
import type { ModuleInfo, ModuleCategory } from '@maplespike/pipeline-core';
import {
  getAllModules,
  getModule,
  getModulesByCategory,
  getCategories,
} from '@maplespike/pipeline-core';

interface ToolEntry {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

const ALL_TOOLS: ToolEntry[] = [
  {
    name: 'query_gov_data',
    description: 'Query Canadian government data releases, datasets, and records. Searches across Statistics Canada (StatCan), open.canada.ca (CKAN), provincial data portals, and federal spending/procurement data.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, jurisdiction: { type: 'string' }, category: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
  },
  {
    name: 'fact_check',
    description: 'Check a specific claim, statement, or statistic against official Canadian government data sources (StatCan, open.canada.ca, federal spending records).',
    inputSchema: { type: 'object', properties: { claim: { type: 'string' } }, required: ['claim'] },
  },
  {
    name: 'get_citation',
    description: 'Look up claim hashes and available provenance evidence for Quill records. A hash match checks canonical record integrity, not source authenticity or reuse rights.',
    inputSchema: { type: 'object', properties: { hash: { type: 'string' } }, required: ['hash'] },
  },
  {
    name: 'latest_releases',
    description: 'Get the latest Canadian government data releases, economic indicators, and reports.',
    inputSchema: { type: 'object', properties: { jurisdiction: { type: 'string' }, category: { type: 'string' }, limit: { type: 'number' } } },
  },
  {
    name: 'search_committees',
    description: 'Full-text search across all 50+ House of Commons and Senate committee evidence/transcripts.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, chamber: { type: 'string' }, committee: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
  },
  {
    name: 'search_corporate',
    description: 'Search Canadian corporate influence data — federal lobbying registry, procurement contracts, and executive statements.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, category: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
  },
  {
    name: 'search_influence',
    description: 'Investigate influence actors — 30+ tracked international organizations, NGOs, think tanks, and consultancies operating in Canada.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, category: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
  },
  {
    name: 'search_gazette',
    description: 'Search Canada Gazette regulations — Parts I (proposed), II (enacted), and III (acts).',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, part: { type: 'string' }, department: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
  },
  {
    name: 'search_gic',
    description: 'Search Governor-in-Council appointments — federal boards, tribunals, commissions, and patronage positions.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, department: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
  },
  {
    name: 'search_elections',
    description: 'Search Elections Canada third-party advertiser registry and spending data.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, year: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
  },
  {
    name: 'search_provincial_lobbying',
    description: 'Search provincial lobbying registries — Ontario, BC, Alberta, and Quebec.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, province: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
  },
  {
    name: 'search_oversight',
    description: 'Search independent oversight body publications — OAG, PBO, Ethics Commissioner, Lobbying Commissioner, Competition Bureau, CRTC.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, body: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
  },
  {
    name: 'search_canlii',
    description: 'Search Canadian court decisions via the CanLII API — federal and provincial courts.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, court: { type: 'string' }, year: { type: 'number' }, limit: { type: 'number' } }, required: ['query'] },
  },
  {
    name: 'search_lmia',
    description: 'Search Labour Market Impact Assessment quarterly data — employer and occupation-level TFW program usage.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, province: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
  },
  {
    name: 'search_immigration',
    description: 'Search IRCC immigration data — permanent residents, temporary residents, Express Entry, IRB refugee decisions, and CBSA enforcement.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, category: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
  },
  {
    name: 'search_science',
    description: 'Search Canadian science, space, and research data — CSA missions, Mitacs grants, Ocean Networks Canada observations, Polar Data Catalogue records.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
  },
  {
    name: 'search_tribunals',
    description: 'Search federal tribunal appointments and decisions — IRB, CHRT, Competition Tribunal, CITT, Specific Claims Tribunal, and more.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, tribunal: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
  },
  {
    name: 'search_lode',
    description: 'Search Canada\'s Open Database of Addresses (LODE) — geospatial data across 12 database collections.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, province: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
  },
  {
    name: 'search_veterans',
    description: 'Search Veterans Affairs Canada data — benefits, services, wait times, suicide prevention, and support programs.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
  },
  {
    name: 'search_ngo_rss',
    description: 'Search NGO and think tank publications — RSS feeds from 30+ Canadian advocacy organizations and policy influencers.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
  },
  {
    name: 'search_health',
    description: 'Search Canadian health data — Health Canada drug approvals, medical device recalls, CIHI, CADTH, CFIA food recalls, PMPRB drug pricing, PHAC surveillance.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, category: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
  },
  {
    name: 'ai_ask',
    description: 'Ask natural language questions about Canadian government data — committees, lobbying, procurement, regulations, courts, and oversight.',
    inputSchema: { type: 'object', properties: { question: { type: 'string' }, source: { type: 'string' } }, required: ['question'] },
  },
  {
    name: 'ai_analyze',
    description: 'AI-powered analysis of Canadian government data — committee transcripts, lobbying records, procurement contracts, regulatory filings, and court decisions.',
    inputSchema: { type: 'object', properties: { data: { type: 'string' }, analysis_type: { type: 'string' } }, required: ['data'] },
  },
  {
    name: 'ai_search_semantic',
    description: 'Semantic search across all Quill data sources using natural language queries.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' }, source: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'system_health',
    description: 'Check the Quill API service health. Returns service status, version, tenant tier, and current API call usage.',
    inputSchema: { type: 'object', properties: {} },
  },
];

export const listModulesHandler: RouteHandler = async (request, ctx) => {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');

  const modules = category
    ? getModulesByCategory(category.toUpperCase() as ModuleCategory)
    : getAllModules();

  const buildCtx: BuildContext = {
    tenant: ctx.tenant,
    requestId: ctx.requestId,
    startTime: ctx.startTime,
  };

  return jsonResponse(buildSuccess({ modules, total: modules.length }, buildCtx));
};

export const getModuleHandler: RouteHandler = async (request, ctx, params) => {
  const mod = getModule(params.name);

  const buildCtx: BuildContext = {
    tenant: ctx.tenant,
    requestId: ctx.requestId,
    startTime: ctx.startTime,
  };

  if (!mod) {
    return jsonResponse(buildError('NOT_FOUND', `Module "${params.name}" not found`, buildCtx), 404);
  }

  return jsonResponse(buildSuccess(mod, buildCtx));
};

export const statsHandler: RouteHandler = async (_request, ctx) => {
  const allModules = getAllModules();
  const categories = getCategories();

  const buildCtx: BuildContext = {
    tenant: ctx.tenant,
    requestId: ctx.requestId,
    startTime: ctx.startTime,
  };

  return jsonResponse(buildSuccess({
    moduleCount: allModules.length,
    toolCount: 25,
    categoryCount: categories.length,
    categories,
    uptime: 0.98,
  }, buildCtx));
};

export const toolsHandler: RouteHandler = async (_request, ctx) => {
  const buildCtx: BuildContext = {
    tenant: ctx.tenant,
    requestId: ctx.requestId,
    startTime: ctx.startTime,
  };

  return jsonResponse(buildSuccess(ALL_TOOLS, buildCtx));
};
