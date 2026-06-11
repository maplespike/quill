/**
 * Entity Resolution Engine — barrel export
 */

export { AliasManager } from "./aliases";
export { DisambiguationEngine } from "./disambiguation";
export { CrossModuleLinker, LINKING_RULES } from "./linker";
export { EntityResolver } from "./resolver";
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
