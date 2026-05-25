// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Tool registry — loads all MapleSpike MCP tools
 */

import * as aiAnalyze from './ai-analyze.js';
import * as aiAsk from './ai-ask.js';
import * as aiSearchSemantic from './ai-search-semantic.js';
import * as cacheClear from './cache-clear.js';
import * as cacheStatus from './cache-status.js';
import * as factCheck from './fact-check.js';
import * as findConnections from './find-connections.js';
import * as getCitation from './get-citation.js';
import * as getModuleHealth from './get-module-health.js';
import * as getPipelineHealth from './get-pipeline-health.js';
import * as latestReleases from './latest-releases.js';
import * as queryGovData from './query-gov-data.js';
import * as qaSchema from './qa-schema.js';
import * as qaValidateModule from './qa-validate-module.js';
import * as resolveEntity from './resolve-entity.js';
import * as searchA2aj from './search-a2aj.js';
import * as searchAgriculture from './search-agriculture.js';
import * as searchAti from './search-ati.js';
import * as searchBankOfCanada from './search-bank-of-canada.js';
import * as searchCanlii from './search-canlii.js';
import * as searchCipo from './search-cipo.js';
import * as searchCmhc from './search-cmhc.js';
import * as searchCommittees from './search-committees.js';
import * as searchCorporate from './search-corporate.js';
import * as searchCorporateFilings from './search-corporate-filings.js';
import * as searchCraCharity from './search-cra-charity.js';
import * as searchCriminalJustice from './search-criminal-justice.js';
import * as searchCrownCorporations from './search-crown-corporations.js';
import * as searchCrtc from './search-crtc.js';
import * as searchCulture from './search-culture.js';
import * as searchDefence from './search-defence.js';
import * as searchEducationResearch from './search-education-research.js';
import * as searchElections from './search-elections.js';
import * as searchFederalBudget from './search-federal-budget.js';
import * as searchFisheries from './search-fisheries.js';
import * as searchGazette from './search-gazette.js';
import * as searchGeospatial from './search-geospatial.js';
import * as searchGic from './search-gic.js';
import * as searchGlobalCanada from './search-global-canada.js';
import * as searchGocSpending from './search-goc-spending.js';
import * as searchHealth from './search-health.js';
import * as searchImmigration from './search-immigration.js';
import * as searchImpactAssessment from './search-impact-assessment.js';
import * as searchIndigenous from './search-indigenous.js';
import * as searchInfluence from './search-influence.js';
import * as searchIrccCitizenship from './search-ircc-citizenship.js';
import * as searchIrccEntryExit from './search-ircc-entry-exit.js';
import * as searchIrccExpressEntry from './search-ircc-express-entry.js';
import * as searchIrccFamilySponsorship from './search-ircc-family-sponsorship.js';
import * as searchIrccPrAdmissions from './search-ircc-pr-admissions.js';
import * as searchIrccProcessingTimes from './search-ircc-processing-times.js';
import * as searchIrccStudyPermits from './search-ircc-study-permits.js';
import * as searchIrccWorkPermits from './search-ircc-work-permits.js';
import * as searchKnowledgeFabric from './search-knowledge-fabric.js';
import * as searchLegislation from './search-legislation.js';
import * as searchLmia from './search-lmia.js';
import * as searchLode from './search-lode.js';
import * as searchMunicipal from './search-municipal.js';
import * as searchNarrativeTracker from './search-narrative-tracker.js';
import * as searchNgoRss from './search-ngo-rss.js';
import * as searchNpri from './search-npri.js';
import * as searchNrcan from './search-nrcan.js';
import * as searchOversight from './search-oversight.js';
import * as searchProactiveDisclosure from './search-proactive-disclosure.js';
import * as searchProvincialLegislatures from './search-provincial-legislatures.js';
import * as searchProvincialLobbying from './search-provincial-lobbying.js';
import * as searchProvincialRegulators from './search-provincial-regulators.js';
import * as searchRealTimeFeeds from './search-real-time-feeds.js';
import * as searchRegionalAuthorities from './search-regional-authorities.js';
import * as searchScience from './search-science.js';
import * as searchSedi from './search-sedi.js';
import * as searchSocialPrograms from './search-social-programs.js';
import * as searchSpeciesAtRisk from './search-species-at-risk.js';
import * as searchStatcan from './search-statcan.js';
import * as searchTransport from './search-transport.js';
import * as searchTribunals from './search-tribunals.js';
import * as searchUnions from './search-unions.js';
import * as searchUniversities from './search-universities.js';
import * as searchVeterans from './search-veterans.js';
import * as searxngHealth from './searxng-health.js';
import * as systemHealth from './system-health.js';

import type { ToolDefinition, ToolHandler } from './types.js';

export interface ToolModule {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export function getAllTools(): ToolModule[] {
  return [
    aiAnalyze,
    aiAsk,
    aiSearchSemantic,
    cacheClear,
    cacheStatus,
    factCheck,
    findConnections,
    getCitation,
    getModuleHealth,
    getPipelineHealth,
    latestReleases,
    queryGovData,
    qaSchema,
    qaValidateModule,
    resolveEntity,
    searchA2aj,
    searchAgriculture,
    searchAti,
    searchBankOfCanada,
    searchCanlii,
    searchCipo,
    searchCmhc,
    searchCommittees,
    searchCorporate,
    searchCorporateFilings,
    searchCraCharity,
    searchCriminalJustice,
    searchCrownCorporations,
    searchCrtc,
    searchCulture,
    searchDefence,
    searchEducationResearch,
    searchElections,
    searchFederalBudget,
    searchFisheries,
    searchGazette,
    searchGeospatial,
    searchGic,
    searchGlobalCanada,
    searchGocSpending,
    searchHealth,
    searchImmigration,
    searchImpactAssessment,
    searchIndigenous,
    searchInfluence,
    searchIrccCitizenship,
    searchIrccEntryExit,
    searchIrccExpressEntry,
    searchIrccFamilySponsorship,
    searchIrccPrAdmissions,
    searchIrccProcessingTimes,
    searchIrccStudyPermits,
    searchIrccWorkPermits,
    searchKnowledgeFabric,
    searchLegislation,
    searchLmia,
    searchLode,
    searchMunicipal,
    searchNarrativeTracker,
    searchNgoRss,
    searchNpri,
    searchNrcan,
    searchOversight,
    searchProactiveDisclosure,
    searchProvincialLegislatures,
    searchProvincialLobbying,
    searchProvincialRegulators,
    searchRealTimeFeeds,
    searchRegionalAuthorities,
    searchScience,
    searchSedi,
    searchSocialPrograms,
    searchSpeciesAtRisk,
    searchStatcan,
    searchTransport,
    searchTribunals,
    searchUnions,
    searchUniversities,
    searchVeterans,
    searxngHealth,
    systemHealth,
  ];
}

export function getToolNames(): string[] {
  return getAllTools().map(t => t.definition.name);
}
