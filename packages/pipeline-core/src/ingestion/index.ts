/**
 * @maplespike/pipeline-core — Ingestion Module Exports
 *
 * **New code should use the registry API** (getModule, runModule, etc.)
 * for discoverable access to all 61 ingestion modules.
 *
 * **Backward-compat** individual exports are maintained for the specific
 * functions consumed by api-server, mcp-server, and sdk.
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

// ── Core Utilities (consumed by api-server, mcp-server, sdk) ─────
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

// ── Backward-compat: consumed by mcp-server ──────────────────────
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

// ── CRTC — Broadcasting, telecom, media ownership ─────────────────
export {
  ingestCrtc,
  searchDecisions,
  getOwnershipChangeDecisions,
  getNetNeutralityDecisions,
} from './crtc/index.js';
export type { CrtcDecision, CrtcOwnershipRecord, CrtcIngestionResult } from './crtc/types.js';

