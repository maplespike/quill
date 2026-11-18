// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Entity Resolution Engine — barrel export
 */

export { AliasManager } from "./aliases";
export { DisambiguationEngine } from "./disambiguation";
export { CrossModuleLinker, LINKING_RULES } from "./linker";
export { EntityResolver } from "./resolver";
export {
  ENTITY_URI_PREFIX,
  ENTITY_REGISTRIES,
  toEntityUri,
  fromEntityUri,
  isEntityUri,
} from "./types";
export type {
  AliasEntry,
  ConfidenceLevel,
  ResolutionMap,
  ResolutionResult,
  ResolvedEntity,
} from "./types";
export type {
  DisambiguationContext,
  DisambiguationResult,
} from "./disambiguation";
export type {
  LinkCandidate,
  LinkResult,
  LinkingRule,
} from "./linker";
