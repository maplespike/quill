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
import * as searchIndigenous from './search-indigenous.js';
import * as searchCriminalJustice from './search-criminal-justice.js';
import * as searchTransport from './search-transport.js';
import * as searchDefence from './search-defence.js';
import * as searchScience from './search-science.js';
import * as searchTribunals from './search-tribunals.js';
import * as searchLode from './search-lode.js';
import * as searchVeterans from './search-veterans.js';
import * as searchNgoRss from './search-ngo-rss.js';
import * as searchNarrativeTracker from './search-narrative-tracker.js';
import * as searchHealth from './search-health.js';

// ── Phase 5: New tools (#253) ─────────────────────────────────
import * as searchProactiveDisclosure from './search-proactive-disclosure.js';
import * as searchAti from './search-ati.js';
import * as searchFederalBudget from './search-federal-budget.js';
import * as searchStatcan from './search-statcan.js';
import * as searchLegislation from './search-legislation.js';
import * as searchGocSpending from './search-goc-spending.js';
import * as searchMunicipal from './search-municipal.js';
import * as searchGlobalCanada from './search-global-canada.js';
import * as searchHealthCanada from './search-health-canada.js';
import * as searchImpactAssessment from './search-impact-assessment.js';
import * as searchSpeciesAtRisk from './search-species-at-risk.js';
import * as searchFisheries from './search-fisheries.js';
import * as searchAgriculture from './search-agriculture.js';
import * as searchCrownCorporations from './search-crown-corporations.js';
import * as searchCharityT3010 from './search-charity-t3010.js';
import * as searchBankOfCanada from './search-bank-of-canada.js';
import * as searchHousingCmhc from './search-housing-cmhc.js';
import * as searchCrtcDecisions from './search-crtc-decisions.js';
import * as searchSocialPrograms from './search-social-programs.js';
import * as searchEducationResearch from './search-education-research.js';

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
    searchIndigenous,
    searchCriminalJustice,
    searchTransport,
    searchDefence,
    searchScience,
    searchTribunals,
    searchLode,
    searchVeterans,
    searchNgoRss,
    searchNarrativeTracker,
    searchHealth,

    // Phase 5: New tools (#253)
    searchProactiveDisclosure,
    searchAti,
    searchFederalBudget,
    searchStatcan,
    searchLegislation,
    searchGocSpending,
    searchMunicipal,
    searchGlobalCanada,
    searchHealthCanada,
    searchImpactAssessment,
    searchSpeciesAtRisk,
    searchFisheries,
    searchAgriculture,
    searchCrownCorporations,
    searchCharityT3010,
    searchBankOfCanada,
    searchHousingCmhc,
    searchCrtcDecisions,
    searchSocialPrograms,
    searchEducationResearch,

    aiAsk,
    aiAnalyze,
    aiSearchSemantic,
    systemHealth,
  ];
}

export function getToolNames(): string[] {
  return getAllTools().map(t => t.definition.name);
}
