/**
 * Entity Resolution Library for MCP Tools
 *
 * Queries the pipeline database for entity resolution via @maplespike/database.
 */

import { getRawDb } from '@maplespike/database';
import type { Database } from '@maplespike/database';

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
      WHERE el.source_entity_id = ? OR el.target_entity_id = ?
      ORDER BY el.weight DESC`,
    )
    .all(center.id, center.id) as Array<{
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
    return db
      .prepare(
        `SELECT
          COALESCE(em.module_name, 'unknown') AS module_name,
          COALESCE(em.source_table, '') AS source_table,
          COALESCE(em.role, '') AS role,
          COALESCE(em.date, '') AS date,
          COALESCE(em.source_url, '') AS source_url
         FROM entity_mentions em
         WHERE em.entity_id = ?
         ORDER BY em.date DESC`,
      )
      .all(entityId) as AppearanceRow[];
  }

  // Fallback: infer appearances from entity_links
  return db
    .prepare(
      `SELECT DISTINCT
        COALESCE(el.source, 'unknown') AS module_name,
        '' AS source_table,
        el.link_type AS role,
        COALESCE(el.created_at, '') AS date,
        '' AS source_url
       FROM entity_links el
       WHERE el.source_entity_id = ? OR el.target_entity_id = ?
       ORDER BY el.created_at DESC`,
    )
    .all(entityId, entityId) as AppearanceRow[];
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
