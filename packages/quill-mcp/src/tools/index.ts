/**
 * Tool registry — loads all MapleSpike MCP tools
 */

import type { ToolDefinition, ToolHandler } from './types.js';
import { getFrDescription } from './bilingual-descriptions.js';
import logger from '../logger.js';
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
import * as searchIlo from './search-ilo.js';

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
import * as queryDatastore from './query-datastore.js';
import * as discoverTools from './discover-tools.js';
import * as searchWeather from './search-weather.js';
import * as searchNutrientFile from './search-nutrient-file.js';
import * as searchValetApi from './search-valet-api.js';
import * as searchHousingCmhc from './search-housing-cmhc.js';
import * as searchCrtcDecisions from './search-crtc-decisions.js';
import * as searchSocialPrograms from './search-social-programs.js';
import * as searchEducationResearch from './search-education-research.js';

// ── Orphan tools (registered 2025-06-11) ────────────────────────
import * as searchA2aj from './search-a2aj.js';
import * as searchAbData from './search-ab-data.js';
import * as searchArcgisLayers from './search-arcgis-layers.js';
import * as searchBcData from './search-bc-data.js';
import * as searchBills from './search-bills.js';
import * as searchCipo from './search-cipo.js';
import * as searchCmhc from './search-cmhc.js';
import * as searchCommitteesOp from './search-committees-op.js';
import * as searchCorporateFilings from './search-corporate-filings.js';
import * as searchCraCharity from './search-cra-charity.js';
import * as searchCrtc from './search-crtc.js';
import * as searchCulture from './search-culture.js';
import * as searchDebates from './search-debates.js';
import * as searchGeospatial from './search-geospatial.js';
import * as searchIrccCitizenship from './search-ircc-citizenship.js';
import * as searchIrccEntryExit from './search-ircc-entry-exit.js';
import * as searchIrccExpressEntry from './search-ircc-express-entry.js';
import * as searchIrccFamilySponsorship from './search-ircc-family-sponsorship.js';
import * as searchIrccPrAdmissions from './search-ircc-pr-admissions.js';
import * as searchIrccProcessingTimes from './search-ircc-processing-times.js';
import * as searchIrccStudyPermits from './search-ircc-study-permits.js';
import * as searchIrccWorkPermits from './search-ircc-work-permits.js';
import * as searchKnowledgeFabric from './search-knowledge-fabric.js';
import * as searchLibraries from './search-libraries.js';
import * as searchMunicipalData from './search-municipal-data.js';
import * as searchNpri from './search-npri.js';
import * as searchNrcan from './search-nrcan.js';
import * as searchNunavutData from './search-nunavut-data.js';
import * as searchOnData from './search-on-data.js';
import * as searchYukonData from './search-yukon-data.js';
import * as searchParks from './search-parks.js';
import * as searchProvincialData from './search-provincial-data.js';
import * as searchProvincialLegislatures from './search-provincial-legislatures.js';
import * as searchProvincialRegulators from './search-provincial-regulators.js';
import * as searchQcData from './search-qc-data.js';
import * as searchRealTimeFeeds from './search-real-time-feeds.js';
import * as searchRegionalAuthorities from './search-regional-authorities.js';
import * as searchSedi from './search-sedi.js';
import * as searchUn from './search-un.js';
import * as searchUnions from './search-unions.js';
import * as searchUniversities from './search-universities.js';

// ── Underscore-named legacy tools (CKAN-based) ──────────────────
import * as searchEnergyData from './search_energy_data.js';
import * as searchClimateData from './search_climate_data.js';
import * as searchPublicSafety from './search_public_safety.js';
import * as searchFederalContracts from './search_federal_contracts.js';
import * as searchFederalGrants from './search_federal_grants.js';
import * as searchGenderStats from './search_gender_stats.js';
import * as searchHousingData from './search_housing_data.js';
import * as searchMiningData from './search_mining_data.js';
import * as searchOfficialLanguages from './search_official_languages.js';
import * as searchTechnologyData from './search_technology_data.js';
import * as searchPatents from './search_patents.js';
import * as searchTrademarks from './search_trademarks.js';

// ── New MCP search tools (phase: close coverage gap 93→130) ──────
import * as searchPharmaceuticals from './search-pharmaceuticals.js';
import * as searchTelecommunications from './search-telecommunications.js';
import * as searchRealEstate from './search-real-estate.js';
import * as searchEmergencyManagement from './search-emergency-management.js';
import * as searchIndigenousServicesDirectory from './search-indigenous-services-directory.js';
import * as searchPolicingSecurity from './search-policing-security.js';
import * as searchFinancialRegulation from './search-financial-regulation.js';
import * as searchMediaBroadcasting from './search-media-broadcasting.js';
import * as searchMunicipalLongTail from './search-municipal-long-tail.js';
import * as searchProvincialOrgs from './search-provincial-orgs.js';
import * as searchCrossReference from './search-cross-reference.js';
import * as searchNrcanRenewable from './search-nrcan-renewable.js';
import * as searchNrcanFires from './search-nrcan-fires.js';
import * as searchNrcanForests from './search-nrcan-forests.js';
import * as searchNrcanMinerals from './search-nrcan-minerals.js';
import * as searchOecdStat from './search-oecd-stat.js';
import * as searchUndpHdi from './search-undp-hdi.js';
import * as searchUnhcrRefugees from './search-unhcr-refugees.js';
import * as searchUsCia from './search-us-cia.js';
import * as searchAuAbs from './search-au-abs.js';
import * as searchNzStats from './search-nz-stats.js';
import * as searchUkOns from './search-uk-ons.js';
import * as searchWhoGho from './search-who-gho.js';
import * as searchEurostat from './search-eurostat.js';
import * as searchUtilities from './search-utilities.js';

// ── Additional MCP tools (cache, health, voting, etc.) ─────────
import * as cacheClear from './cache-clear.js';
import * as cacheStatus from './cache-status.js';
import * as compareRegions from './compare-regions.js';
import * as getAnnotations from './get-annotations.js';
import * as getEntityProfile from './get-entity-profile.js';
import * as getMemberInfo from './get-member-info.js';
import * as getModuleHealth from './get-module-health.js';
import * as getPipelineHealth from './get-pipeline-health.js';
import * as getPoliticianInfluence from './get-politician-influence.js';
import * as qaSchema from './qa-schema.js';
import * as qaValidateModule from './qa-validate-module.js';
import * as queryBridges from './query-bridges.js';
import * as queryCpi from './query-cpi.js';
import * as queryGdp from './query-gdp.js';
import * as queryLabour from './query-labour.js';
import * as queryPopulation from './query-population.js';
import * as queryTrade from './query-trade.js';
import * as searchVotes from './search-votes.js';

// ── Additional underscore-named legacy tools (CKAN-based) ──────
import * as searchAgricultureData from './search_agriculture_data.js';
import * as searchCitizenshipData from './search_citizenship_data.js';
import * as searchCorporateRegistry from './search_corporate_registry.js';
import * as searchCultureData from './search_culture_data.js';
import * as searchEducationStats from './search_education_stats.js';
import * as searchGazettePart1 from './search_gazette_part1.js';
import * as searchGazettePart2 from './search_gazette_part2.js';
import * as searchGazettePart3 from './search_gazette_part3.js';
import * as searchImmigrationRefugees from './search_immigration_refugees.js';
import * as searchIndigenousStats from './search_indigenous_stats.js';
import * as searchTransportationData from './search_transportation_data.js';
import * as searxngHealth from './searxng-health.js';
import * as smartSearch from './smart-search.js';
import * as trackBill from './track-bill.js';

// ── AI & entity resolution ───────────────────────────────────────
import * as aiAsk from './ai-ask.js';
import * as aiAnalyze from './ai-analyze.js';
import * as aiSearchSemantic from './ai-search-semantic.js';
import * as exploreCatalog from './explore-catalog.js';
import * as signalCheck from './signal-check.js';
import * as systemHealth from './system-health.js';
import * as resolveEntity from './resolve-entity.js';
import * as findConnections from './find-connections.js';
import * as linkedEntities from './linked-entities.js';

// ── Claim Stack (WS-1) — verification & provenance ──────────────
import * as verifyClaim from './verify-claim.js';

// ── Context7-shape shell (#803/master plan): resolve → query → verify ──
import * as resolveQuillId from './resolve-quill-id.js';
import * as queryQuill from './query-quill.js';

// ── x402 payments (Phase 3) ──────────────────────────────────
import * as x402Deposit from './x402-deposit.js';

// Multi-tool adapters (worldbank-wdi and un-comtrade export multiple tools)
import * as wdiAdapter from './worldbank-wdi-modules.js';
import * as comtradeAdapter from './un-comtrade-modules.js';

const wdiModules = [
  wdiAdapter.wdiIndicator,
  wdiAdapter.wdiCompareCountries,
  wdiAdapter.wdiCountryProfile,
  wdiAdapter.wdiTrend,
  wdiAdapter.wdiTopic,
  wdiAdapter.wdiMetadata,
];

const comtradeModules = [
  comtradeAdapter.comtradeByPartner,
  comtradeAdapter.comtradeByCommodity,
  comtradeAdapter.comtradeTrends,
];

export interface ToolModule {
  definition: ToolDefinition;
  handler: ToolHandler;
}

/**
 * Wrap a tool handler so unhandled errors become ToolResponse objects
 * with the tool name and error context, instead of raw exceptions.
 * This ensures every tool call returns a consistent shape.
 */
function wrapHandler(name: string, handler: ToolHandler): ToolHandler {
  return async (args: Record<string, unknown>) => {
    try {
      return await handler(args);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const errorType = err instanceof Error ? err.name : 'unknown';
      logger.error({ tool: name, errorType }, 'Tool handler threw');
      return {
        content: {
          tool: name,
          error: msg,
        },
        isError: true,
      };
    }
  };
}

/**
 * Wrap all tool modules so their handlers never throw and inject bilingual descriptions.
 */
function wrapTools(modules: ToolModule[]): ToolModule[] {
  return modules.map(m => {
    // Inject French description if one isn't already set inline in the tool definition.
    // Inline fr-CA takes priority; JSON file is the fallback.
    const existing = m.definition.descriptions;
    const alreadyHasFr = existing && existing['fr-CA'] && existing['fr-CA'].length > 0;
    const frDesc = alreadyHasFr ? undefined : getFrDescription(m.definition.name);
    const descriptions = frDesc ? { ...existing, 'fr-CA': frDesc } : existing;
    const definition = { ...m.definition };
    if (descriptions) {
      definition.descriptions = descriptions;
    }
    return {
      definition,
      handler: wrapHandler(m.definition.name, m.handler),
    };
  });
}

export function getAllTools(): ToolModule[] {
  return wrapTools([

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
    searchIlo,

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
  queryDatastore,
  discoverTools,
  searchWeather,
  searchNutrientFile,
  searchValetApi,
    searchHousingCmhc,
    searchCrtcDecisions,
    searchSocialPrograms,
    searchEducationResearch,

    // Orphan tools (registered 2025-06-11)
    searchA2aj,
    searchAbData,
    searchArcgisLayers,
    searchBcData,
    searchBills,
    searchCipo,
    searchCmhc,
    searchCommitteesOp,
    searchCorporateFilings,
    searchCraCharity,
    searchCrtc,
    searchCulture,
    searchDebates,
    searchGeospatial,
    searchIrccCitizenship,
    searchIrccEntryExit,
    searchIrccExpressEntry,
    searchIrccFamilySponsorship,
    searchIrccPrAdmissions,
    searchIrccProcessingTimes,
    searchIrccStudyPermits,
    searchIrccWorkPermits,
    searchKnowledgeFabric,
    searchLibraries,
    searchMunicipalData,
    searchNpri,
    searchNrcan,
    searchNunavutData,
    searchOnData,
    searchYukonData,
    searchParks,
    searchProvincialData,
    searchProvincialLegislatures,
    searchProvincialRegulators,
    searchQcData,
    searchRealTimeFeeds,
    searchRegionalAuthorities,
    searchSedi,
    searchUn,
    searchUnions,
    searchUniversities,

    // Legacy underscore-named tools (CKAN-based)
    searchEnergyData,
    searchClimateData,
    searchPublicSafety,
    searchFederalContracts,
    searchFederalGrants,
    searchGenderStats,
    searchHousingData,
    searchMiningData,
    searchOfficialLanguages,
    searchTechnologyData,
    searchPatents,
    searchTrademarks,

    // New MCP search tools (coverage gap 93→130)
    searchPharmaceuticals,
    searchTelecommunications,
    searchRealEstate,
    searchEmergencyManagement,
    searchIndigenousServicesDirectory,
    searchPolicingSecurity,
    searchFinancialRegulation,
    searchMediaBroadcasting,
    searchMunicipalLongTail,
    searchProvincialOrgs,
    searchCrossReference,
    searchNrcanRenewable,
    searchNrcanFires,
    searchNrcanForests,
    searchNrcanMinerals,
    searchOecdStat,
    searchUndpHdi,
    searchUnhcrRefugees,
    searchUsCia,
    searchAuAbs,
    searchNzStats,
    searchUkOns,
    searchWhoGho,
    searchEurostat,
    searchUtilities,

    // Additional MCP tools (cache, health, voting, etc.)
    cacheClear,
    cacheStatus,
    compareRegions,
    getAnnotations,
    getEntityProfile,
    getMemberInfo,
    getModuleHealth,
    getPipelineHealth,
    getPoliticianInfluence,
    qaSchema,
    qaValidateModule,
    queryBridges,
    queryCpi,
    queryGdp,
    queryLabour,
    queryPopulation,
    queryTrade,
    searchVotes,

    // Additional underscore-named legacy tools
    searchAgricultureData,
    searchCitizenshipData,
    searchCorporateRegistry,
    searchCultureData,
    searchEducationStats,
    searchGazettePart1,
    searchGazettePart2,
    searchGazettePart3,
    searchImmigrationRefugees,
    searchIndigenousStats,
    searchTransportationData,
    searxngHealth,
    smartSearch,
    trackBill,

    // World Bank WDI tools (adapter for multi-export)
    ...wdiModules,
    // UN Comtrade tools (adapter for multi-export)
    ...comtradeModules,

    aiAsk,
    aiAnalyze,
    aiSearchSemantic,
    exploreCatalog,
    signalCheck,
    systemHealth,
    resolveEntity,
    findConnections,
    linkedEntities,

    // Claim Stack: independent claim verification (free tier)
    verifyClaim,

    // Context7-shape shell: 2-call entry points over the full registry
    resolveQuillId,
    queryQuill,

    // x402 deposit tool (Phase 3). Always available; deposit is a no-op
    // when X402_ENABLED is unset — see x402-deposit.ts.
    x402Deposit,
  ]);
}

export function getToolNames(): string[] {
  return getAllTools().map(t => t.definition.name);
}