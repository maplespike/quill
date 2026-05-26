// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Tool registry — loads all MapleSpike MCP tools
 */

import * as aiAnalyze from './ai-analyze.js';
import * as aiAsk from './ai-ask.js';
import * as aiSearchSemantic from './ai-search-semantic.js';
import * as cacheClear from './cache-clear.js';
import * as cacheStatus from './cache-status.js';
import * as compareRegions from './compare-regions.js';
import * as exploreCatalog from './explore-catalog.js';
import * as factCheck from './fact-check.js';
import * as findConnections from './find-connections.js';
import * as getCitation from './get-citation.js';
import * as getEntityProfile from './get-entity-profile.js';
import * as getMemberInfo from './get-member-info.js';
import * as getModuleHealth from './get-module-health.js';
import * as getPipelineHealth from './get-pipeline-health.js';
import * as getPoliticianInfluence from './get-politician-influence.js';
import * as latestReleases from './latest-releases.js';
import * as queryBridges from './query-bridges.js';
import * as queryCpi from './query-cpi.js';
import * as queryGdp from './query-gdp.js';
import * as queryGovData from './query-gov-data.js';
import * as qaSchema from './qa-schema.js';
import * as qaValidateModule from './qa-validate-module.js';
import * as queryLabour from './query-labour.js';
import * as queryPopulation from './query-population.js';
import * as queryTrade from './query-trade.js';
import * as resolveEntity from './resolve-entity.js';
import * as searchA2aj from './search-a2aj.js';
import * as searchAgriculture from './search-agriculture.js';
import * as searchAgricultureData from './search_agriculture_data.js';
import * as searchArcGisLayers from './search-arcgis-layers.js';
import * as searchAti from './search-ati.js';
import * as searchBills from './search-bills.js';
import * as searchBankOfCanada from './search-bank-of-canada.js';
import * as searchCanlii from './search-canlii.js';
import * as searchCipo from './search-cipo.js';
import * as searchCitizenshipData from './search_citizenship_data.js';
import * as searchClimateData from './search_climate_data.js';
import * as searchCmhc from './search-cmhc.js';
import * as searchCommittees from './search-committees.js';
import * as searchCommitteesOp from './search-committees-op.js';
import * as searchCorporate from './search-corporate.js';
import * as searchCorporateFilings from './search-corporate-filings.js';
import * as searchCorporateRegistry from './search_corporate_registry.js';
import * as searchCraCharity from './search-cra-charity.js';
import * as searchCriminalJustice from './search-criminal-justice.js';
import * as searchCrownCorporations from './search-crown-corporations.js';
import * as searchCrtc from './search-crtc.js';
import * as searchCulture from './search-culture.js';
import * as searchCultureData from './search_culture_data.js';
import * as searchDebates from './search-debates.js';
import * as searchDefence from './search-defence.js';
import * as searchEducationResearch from './search-education-research.js';
import * as searchEducationStats from './search_education_stats.js';
import * as searchElections from './search-elections.js';
import * as searchEnergyData from './search_energy_data.js';
import * as searchFederalBudget from './search-federal-budget.js';
import * as searchFederalContracts from './search_federal_contracts.js';
import * as searchFederalGrants from './search_federal_grants.js';
import * as searchFisheries from './search-fisheries.js';
import * as searchGazette from './search-gazette.js';
import * as searchGazettePart1 from './search_gazette_part1.js';
import * as searchGazettePart2 from './search_gazette_part2.js';
import * as searchGazettePart3 from './search_gazette_part3.js';
import * as searchGenderStats from './search_gender_stats.js';
import * as searchGeospatial from './search-geospatial.js';
import * as searchGic from './search-gic.js';
import * as searchGlobalCanada from './search-global-canada.js';
import * as searchGocSpending from './search-goc-spending.js';
import * as searchHealth from './search-health.js';
import * as searchHousingData from './search_housing_data.js';
import * as searchImmigration from './search-immigration.js';
import * as searchImmigrationRefugees from './search_immigration_refugees.js';
import * as searchImpactAssessment from './search-impact-assessment.js';
import * as searchIndigenous from './search-indigenous.js';
import * as searchIndigenousStats from './search_indigenous_stats.js';
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
import * as searchMiningData from './search_mining_data.js';
import * as searchMunicipal from './search-municipal.js';
import * as searchMunicipalData from './search-municipal-data.js';
import * as searchNarrativeTracker from './search-narrative-tracker.js';
import * as searchNgoRss from './search-ngo-rss.js';
import * as searchNpri from './search-npri.js';
import * as searchNrcan from './search-nrcan.js';
import * as searchNunavutData from './search-nunavut-data.js';
import * as searchOfficialLanguages from './search_official_languages.js';
import * as searchOversight from './search-oversight.js';
import * as searchPatents from './search_patents.js';
import * as searchProactiveDisclosure from './search-proactive-disclosure.js';
import * as searchProvincialData from './search-provincial-data.js';
import * as searchProvincialLegislatures from './search-provincial-legislatures.js';
import * as searchProvincialLobbying from './search-provincial-lobbying.js';
import * as searchProvincialRegulators from './search-provincial-regulators.js';
import * as searchPublicSafety from './search_public_safety.js';
import * as searchRealTimeFeeds from './search-real-time-feeds.js';
import * as searchRegionalAuthorities from './search-regional-authorities.js';
import * as searchScience from './search-science.js';
import * as searchSedi from './search-sedi.js';
import * as searchTechnologyData from './search_technology_data.js';
import * as searchTrademarks from './search_trademarks.js';
import * as searchTransportationData from './search_transportation_data.js';
import * as smartSearch from './smart-search.js';
import * as searchSocialPrograms from './search-social-programs.js';
import * as searchSpeciesAtRisk from './search-species-at-risk.js';
import * as searchStatcan from './search-statcan.js';
import * as trackBill from './track-bill.js';
import * as searchTransport from './search-transport.js';
import * as searchTribunals from './search-tribunals.js';
import * as searchUnions from './search-unions.js';
import * as searchUniversities from './search-universities.js';
import * as searchVeterans from './search-veterans.js';
import * as searchVotes from './search-votes.js';
import * as searchWorldbank from './search-worldbank.js';
import * as searxngHealth from './searxng-health.js';
import * as signalCheck from './signal-check.js';
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
    compareRegions,
    exploreCatalog,
    factCheck,
    findConnections,
    getCitation,
    getEntityProfile,
    getMemberInfo,
    getModuleHealth,
    getPipelineHealth,
    getPoliticianInfluence,
    latestReleases,
    queryBridges,
    queryCpi,
    queryGdp,
    queryGovData,
    qaSchema,
    qaValidateModule,
    queryLabour,
    queryPopulation,
    queryTrade,
    resolveEntity,
    searchA2aj,
    searchAgriculture,
    searchAgricultureData,
    searchArcGisLayers,
    searchAti,
    searchBankOfCanada,
    searchBills,
    searchCanlii,
    searchCipo,
    searchCitizenshipData,
    searchClimateData,
    searchCmhc,
    searchCommittees,
    searchCommitteesOp,
    searchCorporate,
    searchCorporateFilings,
    searchCorporateRegistry,
    searchCraCharity,
    searchCriminalJustice,
    searchCrownCorporations,
    searchCrtc,
    searchCulture,
    searchCultureData,
    searchDebates,
    searchDefence,
    searchEducationResearch,
    searchEducationStats,
    searchElections,
    searchEnergyData,
    searchFederalBudget,
    searchFederalContracts,
    searchFederalGrants,
    searchFisheries,
    searchGazette,
    searchGazettePart1,
    searchGazettePart2,
    searchGazettePart3,
    searchGenderStats,
    searchGeospatial,
    searchGic,
    searchGlobalCanada,
    searchGocSpending,
    searchHealth,
    searchHousingData,
    searchImmigration,
    searchImmigrationRefugees,
    searchImpactAssessment,
    searchIndigenous,
    searchIndigenousStats,
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
    searchMiningData,
    searchMunicipal,
    searchMunicipalData,
    searchNarrativeTracker,
    searchNgoRss,
    searchNpri,
    searchNrcan,
    searchNunavutData,
    searchOfficialLanguages,
    searchOversight,
    searchPatents,
    searchProactiveDisclosure,
    searchProvincialData,
    searchProvincialLegislatures,
    searchProvincialLobbying,
    searchProvincialRegulators,
    searchPublicSafety,
    searchRealTimeFeeds,
    searchRegionalAuthorities,
    searchScience,
    searchSedi,
    searchTechnologyData,
    searchTrademarks,
    searchTransportationData,
    smartSearch,
    searchSocialPrograms,
    searchSpeciesAtRisk,
    searchStatcan,
    trackBill,
    searchTransport,
    searchTribunals,
    searchUnions,
    searchUniversities,
    searchVeterans,
    searchVotes,
    searchWorldbank,
    searxngHealth,
    signalCheck,
    systemHealth,
  ];
}

export function getToolNames(): string[] {
  return getAllTools().map(t => t.definition.name);
}
