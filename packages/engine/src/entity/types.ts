/**
 * Entity Resolution Types
 *
 * Types for the entity resolution engine that handles fuzzy matching,
 * canonical name resolution, and alias management.
 */

/** Confidence level of a resolution */
export type ConfidenceLevel = "exact" | "high" | "medium" | "low" | "none";

/** A single resolution result comparing two names */
export interface ResolutionResult {
  /** The first name compared */
  name1: string;
  /** The second name compared */
  name2: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Categorized confidence level */
  level: ConfidenceLevel;
  /** Whether these names are considered the same entity */
  isMatch: boolean;
  /** Explanation of how the match was determined */
  method: string;
}

/** An alias entry mapping a variant name to a canonical form */
export interface AliasEntry {
  /** The canonical (authoritative) name */
  canonical: string;
  /** A known variant/alias */
  alias: string;
  /** Whether this alias is for a person or organization */
  type: "person" | "org";
  /** Source that established this alias (e.g. "pre-seeded", "resolution") */
  source: string;
  /** When this alias was recorded */
  createdAt: string;
}

/** Map of canonical entity names to all their known aliases */
export interface ResolutionMap {
  /** Canonical entity ID → list of names that refer to it */
  entities: Map<string, ResolvedEntity>;
}

/** A resolved entity with its canonical form and all aliases */
export interface ResolvedEntity {
  /** Unique identifier for this entity */
  id: string;
  /** The canonical (authoritative) name */
  canonicalName: string;
  /** All names known to refer to this entity */
  aliases: string[];
  /** Whether this is a person or organization */
  type: "person" | "org";
  /** Confidence in the resolution (lowest confidence among merged names) */
  confidence: number;
}
