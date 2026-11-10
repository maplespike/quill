// SPDX-License-Identifier: AGPL-3.0-only
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

/* ------------------------------------------------------------------ */
/*  Canonical Entity URI scheme (WS-2)                                 */
/* ------------------------------------------------------------------ */

/**
 * Stable, addressable identifier for every resolved entity.
 *
 * Format: `quill://entity/{id}` where `{id}` is the raw entity id
 * (e.g. the `entities.id` column). The scheme is the composition contract
 * for other MCP servers and agent stacks: any tool or resource that names
 * an entity MUST expose this URI so clients can link registries against it
 * without re-implementing resolution.
 *
 * Resource template: `quill://entities/{name}` resolves a name to a URI;
 * `quill://crossref/{entityId}` returns the relationship subgraph.
 */
export const ENTITY_URI_PREFIX = "quill://entity/";

/** Canonical registry buckets used by cross-reference grouping. */
export const ENTITY_REGISTRIES = [
  "lobbying",
  "gic",
  "committees",
  "corporate",
  "canlii",
  "elections",
  "oversight",
  "proactive-disclosure",
  "municipal",
  "provincial",
  "other",
] as const;

export type EntityRegistry = (typeof ENTITY_REGISTRIES)[number];

/** Build the canonical URI for an entity id. */
export function toEntityUri(id: string): string {
  return `${ENTITY_URI_PREFIX}${encodeURIComponent(id)}`;
}

/** Extract the raw entity id from a `quill://entity/{id}` URI (or return input unchanged if not a URI). */
export function fromEntityUri(uri: string): string {
  if (uri.startsWith(ENTITY_URI_PREFIX)) {
    try {
      return decodeURIComponent(uri.slice(ENTITY_URI_PREFIX.length));
    } catch {
      return uri.slice(ENTITY_URI_PREFIX.length);
    }
  }
  return uri;
}

/** True when the string is a canonical `quill://entity/...` URI. */
export function isEntityUri(value: string): boolean {
  return value.startsWith(ENTITY_URI_PREFIX);
}
