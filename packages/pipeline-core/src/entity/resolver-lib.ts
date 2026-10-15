/**
 * Quill — Entity Resolution Library (shared)
 *
 * Queries the pipeline database for entity resolution via @maplespike/database.
 *
 * This is the composition surface of the WS-2 cross-reference hub. It lives in
 * pipeline-core (not quill-mcp) because BOTH the MCP server and the REST API
 * server depend on pipeline-core — non-MCP clients get the same entity graph
 * and the same linked_entities composition results.
 *
 * Mirrors the canonical URI helpers in packages/engine/src/entity/types.ts;
 * the engine package is not a runtime dep of every consumer, so the helpers
 * are mirrored here. Keep in sync.
 */

import { getRawDb } from '@maplespike/database';
import type { Database } from '@maplespike/database';
import { aggregateOnlySources } from '../shared/source-policy.js';

/* ------------------------------------------------------------------ */
/*  Canonical Entity URI scheme (WS-2)                                 */
/* ------------------------------------------------------------------ */

export const ENTITY_URI_PREFIX = 'quill://entity/';

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

/* ------------------------------------------------------------------ */
/*  Database connection                                                 */
/* ------------------------------------------------------------------ */

let _sqlite: Database | null = null;

function getSqlite(): Database {
  if (!_sqlite) {
    _sqlite = getRawDb();
  }
  return _sqlite;
}

/** True when the entity graph tables exist in the shared database. */
export function entityGraphAvailable(): boolean {
  try {
    const tables = getSqlite()
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='entities'")
      .get() as { name: string } | undefined;
    return Boolean(tables);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export interface EntityAppearance {
  module: string;
  sourceTable: string;
  role: string;
  date: string;
  summary: string;
  sourceUrl: string;
}

export interface ResolvedEntityResult {
  id: string;
  canonicalName: string;
  type: 'person' | 'organization' | 'unknown';
  confidence: number;
  aliases: string[];
  appearances: EntityAppearance[];
}

export interface ConnectionResult {
  source: {
    id: string;
    canonicalName: string;
    type: string;
  };
  target: {
    id: string;
    canonicalName: string;
    type: string;
  };
  relationshipType: string;
  weight: number;
  sourceModule: string;
}

/** Canonical registry bucket for an appearance module. */
export const MODULE_TO_REGISTRY: Record<string, string> = {
  // Lobbying
  lobbying: 'lobbying',
  'provincial-lobbying': 'lobbying',
  'ontario-lobbying': 'lobbying',
  'quebec-lobbying': 'lobbying',
  // GIC
  gic: 'gic',
  // Committees / parliament
  committees: 'committees',
  'parliamentary-voting': 'committees',
  debates: 'committees',
  // Corporate
  corporate: 'corporate',
  'corporate-filings': 'corporate',
  sedi: 'corporate',
  'sedar-plus': 'corporate',
  'crown-corporations': 'corporate',
  'cra-charity': 'corporate',
  'proactive-disclosure': 'corporate',
  procurement: 'corporate',
  contracts: 'corporate',
  // Legal
  canlii: 'canlii',
  a2aj: 'canlii',
  legislation: 'canlii',
  // Elections
  elections: 'elections',
  // Oversight
  oversight: 'oversight',
  // Municipal / regional
  municipal: 'municipal',
  'municipal-long-tail': 'municipal',
  'regional-authorities': 'municipal',
  // Provincial
  provincial: 'provincial',
  'provincial-ckan': 'provincial',
  'provincial-legislatures': 'provincial',
};

export function registryForModule(moduleName: string): string {
  return MODULE_TO_REGISTRY[moduleName] ?? 'other';
}

/** Per-registry evidence breakdown for the cross-reference surface. */
export interface RegistryBreakdown {
  registry: string;
  count: number;
  modules: string[];
  firstDate: string | null;
  lastDate: string | null;
}

/** Full cross-reference composition result (linked_entities surface). */
export interface CrossReferenceResult {
  entity: ResolvedEntityResult;
  uri: string;
  registries: RegistryBreakdown[];
  totalAppearances: number;
  connections: ConnectionResult[];
  connectionCount: number;
}

/* ------------------------------------------------------------------ */
/*  Entity Resolution                                                   */
/* ------------------------------------------------------------------ */

/**
 * Resolve a name to all known entity mentions.
 */
export function resolveEntity(
  name: string,
  typeHint: string = 'auto',
  threshold: number = 0.7,
): ResolvedEntityResult {
  if (!entityGraphAvailable()) {
    return {
      id: '',
      canonicalName: name,
      type: typeHint === 'auto' ? 'unknown' : typeHint as 'person' | 'organization',
      confidence: 0,
      aliases: [],
      appearances: [],
    };
  }

  const db = getSqlite();
  const normalized = name.toLowerCase().trim();

  // Phase 1: Find exact and fuzzy matching entities
  const entities = findMatchingEntities(db, normalized, typeHint, threshold);

  if (entities.length === 0) {
    // No matches — return a stub so the tool still provides useful feedback
    return {
      id: '',
      canonicalName: name,
      type: typeHint === 'auto' ? 'unknown' : typeHint as 'person' | 'organization',
      confidence: 0,
      aliases: [],
      appearances: [],
    };
  }

  // Pick the best match (highest confidence)
  const best = entities[0];

  // Phase 2: Collect all mentions across modules
  const appearances = findEntityAppearances(db, best.id);

  // Phase 3: Collect aliases
  const aliases = findEntityAliases(db, best.id);

  return {
    id: best.id,
    canonicalName: best.canonical_name,
    type: best.type as 'person' | 'organization',
    confidence: best.confidence,
    aliases: [...new Set([best.canonical_name, ...aliases])],
    appearances: appearances.map((a) => ({
      module: a.module_name,
      sourceTable: a.source_table,
      role: a.role,
      date: a.date || '',
      summary: `${a.module_name}: ${a.role || 'mentioned'}${a.date ? ` (${a.date})` : ''}`,
      sourceUrl: a.source_url || '',
    })),
  };
}

/**
 * Look up an entity directly by its database id.
 * Returns the same ResolvedEntityResult shape as resolveEntity().
 */
export function getEntityById(id: string): ResolvedEntityResult | null {
  if (!entityGraphAvailable()) return null;

  const db = getSqlite();
  const row = db
    .prepare('SELECT id, canonical_name, type, confidence FROM entities WHERE id = ?')
    .get(id) as EntityRow | undefined;
  if (!row) return null;

  const appearances = findEntityAppearances(db, row.id);
  const aliases = findEntityAliases(db, row.id);
  return {
    id: row.id,
    canonicalName: row.canonical_name,
    type: row.type as 'person' | 'organization',
    confidence: row.confidence,
    aliases: [...new Set([row.canonical_name, ...aliases])],
    appearances: appearances.map((a) => ({
      module: a.module_name,
      sourceTable: a.source_table,
      role: a.role,
      date: a.date || '',
      summary: `${a.module_name}: ${a.role || 'mentioned'}${a.date ? ` (${a.date})` : ''}`,
      sourceUrl: a.source_url || '',
    })),
  };
}

/**
 * Find connections between entities (person ↔ org, person ↔ person, etc.).
 */
export function findConnections(
  name: string,
  maxDepth: number = 1,
  threshold: number = 0.7,
): {
  center: ResolvedEntityResult;
  connections: ConnectionResult[];
} {
  const center = resolveEntity(name, 'auto', threshold);
  if (!center.id) {
    return { center, connections: [] };
  }

  const db = getSqlite();

  // Licence policy: aggregate-only sources never link (defense-in-depth for
  // rows written before the policy landed).
  const excludedSources = aggregateOnlySources();
  const linkPolicyFilter = excludedSources.length
    ? ` AND el.source NOT IN (${excludedSources.map(() => '?').join(',')})`
    : '';

  // Find direct connections from entity_links
  const directLinks = db
    .prepare(
      `SELECT
        el.link_type,
        el.weight,
        el.source,
        el.target_entity_id,
        el.source_entity_id,
        e_src.canonical_name AS src_name,
        e_src.type AS src_type,
        e_tgt.canonical_name AS tgt_name,
        e_tgt.type AS tgt_type
      FROM entity_links el
      JOIN entities e_src ON el.source_entity_id = e_src.id
      JOIN entities e_tgt ON el.target_entity_id = e_tgt.id
      WHERE (el.source_entity_id = ? OR el.target_entity_id = ?)${linkPolicyFilter}
      ORDER BY el.weight DESC`,
    )
    .all(center.id, center.id, ...excludedSources) as Array<{
    link_type: string;
    weight: number;
    source: string;
    target_entity_id: string;
    source_entity_id: string;
    src_name: string;
    src_type: string;
    tgt_name: string;
    tgt_type: string;
  }>;

  const connections: ConnectionResult[] = directLinks.map((link) => {
    const isSource = link.source_entity_id === center.id;
    return {
      source: {
        id: link.source_entity_id,
        canonicalName: link.src_name,
        type: link.src_type,
      },
      target: {
        id: link.target_entity_id,
        canonicalName: link.tgt_name,
        type: link.tgt_type,
      },
      relationshipType: link.link_type,
      weight: link.weight,
      sourceModule: link.source,
    };
  });

  return { center, connections };
}

/* ------------------------------------------------------------------ */
/*  Cross-reference composition (linked_entities surface)              */
/* ------------------------------------------------------------------ */

/**
 * Build the per-registry breakdown for a resolved entity.
 * Groups appearances by canonical registry bucket (lobbying, gic,
 * committees, corporate, canlii, elections, oversight, municipal,
 * provincial, other).
 */
export function buildRegistryBreakdown(entity: ResolvedEntityResult): RegistryBreakdown[] {
  const byRegistry = new Map<string, typeof entity.appearances>();
  for (const appearance of entity.appearances) {
    const registry = registryForModule(appearance.module);
    const list = byRegistry.get(registry) ?? [];
    list.push(appearance);
    byRegistry.set(registry, list);
  }

  return Array.from(byRegistry.entries())
    .map(([registry, appearances]) => ({
      registry,
      count: appearances.length,
      modules: Array.from(new Set(appearances.map((a) => a.module))),
      firstDate: appearances.map((a) => a.date).filter(Boolean).sort()[0] ?? null,
      lastDate: appearances.map((a) => a.date).filter(Boolean).sort().slice(-1)[0] ?? null,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Cross-reference an entity (by id or by name) across every registry.
 * This is the shared composition surface behind the linked_entities MCP
 * tool AND the REST endpoints GET /v1/entities/{id} and
 * GET /v1/entities/{id}/links — non-MCP clients get identical results.
 */
export function crossReferenceEntity(input: {
  id?: string;
  name?: string;
  type?: string;
  threshold?: number;
}): CrossReferenceResult | null {
  const threshold = input.threshold ?? 0.7;
  const entity = input.id
    ? getEntityById(fromEntityUri(input.id))
    : input.name
      ? resolveEntity(input.name, input.type ?? 'auto', threshold)
      : null;

  if (!entity || !entity.id) return null;

  const registries = buildRegistryBreakdown(entity);
  const { connections } = findConnections(entity.canonicalName, 1, threshold);

  return {
    entity,
    uri: toEntityUri(entity.id),
    registries,
    totalAppearances: entity.appearances.length,
    connections,
    connectionCount: connections.length,
  };
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                    */
/* ------------------------------------------------------------------ */

interface EntityRow {
  id: string;
  canonical_name: string;  // DB column name
  type: string;
  confidence: number;
}

function findMatchingEntities(
  db: Database,
  normalizedName: string,
  typeHint: string,
  threshold: number,
): EntityRow[] {
  // 1. Exact match on canonical name
  const exact = db
    .prepare(
      `SELECT id, canonical_name, type, confidence FROM entities
       WHERE LOWER(canonical_name) = ?
       ${typeHint !== 'auto' ? 'AND type = ?' : ''}
       ORDER BY confidence DESC LIMIT 5`,
    )
    .all(...(typeHint !== 'auto' ? [normalizedName, typeHint] : [normalizedName])) as EntityRow[];
  if (exact.length > 0) return exact;

  // 2. Alias match
  const aliasMatch = db
    .prepare(
      `SELECT e.id, e.canonical_name, e.type, e.confidence
       FROM entities e
       JOIN entity_aliases ea ON ea.entity_id = e.id
       WHERE LOWER(ea.alias) = ?
       ${typeHint !== 'auto' ? 'AND e.type = ?' : ''}
       ORDER BY e.confidence DESC LIMIT 5`,
    )
    .all(...(typeHint !== 'auto' ? [normalizedName, typeHint] : [normalizedName])) as EntityRow[];
  if (aliasMatch.length > 0) return aliasMatch;

  // 3. Fuzzy match via LIKE
  const likePattern = `%${normalizedName}%`;
  const fuzzy = db
    .prepare(
      `SELECT id, canonical_name, type, confidence FROM entities
       WHERE LOWER(canonical_name) LIKE ?
       ${typeHint !== 'auto' ? 'AND type = ?' : ''}
       ORDER BY confidence DESC LIMIT 10`,
    )
    .all(...(typeHint !== 'auto' ? [likePattern, typeHint] : [likePattern])) as EntityRow[];

  if (fuzzy.length > 0) return fuzzy;

  // 4. Fuzzy match via aliases
  const aliasFuzzy = db
    .prepare(
      `SELECT e.id, e.canonical_name, e.type, e.confidence
       FROM entities e
       JOIN entity_aliases ea ON ea.entity_id = e.id
       WHERE LOWER(ea.alias) LIKE ?
       ${typeHint !== 'auto' ? 'AND e.type = ?' : ''}
       ORDER BY e.confidence DESC LIMIT 10`,
    )
    .all(...(typeHint !== 'auto' ? [likePattern, typeHint] : [likePattern])) as EntityRow[];

  return aliasFuzzy;
}

interface AppearanceRow {
  module_name: string;
  source_table: string;
  role: string;
  date: string;
  source_url: string;
}

function findEntityAppearances(
  db: Database,
  entityId: string,
): AppearanceRow[] {
  // entity_mentions table tracks where each entity appears
  // If table doesn't exist, fall back to entity_links for module references
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='entity_mentions'")
    .get() as { name: string } | undefined;

  if (tables) {
    // Licence policy: aggregate-only sources (Statistics Canada) are never
    // composed into entity appearances — their data must not be linked to
    // identify individuals or businesses. Rows written before the policy
    // landed are filtered here too.
    const excluded = aggregateOnlySources();
    const notIn = excluded.length ? ` AND em.module_name NOT IN (${excluded.map(() => '?').join(',')})` : '';
    return db
      .prepare(
        `SELECT
          COALESCE(em.module_name, 'unknown') AS module_name,
          COALESCE(em.source_table, '') AS source_table,
          COALESCE(em.role, '') AS role,
          COALESCE(em.date, '') AS date,
          COALESCE(em.source_url, '') AS source_url
         FROM entity_mentions em
         WHERE em.entity_id = ?${notIn}
         ORDER BY em.date DESC`,
      )
      .all(entityId, ...excluded) as AppearanceRow[];
  }

  // Fallback: infer appearances from entity_links (aggregate-only sources
  // excluded — same policy as the mentions path).
  const excludedLinks = aggregateOnlySources();
  const linkNotIn = excludedLinks.length
    ? ` AND el.source NOT IN (${excludedLinks.map(() => '?').join(',')})`
    : '';
  return db
    .prepare(
      `SELECT DISTINCT
        COALESCE(el.source, 'unknown') AS module_name,
        '' AS source_table,
        el.link_type AS role,
        COALESCE(el.created_at, '') AS date,
        '' AS source_url
       FROM entity_links el
       WHERE (el.source_entity_id = ? OR el.target_entity_id = ?)${linkNotIn}
       ORDER BY el.created_at DESC`,
    )
    .all(entityId, entityId, ...excludedLinks) as AppearanceRow[];
}

function findEntityAliases(db: Database, entityId: string): string[] {
  try {
    const rows = db
      .prepare(
        `SELECT alias FROM entity_aliases WHERE entity_id = ? ORDER BY created_at DESC`,
      )
      .all(entityId) as { alias: string }[];
    return rows.map((r) => r.alias);
  } catch {
    return [];
  }
}
