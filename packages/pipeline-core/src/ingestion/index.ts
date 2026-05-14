export { parseRSS, hashString, fetchFeed, deduplicateItems, RSS_SOURCES } from './rss.js';
export { fetchStatCanReleases, fetchCKANPackages, fetchOpenDataPortal, getGovDataSourceClient, GOV_DATA_SOURCES } from './gov-api.js';
export type { RSSItem, RSSFeed, RSSSource, RawArticle } from './rss.js';
export type { GovRelease, CKANPackage, StatCanRelease, OpenDataPortalDataset, OpenDataPortalConfig } from './gov-api.js';

// Provincial CKAN portal stubs
export {
  PROVINCIAL_CKAN_SOURCES,
  fetchProvincialCkan,
  fetchAllProvincialCkan,
} from './provincial-ckan.js';
export type { ProvincialCkanSource } from './provincial-ckan.js';

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

// LODE Geospatial — BC Land Ownership Data Exchange & GeoMet weather Canada WFS/WMS
export {
  discoverLayers,
  fetchFeatures,
  fetchLODEData,
} from './geospatial/fetcher.js';
export {
  LODE_SOURCES,
  WFS_VERSION,
  WMS_VERSION,
} from './geospatial/constants.js';
export type {
  LodeSourceKey,
} from './geospatial/constants.js';
export type {
  GeoPoint,
  BoundingBox,
  GeoFeature,
  GeoLayer,
  LODEResult,
} from './geospatial/types.js';

// Proactive Disclosure — federal contracts over $10K, travel, hospitality, reclassification
export {
  ingestProactiveDisclosure,
  searchProactiveDisclosure,
  getContractsByVendor,
  getContractsByDepartment,
  getTopContracts,
  getDepartmentStats,
  initializePDTable,
  fetchProactiveDisclosure,
  fetchAllProactiveDisclosure,
  fetchByDepartment,
  parseCKAResult,
  parseCKAResults,
  normalizeDate,
  extractFiscalYear,
  inferGoodsOrServices,
  PROACTIVE_DISCLOSURE_DDL,
  MAJOR_DEPARTMENTS,
  CKAN_SOLR_SEARCH_URL,
  CKAN_API_BASE,
  DEFAULT_SEARCH_QUERY,
  DEPARTMENT_ACRONYM_MAP,
  OWNER_ORG_ACRONYM_MAP,
  PDError,
} from './proactive-disclosure/index.js';
export type {
  ProactiveDisclosureRecord,
  ProactiveDisclosureSearchOptions,
  ProactiveDisclosureIngestionResult,
  RawCKANProactiveDisclosureDoc,
  DepartmentInfo,
  CKANSearchResponse,
} from './proactive-disclosure/types.js';

// Provincial Legislatures — Hansard, committees, and bills across all 10 provinces
export {
  ingestProvincialLegislatures,
  ingestAllProvincialLegislatures,
  initializeProvincialLegislaturesTable,
  searchProvincialLegislatures,
  getByProvince as getLegislatureByProvince,
  getBySpeaker,
  getByBillNumber,
  getRecentProvincialRecords,
  getActiveBills,
  getProvincialStats,
  PROVINCIAL_LEGISLATURES_DDL,
} from './provincial-legislatures/index.js';
export {
  fetchProvincialHansard,
  fetchAllProvincialHansard,
  fetchOntarioHansard,
  fetchOntarioCommitteeHearings,
  fetchOntarioBills,
  fetchBCHansard,
  fetchBCCommitteeHearings,
  fetchBCBills,
  fetchAlbertaHansard,
  fetchAlbertaCommitteeHearings,
  fetchAlbertaBills,
} from './provincial-legislatures/fetcher.js';
export {
  parseProvincialRecord,
  parseProvincialRecords,
  parseOntarioHansardXml,
  parseBCHansardXml,
  parseAlbertaHansardHtml,
  parseBillEntry,
  extractBillReferences,
  normalizeProvince,
  detectRecordType,
} from './provincial-legislatures/parser.js';
export {
  PROVINCE_CONFIGS as LEGISLATURE_CONFIGS,
  ALL_PROVINCES,
  IMPLEMENTED_PROVINCES,
  XML_HANSARD_PROVINCES,
  ONTARIO_CONFIG,
  BC_CONFIG,
  ALBERTA_CONFIG,
  QUEBEC_CONFIG,
  ONTARIO,
  BC,
  ALBERTA,
  DEFAULT_MAX_RECORDS,
  ProvincialLegislatureError,
} from './provincial-legislatures/constants.js';
export type {
  ProvincialLegislatureRecord,
  ProvinceCode,
  LegislativeRecordType,
  ProvinceChamber,
  ProvinceLegislatureConfig,
  ProvincialLegislatureIngestionOptions,
  ProvincialLegislatureIngestionResult,
} from './provincial-legislatures/types.js';

// Crown Corporations — annual reports, quarterly financials, governance data
export {
  ingestCrownCorporations,
  ingestAllCrownCorporations,
  initializeCrownCorporationsTable,
  searchCrownCorporations,
  getByOrg,
  getByFiscalYear,
  getRecentRecords,
  getAnnualFinancials,
  crownCorporationsTableExists,
  getLatestPublishedDate,
  recordExists,
  CROWN_CORPORATIONS_DDL,
} from './crown-corporations/index.js';
export {
  fetchCrownCorpReport,
  fetchAllCrownCorps,
  fetchCBCReports,
  fetchCanadaPostReports,
  fetchCMHCReports,
  fetchEDCReports,
  fetchViaRailReports,
  fetchBDCReports,
} from './crown-corporations/fetcher.js';
export {
  parseReport,
  parseRecords,
  detectReportType,
  detectQuarter,
  normalizeOrgCode,
  extractFiscalYear as crownCorpExtractFiscalYear,
} from './crown-corporations/parser.js';
export {
  CROWN_CORP_CONFIGS,
  ALL_CROWN_CORPS,
  CURRENT_CROWN_CORPS,
  QUARTERLY_REPORTING_CORPS,
  RSS_FEED_CORPS,
  ANNUAL_REPORT_URL_PATTERNS,
  CrownCorporationError,
  DEFAULT_MAX_RECORDS as CROWN_CORP_DEFAULT_MAX_RECORDS,
} from './crown-corporations/constants.js';
export type {
  CrownCorporationRecord,
  CrownCorporationCode,
  ReportType,
  CrownCorporationConfig,
  CrownCorporationIngestionOptions,
  CrownCorporationIngestionResult,
} from './crown-corporations/types.js';

// Federal Budget — budget, public accounts, fiscal monitor, departmental plans
export {
  ingestFederalBudget,
  ingestAllFederalBudget,
  initializeFederalBudgetTable,
  searchFederalBudget as budgetSearchFederalBudget,
  getByFiscalYear as budgetGetByFiscalYear,
  getByRecordType as budgetGetByRecordType,
  getByDepartment as budgetGetByDepartment,
  getByCategory as budgetGetByCategory,
  getDeficitHistory as budgetGetDeficitHistory,
  getDebtHistory as budgetGetDebtHistory,
  budgetTableExists as budgetTableExists,
  getLatestPublishedDate as budgetGetLatestPublishedDate,
  recordExists as budgetRecordExists,
  FEDERAL_BUDGET_DDL,
} from './federal-budget/index.js';
export {
  fetchBudgetData,
  fetchPublicAccounts,
  fetchFiscalMonitor,
  fetchDepartmentalPlans,
  fetchAllBudgetData,
  searchCKAN as budgetSearchCKAN,
  fetchCKANPackage as budgetFetchCKANPackage,
  fetchCKANResource as budgetFetchCKANResource,
  extractDocumentLinks as budgetExtractDocumentLinks,
  normalizeFiscalYear as budgetNormalizeFiscalYear,
} from './federal-budget/fetcher.js';
export {
  parseBudgetCSV,
  parsePublicAccounts as budgetParsePublicAccounts,
  parseFiscalMonitorCSV as budgetParseFiscalMonitorCSV,
  parseDepartmentalPlanRecords as budgetParseDepartmentalPlanRecords,
  parseDocumentLinks as budgetParseDocumentLinks,
  parseCKANPackage as budgetParseCKANPackage,
  detectCategory as budgetDetectCategory,
  detectRecordType as budgetDetectRecordType,
  parseAmount as budgetParseAmount,
  parseCSVLine as budgetParseCSVLine,
} from './federal-budget/parser.js';
export {
  FEDERAL_DEPARTMENTS,
  DEPARTMENT_ACRONYM_MAP as BUDGET_DEPARTMENT_ACRONYM_MAP,
  DEPARTMENT_NAME_MAP as BUDGET_DEPARTMENT_NAME_MAP,
  ALL_BUDGET_RECORD_TYPES,
  ALL_BUDGET_CATEGORIES,
  BUDGET_RECORD_TYPE_LABELS,
  BUDGET_CATEGORY_LABELS,
  RECENT_FISCAL_YEARS,
  AVAILABLE_BUDGET_YEARS,
  BUDGET_SOURCES,
  BUDGET_CKAN_PACKAGE_IDS,
  BudgetError,
  DEFAULT_MAX_RECORDS as BUDGET_DEFAULT_MAX_RECORDS,
} from './federal-budget/constants.js';
export type {
  BudgetRecord,
  BudgetRecordType,
  BudgetCategory,
  BudgetIngestionOptions,
  BudgetIngestionResult,
  CKANPackageResponse as BudgetCKANPackageResponse,
  CKANPackage as BudgetCKANPackage,
  CKANResource as BudgetCKANResource,
  RawPublicAccountsRow,
  RawFiscalMonitorRow,
  RawDepartmentalPlanRow,
} from './federal-budget/types.js';

// CRTC — Canadian Radio-television and Telecommunications Commission
// Broadcasting/telecom decisions, ownership tracking, regulatory data
export {
  ingestCrtc,
  initializeCrtcTables,
  crtcTablesExist,
  searchDecisions as crtcSearchDecisions,
  getRecentDecisions as crtcGetRecentDecisions,
  getOwnershipChangeDecisions,
  getDecisionsByApplicant as crtcGetDecisionsByApplicant,
  getNetNeutralityDecisions,
  searchOwnershipRecords,
  getOwnershipByOwner,
  CRTC_DECISIONS_DDL,
  CRTC_OWNERSHIP_DDL,
  CRTC_DDL,
} from './crtc/index.js';
export {
  fetchAllCrtcDecisions,
  fetchCrtcRSSFeed,
  fetchRecentBroadcastingDecisions,
  fetchRecentTelecomDecisions,
  fetchRecentNoticesOfConsultation,
  fetchCrtcArchiveYear,
  fetchCrtcMainArchivePage,
  fetchDecisionDetail as fetchCrtcDecisionDetail,
  fetchCrtcOwnershipPage,
  fetchOwnershipDetail,
  searchCrtcCkanDatasets,
  fetchCrtcCkanPackage,
  CrtcFetchError,
} from './crtc/fetcher.js';
export {
  parseCrtcDecision,
  parseCrtcDecisionList,
  parseCrtcOwnershipRecord,
  parseOwnershipPageHtml,
  createIngestionResult,
} from './crtc/parser.js';
export {
  // Constants that do NOT overlap with oversight/constants.ts exports
  CRTC_RSS_FEEDS,
  CRTC_CKAN_BASE,
  CRTC_CKAN_SEARCH,
  CRTC_CKAN_PACKAGE_SHOW,
  CRTC_CKAN_PACKAGE_IDS,
  ckanPackageUrl as crtcCkanPackageUrl,
  ckanSearchUrl as crtcCkanSearchUrl,
  crtcDecisionPdfUrl,
  extractYearFromDecisionNumber,
  CRTC_DECISION_TYPE_PATTERNS,
  CRTC_TYPE_TO_SEGMENT,
  CRTC_SUBJECT_KEYWORDS,
  DEFAULT_TIMEOUT_MS as CRTC_DEFAULT_TIMEOUT_MS,
  MAX_ARCHIVE_PAGES as CRTC_MAX_ARCHIVE_PAGES,
  MAX_RSS_ITEMS as CRTC_MAX_RSS_ITEMS,
  HISTORICAL_YEARS_BACK as CRTC_HISTORICAL_YEARS_BACK,
} from './crtc/constants.js';
export type {
  CrtcDecision,
  CrtcDecisionType,
  CrtcDecisionOutcome,
  CrtcSubjectMatter,
  CrtcOwnershipRecord,
  OwnershipRecordType,
  CrtcIngestionResult,
  RawCrtcDecisionItem,
  RawCrtcOwnershipItem,
} from './crtc/types.js';

// SEDI Insider Trading Reports — C-Suite executive stock trades at Canadian public companies
export {
  ingestSedi,
  ingestSediByIssuer,
  ingestSediRecent,
  initializeSediTable,
  getLatestTransactionDate,
  searchInsiderTransactions,
  transactionExistsBySource,
  getTrackedOrgs,
  getMajorIssuers,
} from './sedi/index.js';
export {
  fetchInsiderTransactions,
  fetchSediByIssuer,
  fetchSediByInsider,
  fetchSediFrontPage,
  fetchSediReportDetail,
  fetchSedarpPlus,
  extractSediTableRows,
  SediFetchError,
} from './sedi/fetcher.js';
export {
  parseSediReport,
  parseSediReportDetail,
  parseSediDate,
  parseSediNumber,
  classifyTransactionType,
  normalizeSediRow,
  deduplicateTransactions,
} from './sedi/parser.js';
export {
  SEDI_BASE_URL,
  SEDI_SEARCH_URL,
  SEDI_DDL,
  INSIDER_SOURCES,
  MAJOR_TSX_ISSUERS,
  TRACKED_EXEC_ORGS,
  findIssuerByTicker,
  findIssuerByName,
} from './sedi/constants.js';
export type {
  SediIngestionResult,
  SediSearchParams,
  RawSediRow,
  InsiderDataSource,
} from './sedi/types.js';

// Bank of Canada — rate decisions, monetary policy reports, financial system reviews, executive speeches
export {
  ingestBankOfCanada,
  initializeBocTable,
  bocTableExists,
  getLatestBocDate,
  searchBocDecisions,
  getRecentBocDecisions,
  getBocRateChanges,
  getBocByDateRange,
  getBocSpeechesBySpeaker,
  BOC_DECISIONS_DDL,
} from './bank-of-canada/index.js';
export {
  fetchAllBocData,
  fetchAllBocRateDecisions,
  fetchAllBocPublications,
  fetchAllBocSpeeches,
  fetchBocRateRSSFeed,
  fetchBocMPRList,
  fetchBocFSRList,
  fetchBocSpeeches,
  fetchDetailPage,
  fetchDetailPages,
  BocFetchError,
} from './bank-of-canada/fetcher.js';
export {
  parseBocDecision,
  parseBocDecisionList,
  createIngestionResult as createBocIngestionResult,
} from './bank-of-canada/parser.js';
export {
  BOC_SOURCES,
  BOC_RATE_SCHEDULE,
  BOC_RATE_HISTORY,
  BOC_BASE_URL,
  BOC_RATES_URL,
  BOC_RATES_RSS_URL,
  BOC_MPR_URL,
  BOC_FSR_URL,
  VALA_BASE_URL,
  bocRateUrl,
  bocPublicationUrl,
  findRateByDate,
  findScheduleByDate,
  DEFAULT_TIMEOUT_MS as BOC_DEFAULT_TIMEOUT_MS,
  MAX_RSS_ITEMS as BOC_MAX_RSS_ITEMS,
  HISTORICAL_YEARS_BACK as BOC_HISTORICAL_YEARS_BACK,
} from './bank-of-canada/constants.js';
export type {
  BocDecision,
  BocDecisionType,
  BocSourceConfig,
  BocIngestionResult,
  RawBocItem,
  RawBocPage,
  BocRateScheduleEntry,
  BocRateHistoryEntry,
} from './bank-of-canada/types.js';

// ATI (Access to Information) — completed ATI requests published by federal departments
export {
  ingestAti,
  ingestAllAti,
  initializeAtiTable,
  atiTableExists,
  atiRecordExists,
  getLatestAtiIngestionDate,
  searchAtiRecords,
  getAtiByDepartment,
  getAtiByDisposition,
  getAtiDepartmentStats,
  ATI_RECORDS_DDL,
  ATI_DEPARTMENTS,
  ATI_DEPARTMENT_ACRONYM_MAP,
  ATI_SOURCES,
  ATI_CKAN_PACKAGE_IDS,
  RECENT_FISCAL_YEARS as ATI_RECENT_FISCAL_YEARS,
  AtiError,
} from './ati/index.js';
export {
  fetchAtiReleases,
  fetchAllAtiReleases,
  searchAtiCkanPackages,
  fetchAtiCkanPackage,
  fetchAtiResource,
} from './ati/fetcher.js';
export {
  parseAtiRecord,
  parseAtiBatch,
  parseAtiCkanPackage,
  normalizeDisposition as normalizeAtiDisposition,
} from './ati/parser.js';
export type {
  AtiRecord,
  AtiDisposition,
  AtiIngestionOptions,
  AtiIngestionResult,
  RawAtiRecord,
  RawAtiCkanPackage,
} from './ati/types.js';

// Municipal Council Data — meetings, agendas, decisions, budgets across major Canadian cities
export {
  ingestMunicipal,
  searchMunicipalMeetings,
  getRecentMeetings,
  getBudgetMeetings,
  getMeetingsByVendor,
  MUNICIPAL_MEETINGS_DDL,
  MUNICIPAL_DDL,
} from './municipal/index.js';
export {
  fetchCityMeetings,
  fetchMeetingDetail,
} from './municipal/fetcher.js';
export {
  parseMeetingRecords,
  parseMeetingPage,
  parseSingleRecord,
  detectMeetingTypes,
} from './municipal/parser.js';
export {
  ALL_CITIES,
  IMPLEMENTED_CITIES,
  CITY_CONFIGS,
  VENDOR_PLATFORM_PATTERNS,
  MEETING_TYPE_KEYWORDS,
  DECISION_TYPE_KEYWORDS,
  getCityConfig,
  isCityImplemented,
  detectVendorPlatform,
  meetingsListUrl,
  meetingDetailUrl as municipalMeetingDetailUrl,
  agendaUrl as municipalAgendaUrl,
  minutesUrl as municipalMinutesUrl,
  MunicipalCouncilError,
  NotYetImplementedError,
} from './municipal/constants.js';
export type {
  MunicipalMeeting,
  MeetingDecision,
  MeetingType,
  MeetingStatus,
  DecisionType,
  CityCode,
  CityConfig,
  CityInfo,
  VendorPlatform,
  RawCouncilRecord,
  MunicipalIngestionResult,
} from './municipal/types.js';

// CRA Charity T3010 — detailed financials of every registered Canadian charity
export {
  ingestCraCharities,
  ingestAllCraCharityYears,
  initializeCraCharityTable,
  searchCraCharities,
  getTopPoliticalSpenders,
  getTopCharitiesByRevenue,
  getCraCharityStats,
} from './cra-charity/index.js';
export {
  fetchCraIdentCsv,
  fetchCraFinancialCsv,
  fetchCraGeneralCsv,
  fetchCraProgramsCsv,
  fetchCraAllCsvs,
  fetchCraCkanMetadata,
  discoverCraResources,
  listAvailableYears,
  CraCharityFetchError,
} from './cra-charity/fetcher.js';
export {
  parseCraCsvs,
  parseCraIdentCsv,
  parseCsvLine as craParseCsvLine,
  parseCurrency as craParseCurrency,
} from './cra-charity/parser.js';
export {
  CRA_CHARITY_T3010_DDL,
  CRA_CHARITY_PACKAGE_IDS,
  CRA_CKAN,
  CRA_CHARITY_SEARCH_URL,
  CRA_CSV_DOWNLOAD_URL,
  ckanPackageUrl as craCkanPackageUrl,
  ckanDownloadUrl as craCkanDownloadUrl,
  craSearchUrl,
} from './cra-charity/constants.js';
export type {
  CraCharityT3010,
  CraCharityIngestionResult,
} from './cra-charity/types.js';
export {
  CharityCategory,
  CharityDesignation,
  CharityStatus,
} from './cra-charity/types.js';

// NPRI — National Pollutant Release Inventory (facility pollutant releases)
export {
  ingestNpri,
  initializeNpriTable,
  npriTableExists,
  npriRecordExists,
  getLatestNpriIngestionDate,
  searchNpriRecords,
  getNpriByFacility,
  getNpriBySubstance,
  getNpriByProvince,
  NPRI_RECORDS_DDL,
  NPRI_SOURCES,
  NPRI_CKAN_PACKAGE_IDS,
  RECENT_FISCAL_YEARS as NPRI_RECENT_FISCAL_YEARS,
  NpriError,
} from './npri/index.js';
export {
  fetchNpriReleases,
  fetchAllNpriReleases,
  searchNpriCkanPackages,
  fetchNpriCkanPackage,
  fetchNpriResource,
} from './npri/fetcher.js';
export {
  parseNpriRecord,
  parseNpriBatch,
  parseNpriCkanPackage,
} from './npri/parser.js';
export type {
  NpriRecord,
  NpriIngestionOptions,
  NpriIngestionResult,
  RawNpriRecord,
  RawNpriCkanPackage,
} from './npri/types.js';

// Species at Risk — SARA registry listing decisions and recovery strategies
export {
  ingestSaraSpecies,
  initializeSaraTable,
  saraTableExists,
  saraRecordExists,
  getLatestSaraIngestionDate,
  searchSaraRecords,
  getSaraByStatus,
  getSaraByGroup,
  getSaraByProvince,
  SARA_SPECIES_DDL,
  SARA_SOURCES,
  SARA_STATUS_MAP,
  SARA_TAXONOMIC_GROUPS,
  SaraError,
} from './species-at-risk/index.js';
export {
  fetchSaraSpecies,
  fetchAllSaraSpecies,
  fetchSaraSpeciesDetail,
  fetchSaraRecoveryStrategies,
  fetchSaraListingDecisions,
} from './species-at-risk/fetcher.js';
export {
  parseSaraSpecies,
  parseSaraBatch,
  parseSaraResponse,
  normalizeStatus as normalizeSaraStatus,
} from './species-at-risk/parser.js';
export type {
  SpeciesAtRiskRecord,
  SpeciesStatus,
  SaraIngestionOptions,
  SaraIngestionResult,
  RawSaraSpecies,
  SaraApiResponse,
} from './species-at-risk/types.js';

// IAAC — Impact Assessment Agency of Canada (federal project assessments)
export {
  ingestIaacAssessments,
  initializeIaacTable,
  iaacTableExists,
  iaacRecordExists,
  getLatestIaacIngestionDate,
  searchIaacRecords,
  getIaacByDecision,
  getIaacByProponent,
  getIaacByProjectType,
  IAAC_ASSESSMENTS_DDL,
  IAAC_SOURCES,
  IAAC_DECISION_MAP,
  IAAC_ASSESSMENT_TYPE_MAP,
  IAAC_PROJECT_TYPES,
  IaacError,
} from './impact-assessment/index.js';
export {
  fetchIaacProjects,
  fetchIaacAssessmentDetail,
} from './impact-assessment/fetcher.js';
export {
  parseIaacRecord,
  parseIaacBatch,
  normalizeDecision as normalizeIaacDecision,
  normalizeAssessmentType,
} from './impact-assessment/parser.js';
export type {
  ImpactAssessmentRecord,
  ImpactAssessmentDecision,
  AssessmentType,
  IaacIngestionOptions,
  IaacIngestionResult,
  RawImpactAssessmentRecord,
} from './impact-assessment/types.js';

// Health Canada — drug approvals, medical device licenses, natural products, recalls
export {
  ingestHealthCanada,
  initializeHealthCanadaTable,
  healthCanadaTableExists,
  healthCanadaRecordExists,
  getLatestHealthCanadaIngestionDate,
  searchHealthCanadaRecords,
  getHealthCanadaByType,
  getHealthCanadaByManufacturer,
  getHealthCanadaRecallsBySeverity,
  getActiveHealthCanadaProducts,
  getExpiringHealthCanadaProducts,
  HEALTH_CANADA_DDL,
  HC_SOURCES,
  HC_PRODUCT_TYPE_CONFIG,
  HC_LICENSE_STATUS_MAP,
  ALL_HC_PRODUCT_TYPES,
  DEFAULT_MAX_RECORDS as HC_DEFAULT_MAX_RECORDS,
  HealthCanadaError,
} from './health-canada/index.js';
export {
  fetchHealthCanadaProducts,
  fetchAllHealthCanadaProducts,
} from './health-canada/fetcher.js';
export {
  parseProductRecord,
  parseProductBatch,
  normalizeLicenseStatus,
  normalizeProductType,
} from './health-canada/parser.js';
export type {
  HealthCanadaRecord,
  HealthCanadaProductType,
  HealthCanadaLicenseStatus,
  HealthCanadaIngestionOptions,
  HealthCanadaIngestionResult,
  RawHealthCanadaRecord,
} from './health-canada/types.js';

// CIPO — Canadian Intellectual Property Office patents, trademarks, industrial designs
export {
  ingestCipo,
  initializeCipoTable,
  cipoTableExists,
  cipoRecordExists,
  getLatestCipoIngestionDate,
  searchCipoRecords,
  getCipoByType,
  getCipoByOwner,
  getActiveCipoRecords,
  getExpiringCipoRecords,
  CIPO_DDL,
} from './cipo/index.js';
export {
  fetchCipoRecords,
  fetchAllCipoRecords,
} from './cipo/fetcher.js';
export {
  parseCipoRecord,
  parseCipoBatch,
  normalizeCipoStatus,
  normalizeCipoType,
} from './cipo/parser.js';
export {
  CIPO_SOURCES,
  CIPO_IP_TYPE_CONFIG,
  CIPO_STATUS_MAP,
  ALL_CIPO_IP_TYPES,
  DEFAULT_MAX_RECORDS as CIPO_DEFAULT_MAX_RECORDS,
  CipoError,
} from './cipo/constants.js';
export type {
  CipoRecord,
  CipoIpType,
  CipoStatus,
  CipoIngestionOptions,
  CipoIngestionResult,
  RawCipoRecord,
} from './cipo/types.js';

// CMHC — Canada Mortgage and Housing Corporation housing market data
export {
  ingestCmhc,
  initializeCmhcTable,
  cmhcTableExists,
  cmhcRecordExists,
  getLatestCmhcIngestionDate,
  searchCmhcRecords,
  getCmhcByMetric,
  getCmhcByArea,
  getCmhcByHousingType,
  getLatestCmhcMetric,
  CMHC_DDL,
} from './cmhc/index.js';
export {
  fetchCmhcData,
  fetchCmhcCkanMetadata,
} from './cmhc/fetcher.js';
export {
  parseCmhcDataset,
  parseCmhcCsvRows,
  normalizeCmhcMetric,
  normalizeCmhcHousingType,
} from './cmhc/parser.js';
export {
  CMHC_SOURCES,
  CMHC_METRIC_CONFIG,
  CMHC_METRIC_TYPE_MAP,
  ALL_CMHC_METRICS,
  ALL_CMHC_HOUSING_TYPES,
  DEFAULT_MAX_RECORDS as CMHC_DEFAULT_MAX_RECORDS,
  CmhcError,
} from './cmhc/constants.js';
export type {
  CmhcRecord,
  CmhcMetric,
  CmhcHousingType,
  CmhcIngestionOptions,
  CmhcIngestionResult,
  RawCmhcRecord,
} from './cmhc/types.js';

// Global Canada — GAC / ECCC / CSIS combined metadata tracking
export {
  ingestGlobalCanada,
  initializeGlobalCanadaTable,
  globalCanadaTableExists,
  globalCanadaRecordExists,
  getLatestGlobalCanadaIngestionDate,
  searchGlobalCanadaRecords,
  getGlobalCanadaBySource,
  getGlobalCanadaByTopic,
  getRecentGlobalCanadaRecords,
  searchGlobalCanadaBySource,
  GLOBAL_CANADA_DDL,
} from './global-canada/index.js';
export {
  fetchGlobalCanadaBySource,
  fetchAllGlobalCanadaRecords,
  fetchGacTradeAgreements,
  fetchEcccClimateData,
  fetchCsisReports,
} from './global-canada/fetcher.js';
export {
  parseGlobalCanadaRecord,
  parseGlobalCanadaBatch,
  parseGacRecord,
  parseEcccRecord,
  parseCsisHtml,
  normalizeSource,
  normalizeRecordType,
} from './global-canada/parser.js';
export {
  GLOBAL_CANADA_SOURCES,
  GLOBAL_CANADA_SOURCE_CONFIG,
  GLOBAL_CANADA_RECORD_TYPE_MAP,
  ALL_GLOBAL_CANADA_SOURCES,
  DEFAULT_MAX_RECORDS as GLOBAL_CANADA_DEFAULT_MAX_RECORDS,
  GlobalCanadaError,
} from './global-canada/constants.js';
export type {
  GlobalCanadaRecord,
  GlobalCanadaSource,
  GlobalCanadaRecordType,
  GlobalCanadaIngestionOptions,
  GlobalCanadaIngestionResult,
  RawGlobalCanadaRecord,
} from './global-canada/types.js';

// Immigration & Refugee — IRCC admissions, IRB decisions, CBSA enforcement
export {
  ingestAllImmigration,
  ingestPermanentResidents,
  ingestTempResidents,
  ingestRpdDecisions,
  ingestCbsaEnforcement,
  generateImmigrationLobbyingLinks,
} from './immigration/index.js';
export {
  fetchPermanentResidentsByProvince,
  fetchPermanentResidentsByCitizenship,
  fetchStudyPermitHolders,
  fetchWorkPermitImp,
  fetchWorkPermitTfwp,
  searchIrccData,
} from './immigration/ircc.js';
export {
  fetchRpdDecisionsQuarter,
  fetchRecentRpdDecisions,
  searchRpdDecisions,
  computeRpdStats,
} from './immigration/irb.js';
export {
  fetchAmpsStats,
  fetchCbsaCkanMetadata,
  searchCbsaData,
} from './immigration/cbsa.js';
export {
  IMMIGRATION_SOURCES,
  IRCC_DATASETS,
  IRB_DATASETS,
  CBSA_DATASETS,
  IRCC_CSV_FILES,
  IMMIGRATION_SOURCE_NAMES,
  rpdDecisionsUrl,
  ImmigrationFetchError,
  DEFAULT_MAX_RECORDS as IMMIGRATION_DEFAULT_MAX_RECORDS,
} from './immigration/constants.js';
export type {
  PermanentResidentAdmission,
  StudyPermitHolder,
  WorkPermitHolder,
  TemporaryResidentVisa,
  CitizenshipGrant,
  RefugeeDecision,
  CbsaEnforcement,
  CbsaPenalty,
  ImmigrationLobbyingLink,
  ImmigrationIngestionResult,
} from './immigration/types.js';