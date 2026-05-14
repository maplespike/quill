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
import * as aiAsk from './ai-ask.js';
import * as aiAnalyze from './ai-analyze.js';
import * as aiSearchSemantic from './ai-search-semantic.js';
import * as systemHealth from './system-health.js';

import * as searchAti from './search-ati.js';
import * as searchBankOfCanada from './search-bank-of-canada.js';
import * as searchCipo from './search-cipo.js';
import * as searchCmhc from './search-cmhc.js';
import * as searchCraCharity from './search-cra-charity.js';
import * as searchCriminalJustice from './search-criminal-justice.js';
import * as searchCrownCorporations from './search-crown-corporations.js';
import * as searchCrtc from './search-crtc.js';
import * as searchEducationResearch from './search-education-research.js';
import * as searchFederalBudget from './search-federal-budget.js';
import * as searchFederalTribunals from './search-federal-tribunals.js';
import * as searchGeospatial from './search-geospatial.js';
import * as searchGlobalCanada from './search-global-canada.js';
import * as searchHealthCanada from './search-health-canada.js';
import * as searchHealthData from './search-health-data.js';
import * as searchImpactAssessment from './search-impact-assessment.js';
import * as searchIndigenousRelations from './search-indigenous-relations.js';
import * as searchMunicipal from './search-municipal.js';
import * as searchNpri from './search-npri.js';
import * as searchProactiveDisclosure from './search-proactive-disclosure.js';
import * as searchProvincialLegislatures from './search-provincial-legislatures.js';
import * as searchScienceResearch from './search-science-research.js';
import * as searchSedi from './search-sedi.js';
import * as searchSocialPrograms from './search-social-programs.js';
import * as searchSpeciesAtRisk from './search-species-at-risk.js';
import * as searchTransportInfrastructure from './search-transport-infrastructure.js';

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
    aiAsk,
    aiAnalyze,
    aiSearchSemantic,
    systemHealth,
    searchAti,
    searchBankOfCanada,
    searchCipo,
    searchCmhc,
    searchCraCharity,
    searchCriminalJustice,
    searchCrownCorporations,
    searchCrtc,
    searchEducationResearch,
    searchFederalBudget,
    searchFederalTribunals,
    searchGeospatial,
    searchGlobalCanada,
    searchHealthCanada,
    searchHealthData,
    searchImpactAssessment,
    searchIndigenousRelations,
    searchMunicipal,
    searchNpri,
    searchProactiveDisclosure,
    searchProvincialLegislatures,
    searchScienceResearch,
    searchSedi,
    searchSocialPrograms,
    searchSpeciesAtRisk,
    searchTransportInfrastructure,
  ];
}

export function getToolNames(): string[] {
  return getAllTools().map(t => t.definition.name);
}
