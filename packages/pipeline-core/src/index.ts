// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * @maplespike/pipeline-core — MapleSpike Data Pipeline
 *
 * Canadian sovereign data pipeline core.
 * Single entry point for all extraction modules.
 */

export * from './ingestion/index.js';
export * from './curation/index.js';
// Shared entity graph access + cross-reference composition surface — consumed by
// BOTH the MCP server (resolve_entity / linked_entities) and the REST API
// (GET /v1/entities/{id}, GET /v1/entities/{id}/links). Re-exported explicitly
// (not via ./entity/index.js) to avoid the EntityResolutionService name clash
// with the ingestion barrel's own entity-resolution-service.
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
} from './entity/resolver-lib.js';
export type {
  EntityAppearance,
  ResolvedEntityResult,
  ConnectionResult,
  RegistryBreakdown,
  CrossReferenceResult,
} from './entity/resolver-lib.js';
export * from './verification/index.js';
export * from './claims/index-barrel.js';
export * from './audit/index.js';
export * from './legal-compliance.js';
export * from './validation/index.js';
export * from './health-monitoring/index.js';
export * from './test-framework/index.js';
export * from './doc-generator/index.js';
export * from './quality/index.js';
export * from './shared/attribution.js';
export * from './shared/source-policy.js';
export { sanitizeOutput, scanPII } from './utils/privacy-filter.js';
