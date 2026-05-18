/**
 * Tool registry — loads all MapleSpike MCP tools
 */

import type { ToolDefinition, ToolHandler } from './types.js';
import * as queryGovData from './query-gov-data.js';
import * as factCheck from './fact-check.js';
import * as getCitation from './get-citation.js';
import * as latestReleases from './latest-releases.js';
import * as searchCommittees from './search-committees.js';
import * as searchCorporate from './search-corporate.js';
import * as searchInfluence from './search-influence.js';
import * as searchGazette from './search-gazette.js';
import * as searchGic from './search-gic.js';
import * as searchElections from './search-elections.js';
import * as searchProvincialLobbying from './search-provincial-lobbying.js';
import * as searchOversight from './search-oversight.js';
import * as searchCanlii from './search-canlii.js';
import * as searchLmia from './search-lmia.js';
import * as searchImmigration from './search-immigration.js';
import * as searchScience from './search-science.js';
import * as searchTribunals from './search-tribunals.js';
import * as searchLode from './search-lode.js';
import * as searchVeterans from './search-veterans.js';
import * as searchNgoRss from './search-ngo-rss.js';
import * as searchHealth from './search-health.js';

import * as aiAsk from './ai-ask.js';
import * as aiAnalyze from './ai-analyze.js';
import * as aiSearchSemantic from './ai-search-semantic.js';
import * as systemHealth from './system-health.js';

export interface ToolModule {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export function getAllTools(): ToolModule[] {
  return [
    queryGovData,
    factCheck,
    getCitation,
    latestReleases,
    searchCommittees,
    searchCorporate,
    searchInfluence,
    searchGazette,
    searchGic,
    searchElections,
    searchProvincialLobbying,
    searchOversight,
    searchCanlii,
    searchLmia,
    searchImmigration,
    searchScience,
    searchTribunals,
    searchLode,
    searchVeterans,
    searchNgoRss,
    searchHealth,

    aiAsk,
    aiAnalyze,
    aiSearchSemantic,
    systemHealth,
  ];
}

export function getToolNames(): string[] {
  return getAllTools().map(t => t.definition.name);
}
