// SPDX-License-Identifier: AGPL-3.0-only
/**
 * @maplespike/pipeline-core — Ingestion Module Exports
 *
 * **New code should use the registry API** (getModule, runModule, etc.)
 * for discoverable access to all 61 ingestion modules.
 *
 * **Backward-compat** individual exports are maintained for the specific
 * functions consumed by api-server, quill-mcp, and sdk.
 */

// ── Module Registry (the new public API) ─────────────────────────
export {
  getModule,
  getModulesByCategory,
  getAllModules,
  getCategories,
  runModule,
  runAllModules,
} from './registry.js';

export type {
  ModuleInfo,
  ModuleCategory,
} from './registry.js';

// ── Ingest Run Log (CronJob liveness) ───────────────────────────────
// Cross-process evidence that an ingest CronJob ran: written by the CLI in
// the job pod, read by the API pod, both over the shared QUILL_DB_PATH file.
export {
  recordIngestRun,
  getIngestRuns,
  getLatestIngestRuns,
  getLatestSuccessfulIngestRuns,
  cronPeriodSeconds,
  maxAgeSecondsFor,
  INGEST_RUNS_DDL,
  DEFAULT_MAX_AGE_SECONDS,
  STALE_GRACE_MULTIPLIER,
} from './run-log.js';
export type {
  IngestRunRecord,
  IngestRunStatus,
  RecordIngestRunInput,
  SourceOutcome,
  SourceOutcomeStatus,
  RunSources,
} from './run-log.js';

// ── Entity Resolution ───────────────────────────────────────────────
export {
  EntityResolutionService,
} from './entity-resolution-service.js';
export type {
  ServiceMatchResult,
  EntityResolutionServiceConfig,
} from './entity-resolution-service.js';

// ── Watcher / Webhooks ──────────────────────────────────────────────
export {
  InMemoryWatcherStore,
  SqliteWatcherStore,
  setWatcherStore,
  getWatcherStore,
  checkSource,
  checkAllSources,
  getChangeLog,
  getWatcherStatus,
  getWatchedSources,
} from './watcher.js';
export type {
  WatchedSource,
  ChangeEvent,
  WatcherStore,
  ReIngestCallback,
} from './watcher.js';

export {
  InMemoryWebhookStore,
  SqliteWebhookStore,
  setWebhookStore,
  getWebhookStore,
  notifyWebhooks,
  createWebhook,
  deleteWebhook,
  listWebhooks,
  getWebhook,
  dispatchToWebhook,
} from './webhooks.js';
export type {
  WebhookConfig,
  WebhookDelivery,
  WebhookStore,
  DispatchResult,
} from './webhooks.js';

// ── Core Utilities (consumed by api-server, quill-mcp, sdk) ─────
export {
  parseRSS,
  hashString,
  fetchFeed,
  deduplicateItems,
  RSS_SOURCES,
} from './rss.js';
export type {
  RSSItem,
  RSSFeed,
  RSSSource,
  RawArticle,
} from './rss.js';

export {
  fetchStatCanReleases,
  fetchCKANPackages,
  fetchOpenDataPortal,
  getGovDataSourceClient,
  GOV_DATA_SOURCES,
} from './gov-api.js';
export type {
  GovRelease,
  CKANPackage,
  StatCanRelease,
  OpenDataPortalDataset,
  OpenDataPortalConfig,
} from './gov-api.js';

// ── Provincial CKAN ──────────────────────────────────────────────
export {
  PROVINCIAL_CKAN_SOURCES,
  fetchProvincialCkan,
  fetchAllProvincialCkan,
} from './provincial-ckan.js';
export type { ProvincialCkanSource } from './provincial-ckan.js';

// ── Attestation / Provenance ─────────────────────────────────────
export {
  buildCitation,
  buildMerkleRoot,
  generateMerkleProof,
  signCitation,
  verifyCitationSignature,
  generateAttestationKey,
  ContentAddressableStore,
  getUpdateFrequency,
  UPDATE_FREQUENCIES,
} from './attestation/index.js';
export type { Citation } from './attestation/index.js';

// ── CRTC Ingestion ────────────────────────────────────────────────
export {
  ingestCrtc,
  searchDecisions,
  getRecentDecisions,
  getOwnershipChangeDecisions,
  getDecisionsByApplicant,
  getNetNeutralityDecisions,
  searchOwnershipRecords,
  getOwnershipByOwner,
  CRTC_DECISIONS_DDL,
  CRTC_OWNERSHIP_DDL,
  CRTC_DDL,
  initializeCrtcTables,
  crtcTablesExist,
} from './crtc/index.js';
export type {
  CrtcDecision,
  CrtcDecisionType,
  CrtcOwnershipRecord,
  CrtcIngestionResult,
  RawCrtcDecisionItem,
  RawCrtcOwnershipItem,
} from './crtc/types.js';

// ── Immigration ──────────────────────────────────────────────────
export {
  ingestPermanentResidents,
  ingestTempResidents,
  ingestRpdDecisions,
  ingestCbsaEnforcement,
  ingestAllImmigration,
  generateImmigrationLobbyingLinks,
} from './immigration/index.js';
export type {
  PermanentResidentAdmission,
  StudyPermitHolder,
  WorkPermitHolder,
  RefugeeDecision,
  CbsaEnforcement,
  ImmigrationIngestionResult,
} from './immigration/types.js';

// ── Transport Infrastructure ────────────────────────────────────
export {
  ingestTsbOccurrences,
  ingestTcSafety,
  ingestCtaRulings,
  ingestInfrastructureProjects,
  ingestAllTransport,
  fetchTsbOccurrences,
  fetchTcVehicleRecalls,
  fetchTcViolationsAudits,
  fetchCiibProjects,
  fetchCtaRulings,
  fetchCtaDecisions,
  fetchInfrastructureProjects,
  fetchNationalTradeCorridors,
  fetchCanadaInfrastructureBank,
} from './transport-infrastructure/index.js';
export type {
  TsbOccurrence,
  TcRecall,
  TcViolationAudit,
  CiibProject,
  CtaRuling,
  InfrastructureFunding,
  TransportInfrastructureIngestionResult,
} from './transport-infrastructure/types.js';

// ── GC Standards ─────────────────────────────────────────────────
export {
  GC_DEPARTMENTS,
  GC_DEPARTMENT_CODES,
  normalizeDepartment,
  A2AJ_DATASET_CODES,
  CANLII_COURT_IDS,
} from './gc-standards/index.js';

// ── Backward-compat: consumed by quill-mcp ──────────────────────
export {
  searchScience,
} from './science-research/index.js';
export type { ScienceIngestionResult } from './science-research/types.js';

export {
  ingestAllNgoRss,
  searchNgoRss,
  NGO_RSS_SOURCES,
} from './ngo-influence-rss/index.js';
export type { NgoRssItem, NgoRssIngestionResult } from './ngo-influence-rss/types.js';

// ── OECD ────────────────────────────────────────────────────────
export {
  ingestOecdDataset,
  ingestByTopic,
  ingestAllOecd,
  searchOecdRecords,
} from './oecd/index.js';
export type {
  OecdRecord,
  OecdIngestionResult,
  OecdDataset,
  OecdTopic,
} from './oecd/types.js';

// ── Provincial Pipeline Modules (ON, BC, AB, QC) ──────────────

// Health
export {
  ON_HEALTH_DDL, OntarioHealthError,
  fetchOntarioHealthRecords, fetchAllOntarioHealthRecords,
  parseOntarioHealthRecord, parseOntarioHealthBatch, normalizeOntarioHealthRecordType,
} from './on-health/index.js';

export {
  BC_HEALTH_DDL, BCHealthError,
  fetchPharmaCareClaims, fetchBCCDCPublications, fetchAllBCHealthData,
  parsePharmaCareRecord, parsePharmaCareBatch, parseBCCDCRecord, parseBCCDCBatch,
} from './bc-health/index.js';

export {
  AB_HEALTH_DDL, ABHealthError,
  fetchAHSData, fetchAllAHSData, fetchABHealthPublications,
  parseAHSRecord, parseAHSBatch, parseABHealthPublication, parseABHealthPublicationBatch,
} from './ab-health/index.js';

export {
  QC_HEALTH_DDL, QCHealthError,
  fetchQCHealthRecords, fetchAllQCHealthRecords,
  parseRAMQRecord, parseRAMQBatch, parseQCHealthRecord, parseQCHealthBatch,
} from './qc-health/index.js';

// Education
export {
  ONEDUCATION_DDL, OnEducationError,
  fetchOnEducationRecords, parseOnEducationRecord, parseOnEducationBatch,
  ingestOnEducationData, searchOnEducationRecords, initializeOnEducationTable,
} from './on-education/index.js';

export {
  BCEDUCATION_DDL, BcEducationError,
  fetchBcEducationRecords, parseBcEducationRecord, parseBcEducationBatch,
  ingestBcEducationData, searchBcEducationRecords, initializeBcEducationTable,
} from './bc-education/index.js';

export {
  ABEDUCATION_DDL, AbEducationError,
  fetchAbEducationRecords, parseAbEducationRecord, parseAbEducationBatch,
  ingestAbEducationData, searchAbEducationRecords, initializeAbEducationTable,
} from './ab-education/index.js';

export {
  QCEDUCATION_DDL, QcEducationError,
  fetchQcEducationRecords, parseQcEducationRecord, parseQcEducationBatch,
  ingestQcEducationData, searchQcEducationRecords, initializeQcEducationTable,
} from './qc-education/index.js';

// Infrastructure
export {
  OnInfrastructure_DDL, OnInfrastructureError,
  fetchOnInfrastructureRecords, parseOnInfrastructureRecord, parseOnInfrastructureBatch,
  ingestOnInfrastructureData, searchOnInfrastructureRecords, initializeOnInfrastructureTable,
} from './on-infrastructure/index.js';

export {
  BcInfrastructure_DDL, BcInfrastructureError,
  fetchBcInfrastructureRecords, parseBcInfrastructureRecord, parseBcInfrastructureBatch,
  ingestBcInfrastructureData, searchBcInfrastructureRecords, initializeBcInfrastructureTable,
} from './bc-infrastructure/index.js';

export {
  AbInfrastructure_DDL, AbInfrastructureError,
  fetchAbInfrastructureRecords, parseAbInfrastructureRecord, parseAbInfrastructureBatch,
  ingestAbInfrastructureData, searchAbInfrastructureRecords, initializeAbInfrastructureTable,
} from './ab-infrastructure/index.js';

export {
  QcInfrastructure_DDL, QcInfrastructureError,
  fetchQcInfrastructureRecords, parseQcInfrastructureRecord, parseQcInfrastructureBatch,
  ingestQcInfrastructureData, searchQcInfrastructureRecords, initializeQcInfrastructureTable,
} from './qc-infrastructure/index.js';

// Economic
export {
  OnEconomic_DDL, OnEconomicError,
  fetchOnEconomicRecords, parseOnEconomicRecord, parseOnEconomicBatch,
  ingestOnEconomicData, searchOnEconomicRecords, initializeOnEconomicTable,
} from './on-economic/index.js';

export {
  BcEconomic_DDL, BcEconomicError,
  fetchBcEconomicRecords, parseBcEconomicRecord, parseBcEconomicBatch,
  ingestBcEconomicData, searchBcEconomicRecords, initializeBcEconomicTable,
} from './bc-economic/index.js';

export {
  AbEconomic_DDL, AbEconomicError,
  fetchAbEconomicRecords, parseAbEconomicRecord, parseAbEconomicBatch,
  ingestAbEconomicData, searchAbEconomicRecords, initializeAbEconomicTable,
} from './ab-economic/index.js';

export {
  QcEconomic_DDL, QcEconomicError,
  fetchQcEconomicRecords, parseQcEconomicRecord, parseQcEconomicBatch,
  ingestQcEconomicData, searchQcEconomicRecords, initializeQcEconomicTable,
} from './qc-economic/index.js';

// ── Municipal ────────────────────────────────────────────────────
export {
  ingestMunicipalDataset,
  ingestAllMunicipal,
  searchMunicipal,
  detectPortalType,
} from './municipal/index.js';
export type {
  MunicipalRecord,
  MunicipalSearchParams,
  MunicipalIngestionResult,
} from './municipal/types.js';

// ── Corporate / Securities ─────────────────────────────────────────
export {
  searchFilings,
  searchFilingsByIssuer,
  fetchRecentFilings,
  fetchAifFilings,
  fetchIssuer,
  ingestSedarByIssuer,
  ingestSedarRecent,
  ingestAllSedar,
  findIssuerByTicker,
  findIssuerByName,
} from './sedar-plus/index.js';
export type {
  SedarFiling,
  SedarSearchParams,
  SedarSearchResult,
  SedarIngestionResult,
  SedarIssuer,
} from './sedar-plus/types.js';



