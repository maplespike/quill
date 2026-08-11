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
