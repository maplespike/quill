export { parseRSS, hashString, fetchFeed, deduplicateItems, RSS_SOURCES } from './rss.js';
export { fetchStatCanReleases, fetchCKANPackages, fetchOpenDataPortal, getGovDataSourceClient, GOV_DATA_SOURCES } from './gov-api.js';
export type { RSSItem, RSSFeed, RSSSource, RawArticle } from './rss.js';
export type { GovRelease, CKANPackage, StatCanRelease, OpenDataPortalDataset, OpenDataPortalConfig } from './gov-api.js';

// Committee evidence ingestion
export {
  ingestCommittee,
  ingestAllCommittees,
  ingestSenateCommittees,
  ingestInCameraMeetings,
} from './committees/index.js';
export {
  fetchEvidenceXml,
  fetchMeetingList,
} from './committees/fetcher.js';
export {
  parseEvidenceXml,
} from './committees/parser.js';
export {
  COMMITTEE_DDL,
  upsertMeeting,
  insertIntervention,
  upsertSpeaker,
  meetingExists,
  getLatestMeetingNumber,
  searchTranscripts,
  getInCameraCount,
} from './committees/db.js';
export {
  COMMITTEES,
  COMMITTEE_MAP,
  SENATE_COMMITTEES,
  SENATE_COMMITTEE_MAP,
  SENATE_BASE_URL,
  evidenceUrl,
  evidenceHtmlUrl,
  getBaseUrl,
} from './committees/constants.js';
export type {
  Chamber,
  CommitteeInfo,
  CommitteeMeeting,
  Intervention,
  CommitteeSpeaker,
  CommitteeIngestionResult,
  CommitteeCategory,
} from './committees/types.js';

// Corporate/business data ingestion
export {
  ingestLobbying,
  ingestProcurement,
  ingestExecutiveStatements,
  ingestInsiderTransactions,
  ingestCorporationsCanada,
  ingestAllCorporate,
} from './corporate/index.js';
export {
  fetchRegistrationsCsv,
  searchLobbying,
  fetchMonthlyCommunicationReports,
} from './corporate/lobbying.js';
export {
  fetchTendersRss,
  fetchProactiveDisclosureContracts,
  isSoleSource,
  parseContractValue,
} from './corporate/procurement.js';
export {
  fetchCompanyPressReleases,
  extractExecutiveStatements,
  findTrackedExecutive,
} from './corporate/statements.js';
export {
  CORPORATE_SOURCES,
  TRACKED_EXECUTIVES,
} from './corporate/constants.js';
export type {
  LobbyingRecord,
  ContractAward,
  CorporateEntity,
  ExecutiveStatement,
  InsiderTransaction,
  CorporateIngestionResult,
} from './corporate/types.js';
export {
  searchSEDI,
} from './corporate/sedi.js';
export {
  searchCorporationsCanada,
} from './corporate/corporations.js';

// Canada Gazette ingestion — proposed and enacted regulations
export {
  ingestGazette,
  ingestAllParts,
  initializeGazetteTable,
  getLatestPublicationDate,
  searchGazetteRecords,
} from './gazette/index.js';
export {
  fetchGazetteFeed,
  fetchRegulationDetail,
} from './gazette/fetcher.js';
export {
  parseGazetteRSS,
  extractRIALink,
  extractDepartment,
  extractRIASText,
} from './gazette/parser.js';
export {
  GAZETTE_RSS_URLS,
  GAZETTE_DDL,
} from './gazette/constants.js';
export type {
  GazetteRecord,
  GazettePart,
  GazetteIngestionResult,
} from './gazette/types.js';

// Influence tracking — IOs, NGOs, think tanks, consultancies
export {
  ingestActors,
  detectFundingFlows,
  ingestAllInfluence,
  investigateActor,
} from './influence/index.js';
export {
  searchCraCharity,
  resolveCraBn,
  getActorInvestigationUrls,
} from './influence/actors.js';
export {
  fetchGrantsCkanMetadata,
  matchTrackedActor,
  buildGrantSearchUrl,
  queryGrantsForActor,
  parseCkanGrantDoc,
  getOversightCommittee,
  CANADA_INTL_ORG_CONTRIBUTIONS,
} from './influence/funding.js';
export {
  generateHypotheticalConnections,
  generateVerificationStatuses,
  generateActorInvestigation,
} from './influence/connections.js';
export {
  INFLUENCE_SOURCES,
  TRACKED_INFLUENCE_ACTORS,
  findInfluenceActor,
  getActorsByCategory,
} from './influence/constants.js';
export {
  INFLUENCE_DDL,
  upsertInfluenceActor,
  upsertInfluenceConnection,
  upsertGovernmentFunding,
  searchCommitteeMentions,
} from './influence/db.js';
export type {
  InfluenceActor,
  InfluenceActorCategory,
  InfluenceConnection,
  ConnectionType,
  GovernmentFunding,
  CraCharityRecord,
  InfluenceIngestionResult,
} from './influence/types.js';

// GIC Appointments (Governor-in-Council)
export {
  ingestGIC,
  searchGIC,
  getRecentAppointments,
  getHighValueAppointments,
  findLobbyistsTurnedAppointees,
} from './gic/index.js';
export {
  fetchGICAppointments,
  fetchAppointmentDetail,
  searchGicPackages,
} from './gic/fetcher.js';
export {
  parseGICAppointment,
  parseGICAppointments as parseGICAppointments,
  categorizeByDepartment,
  categorizeByBody,
  extractSalaryRange,
  extractDepartmentCategory,
} from './gic/parser.js';
export {
  GIC_SOURCE_CONFIGS,
  GIC_SOURCES,
  GIC_CKAN_PACKAGE_IDS,
  ckanPackageUrl,
  ckanSearchUrl,
  infobaseApiUrl,
} from './gic/constants.js';
export type {
  GICAppointment,
  GICCategory,
  GICIngestionResult,
  RawGICRecord,
} from './gic/types.js';

// Independent Oversight Bodies — OAG, PBO, Ethics Commissioner, Lobbying Commissioner
export {
  ingestBody,
  ingestAllBodies,
  ingestOAG,
  ingestPBO,
  ingestEthicsCommissioner,
  ingestLobbyingCommissioner,
  ingestCompetitionBureau,
  ingestCRTC,
  initializeOversightInvestigationsTable,
} from './oversight/index.js';
export {
  OVERSIGHT_DDL,
  OVERSIGHT_INVESTIGATIONS_DDL,
} from './oversight/index.js';
export {
  fetchOAGReports,
  fetchPBOReports,
  fetchEthicsInvestigations,
  fetchLobbyingInvestigations,
  fetchCompetitionBureauDecisions,
  fetchCompetitionBureauMergers,
  fetchCRTCDecisions,
  fetchRSSFeed,
} from './oversight/fetcher.js';
export {
  parseOAGReportList,
  parsePBOReportList,
  parseEthicsReport,
  parseLobbyingInvestigation,
  parseCompetitionDecision,
  parseCompetitionBureauList,
  parseCRTCDecision,
  parseCRTCList,
  parseFindingsFromHtml,
  extractMergerConditions,
  parseMergerReviewDetail,
  parseCRTCDecisionDetail,
} from './oversight/parser.js';
export {
  OVERSIGHT_BODIES,
  OAG_REPORTS_URL,
  OAG_RSS_URL,
  OAG_JSON_API_URL,
  PBO_BASE_URL,
  PBO_PUBLICATIONS_URL,
  PBO_API_URL,
  CIEC_BASE_URL,
  CIEC_INVESTIGATIONS_URL,
  CIEC_PUBLICATIONS_URL,
  OCL_BASE_URL,
  OCL_INVESTIGATIONS_URL,
  OCL_ANNUAL_REPORTS_URL,
  CB_BASE_URL,
  CB_MERGERS_URL,
  CB_ENFORCEMENT_URL,
  CB_RSS_URL,
  CB_CONSULTATIONS_URL,
  CB_BULLETINS_URL,
  CRTC_BASE_URL,
  CRTC_DECISIONS_URL,
  CRTC_BROADCASTING_DECISIONS_URL,
  CRTC_TELECOM_DECISIONS_URL,
  CRTC_BROADCASTING_RSS_URL,
  CRTC_TELECOM_RSS_URL,
  CRTC_CONSULTATION_RSS_URL,
  CRTC_OWNERSHIP_URL,
  crtcDecisionUrl,
} from './oversight/constants.js';
export type {
  OversightBody,
  OversightReport,
  OversightReportType,
  Recommendation,
  RecommendationStatus,
  OversightIngestionResult,
  Investigation,
  MergerReview,
  CRTCDecision,
  RawEthicsItem,
  RawLobbyingItem,
} from './oversight/types.js';

// Provincial Lobbying Registries
export {
  ingestOntarioLobbying,
  ingestBCLobbying,
  ingestAlbertaLobbying,
  ingestQuebecLobbying,
  ingestAllProvincial,
  searchProvincialLobbying,
  searchOntario,
  findCrossJurisdictionActivity,
  getProvinceConfig,
} from './provincial-lobbying/index.js';
export {
  fetchOntarioLobbying,
  fetchOntarioMonthlyReports,
  searchOntarioCkanDatasets,
  fetchOntarioCkanPackage,
  searchOntarioRegistry,
} from './provincial-lobbying/fetcher.js';
export {
  fetchBCLobbying,
  searchBCRegistry,
  fetchAlbertaLobbying,
  searchAlbertaRegistry,
  fetchQuebecLobbying,
  searchQuebecRegistry,
} from './provincial-lobbying/fetchers/index.js';
export {
  normalizeToFederalSchema,
  normalizeOntarioRecord,
  normalizeOntarioSubjects,
  normalizeBCRecord,
  normalizeAlbertaRecord,
  normalizeQuebecRecord,
  normalizeBatch,
  toFederalRecord,
} from './provincial-lobbying/parser.js';
export {
  PROVINCE_CONFIGS,
} from './provincial-lobbying/types.js';
export {
  ONTARIO_LOBBYING,
  ONTARIO_CKAN,
  ONTARIO_LOBBYING_SUBJECTS,
  BC_LOBBYING,
  ALBERTA_LOBBYING,
  QUEBEC_LOBBYING,
} from './provincial-lobbying/constants.js';
export type {
  ProvincialLobbyingRecord,
  Province,
  ProvinceConfig,
  ProvincialIngestionResult,
  RawOntarioRecord,
  RawBCRecord,
  RawAlbertaRecord,
  RawQuebecRecord,
} from './provincial-lobbying/types.js';

// Elections Canada Third-Party Advertiser Registry
export {
  ingestThirdPartyAds,
  getTopSpenders,
  searchThirdParty,
  findInfluenceCrossReferences,
  findCorporateCrossReferences,
} from './elections/index.js';
export {
  fetchThirdPartyRegistry,
  fetchFinancialReports,
} from './elections/fetcher.js';
export {
  parseThirdPartyAd,
  parseThirdPartyAds,
  parseThirdPartyCSV,
  parseThirdPartySpending,
  parseThirdPartySpendings,
  categorizeByType,
} from './elections/parser.js';
export {
  ELECTIONS_SOURCES,
  ckanPackageUrl as electionsCkanPackageUrl,
  ckanSearchUrl as electionsCkanSearchUrl,
  registryDetailUrl,
} from './elections/constants.js';
export type {
  ThirdPartyAd,
  ThirdPartySpending,
  ThirdPartyType,
  ElectionPeriod,
  ElectionPeriodType,
  AdvertisingPlatform,
  ElectionsIngestionResult,
  RawThirdPartyRecord,
  RawThirdPartySpendingRecord,
} from './elections/types.js';

// CanLII Court Decisions
export {
  ingestDecisions,
  searchDecisions,
  getRecentByCourt,
  initializeCanliiTables,
  canliiTablesExist,
  CANLII_DECISIONS_DDL,
  CANLII_CITATIONS_DDL,
  CANLII_DDL,
} from './canlii/index.js';
export {
  searchCanlii,
  fetchCaseList,
  fetchDecisionDetail,
  fetchCitedCases,
  fetchCitingCases,
  fetchCitedLegislation,
  searchByLegislation,
  fetchDatabaseList,
} from './canlii/fetcher.js';
export {
  parseDecisionDetail,
  parseCaseListItem,
  extractCitations,
  extractParties,
  enrichWithCitations,
  assessGovernmentRelevance,
  mapDatabaseIdToCourt,
} from './canlii/parser.js';
export {
  CANLII_API_BASE,
  CANLII_API_KEY_ENV,
  TRACKED_COURTS,
  TRACKED_COURT_LIST,
  DATABASE_ID_TO_COURT,
  TRACKED_LEGISLATION_KEYWORDS,
  TRACKED_GOV_DEPARTMENTS,
  caseBrowseUrl,
  caseDetailUrl,
  caseCitatorUrl,
  caseSearchUrl,
} from './canlii/constants.js';
export type {
  CanliiDecision,
  CanliiIngestionResult,
  Court,
  LegalCitation,
  PartyInfo,
  TrackedCourt,
} from './canlii/types.js';

// LMIA (Labour Market Impact Assessment) — ESDC quarterly data
// Cross-reference with corporate (TFW program usage) and procurement (gov contracts + TFW)
export {
  ingestLmia,
  ingestAllLmia,
  initializeLmiaTable,
  getTopEmployers,
  searchByEmployer,
  searchByOccupation,
  getByProvince,
  getLmiaStats,
  listAvailableQuarters,
} from './lmia/index.js';
export {
  fetchLatestLmiaRecords,
  fetchLmiaByQuarter,
  fetchLmiaCkanMetadata,
  discoverLatestQuarter,
  discoverLatestResource,
} from './lmia/fetcher.js';
export {
  parseLmiaCsv,
  extractStream,
  classifyOccupation,
} from './lmia/parser.js';
export {
  LMIA_DDL,
  LMIA_CKAN_PACKAGE_IDS,
  LMIA_KNOWN_RESOURCES,
} from './lmia/constants.js';
export type {
  LmiaRecord,
  LmiaOutcome,
  LmiaStream,
  LmiaIngestionResult,
} from './lmia/types.js';
export type {
  CkanResource,
  CkanPackageResponse,
} from './lmia/index.js';