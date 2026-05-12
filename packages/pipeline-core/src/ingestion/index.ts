export { parseRSS, hashString, fetchFeed, deduplicateItems, RSS_SOURCES } from './rss.js';
export { fetchStatCanReleases, fetchCKANPackages, fetchOpenDataPortal, getGovDataSourceClient, GOV_DATA_SOURCES } from './gov-api.js';
export type { RSSItem, RSSFeed, RSSSource, RawArticle } from './rss.js';
export type { GovRelease, CKANPackage, StatCanRelease, OpenDataPortalDataset, OpenDataPortalConfig } from './gov-api.js';

// Committee evidence ingestion
export {
  ingestCommittee,
  ingestAllCommittees,
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
  evidenceUrl,
  evidenceHtmlUrl,
} from './committees/constants.js';
export type {
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
export type {
  InfluenceActor,
  InfluenceActorCategory,
  InfluenceConnection,
  ConnectionType,
  GovernmentFunding,
  CraCharityRecord,
  InfluenceIngestionResult,
} from './influence/types.js';
