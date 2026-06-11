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
// import * as searchOecd from './search-oecd.js'; // TODO: incomplete - missing handler
import * as searchOnData from './search-on-data.js';
import * as searchParks from './search-parks.js';
import * as searchProvincialData from './search-provincial-data.js';
import * as searchProvincialLegislatures from './search-provincial-legislatures.js';
import * as searchProvincialRegulators from './search-provincial-regulators.js';
import * as searchQcData from './search-qc-data.js';
import * as searchRealTimeFeeds from './search-real-time-feeds.js';
import * as searchRegionalAuthorities from './search-regional-authorities.js';
import * as searchSedi from './search-sedi.js';
import * as searchUn from './search-un.js';
import * as searchUndpHdr from './search-undp-hdr.js';
import * as searchUnions from './search-unions.js';
import * as searchUniversities from './search-universities.js';
import * as searchUtilities from './search-utilities.js';
// import * as searchVotes from './search-votes.js'; // TODO: incomplete - missing handler

// ── AI & entity resolution ───────────────────────────────────────
import * as aiAsk from './ai-ask.js';
import * as aiAnalyze from './ai-analyze.js';
import * as aiSearchSemantic from './ai-search-semantic.js';
import * as systemHealth from './system-health.js';
import * as resolveEntity from './resolve-entity.js';
import * as findConnections from './find-connections.js';

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
    // searchOecd, // TODO: incomplete - missing handler
    searchOnData,
    searchParks,
    searchProvincialData,
    searchProvincialLegislatures,
    searchProvincialRegulators,
    searchQcData,
    searchRealTimeFeeds,
    searchRegionalAuthorities,
    searchSedi,
    searchUn,
    // searchUndpHdr, // TODO: incomplete - missing handler
    searchUnions,
    searchUniversities,
    searchUtilities,
    // searchVotes, // TODO: incomplete - missing handler

    aiAsk,
    aiAnalyze,
    aiSearchSemantic,
    systemHealth,
    resolveEntity,
    findConnections,
  ];
}

export function getToolNames(): string[] {
  return getAllTools().map(t => t.definition.name);
}