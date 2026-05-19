/**
 * Entity Resolution Engine — barrel export
 */

export { AliasManager } from "./aliases";
export { EntityResolver } from "./resolver";
export { runEntityResolution } from "./migration/resolve";
export type { EntityResolutionStats } from "./migration/resolve";
export type {
  AliasEntry,
  ConfidenceLevel,
  ResolutionMap,
  ResolutionResult,
  ResolvedEntity,
} from "./types";
