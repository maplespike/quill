/**
 * Entity Resolution Pipeline — barrel export
 *
 * Combines entity_mentions and entity_relationships management
 * with entity extraction from module data.
 */

export { extractEntities } from './extractor.js';
export { ingestEntityMentions } from './ingestion.js';
export type { ExtractionRule, EntityExtractionConfig, ExtractedMention } from './extractor.js';
export type { IngestionResult } from './ingestion.js';
export { EntityResolutionService } from './service.js';
export type { EntityMatch, EntityRelationship, EntityGraph, ResolutionOptions, ServiceConfig } from './service.js';

// Entity graph population (GAP-1) — wired into runModule next to the claims
// hook so live ingestion materializes the cross-reference graph.
export {
  ENTITY_GRAPH_DDL,
  ensureEntityGraph,
  entityIdFor,
  entityIdHash,
  MAX_ENTITIES_PER_RUN,
  buildEntityGraphFromRecords,
  registerModuleResultEntities,
  backfillCommitteeEntityGraph,
  backfillLobbyingEntityGraph,
  backfillGicEntityGraph,
  buildEntityGraph,
} from './graph-builder.js';
export type { GraphBuildResult } from './graph-builder.js';

// Shared entity graph access + cross-reference composition surface.
// Consumed by BOTH the MCP server (resolve_entity / linked_entities) and
// the REST API (GET /v1/entities/{id}, GET /v1/entities/{id}/links).
export {
  ENTITY_URI_PREFIX,
  toEntityUri,
  fromEntityUri,
  isEntityUri,
  entityGraphAvailable,
  resolveEntity,
  getEntityById,
  findConnections,
  buildRegistryBreakdown,
  crossReferenceEntity,
  registryForModule,
  MODULE_TO_REGISTRY,
} from './resolver-lib.js';
export type {
  EntityAppearance,
  ResolvedEntityResult,
  ConnectionResult,
  RegistryBreakdown,
  CrossReferenceResult,
} from './resolver-lib.js';

// Bilingual institutional names (issue #743) — public-role names only.
export {
  BILINGUAL_ENTITY_NAMES,
  normalizeEntityName,
  coreEntityName,
  resolveBilingualEntity,
  bilingualEntityCandidates,
  isBilingualEntityPair,
  localizeEntityName,
  resetBilingualEntityIndex,
} from './bilingual.js';
export type { BilingualEntityName, BilingualEntityMatch, EntityLang } from './bilingual.js';
