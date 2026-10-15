// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Entity Graph Builder (GAP-1)
 *
 * Populates the four entity-graph tables — `entities`, `entity_aliases`,
 * `entity_mentions`, `entity_links` — that the cross-reference composition
 * surface (resolver-lib.ts) reads. Wired into `runModule` right next to the
 * claims hook, so every live ingestion also materializes the graph.
 *
 * Two paths feed the graph:
 *
 *   1. Generic — `registerModuleResultEntities` extracts mentions from the
 *      records a module returns (arrays, `.records`/`.results`/`.items`,
 *      dict-shaped results, or a single record). Same result-shape handling
 *      as the claims hook, so it works for any module without per-module
 *      code.
 *
 *   2. Backfill — `backfillCommitteeEntityGraph` reads the persisted
 *      committee tables (speakers, interventions, meetings) that db-first
 *      modules write through the SQLite D1 adapter, and materializes them
 *      into the graph. This is what turns the already-present committee
 *      data (hundreds of speakers, thousands of interventions) into
 *      cross-reference evidence.
 *
 * Like the claims hook, the graph hook is failure-safe by design: a graph
 * build error logs a warning and never breaks ingestion.
 */

import crypto from 'node:crypto';
import { getRawDb } from '@maplespike/database';
import type { Database } from '@maplespike/database';
import { extractEntities } from './extractor.js';
import { getExtractionConfig } from './ingestion.js';
import { normalizeName } from './normalize.js';
import { restrictsPersonProfiles } from '../shared/source-policy.js';

/* ------------------------------------------------------------------ */
/*  Schema — matches the live table definitions exactly                */
/* ------------------------------------------------------------------ */

export const ENTITY_GRAPH_DDL = `
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  type TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.7
);

CREATE TABLE IF NOT EXISTS entity_aliases (
  entity_id TEXT NOT NULL,
  alias TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS entity_mentions (
  entity_id TEXT NOT NULL,
  module_name TEXT NOT NULL,
  source_table TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS entity_links (
  source_entity_id TEXT NOT NULL,
  target_entity_id TEXT NOT NULL,
  link_type TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0,
  source TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_aliases_unique ON entity_aliases(entity_id, alias);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_mentions_unique
  ON entity_mentions(entity_id, module_name, source_table, role, date, source_url);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_links_unique
  ON entity_links(source_entity_id, target_entity_id, link_type, source);
`;

let _ensured = false;

/** Ensure the entity graph tables exist (idempotent; no-op on live DBs). */
export function ensureEntityGraph(): void {
  if (_ensured) return;
  try {
    getRawDb().exec(ENTITY_GRAPH_DDL);
    _ensured = true;
  } catch (err) {
    console.warn(
      `[graph] ensureEntityGraph failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Stable deterministic entity id — same normalized name + type → same row. */
export function entityIdFor(normalized: string, type: string): string {
  return `ent_${entityIdHash(normalized, type)}`;
}

/** Hex digest used inside entity ids (also exported for tests). */
export function entityIdHash(normalized: string, type: string): string {
  return crypto.createHash('sha256').update(`${normalized}:${type}`).digest('hex').substring(0, 16);
}

/** Cap on entities/mensions written per module run (mirrors QUILL_CLAIMS_MAX). */
export const MAX_ENTITIES_PER_RUN = Math.max(
  100,
  parseInt(process.env.QUILL_GRAPH_MAX ?? '2000', 10) || 2000,
);

/* ------------------------------------------------------------------ */
/*  Generic extraction from module records                             */
/* ------------------------------------------------------------------ */

export interface GraphBuildResult {
  entities: number;
  mentions: number;
  links: number;
  recordsProcessed: number;
  errors: string[];
}

/** Normalize a free-form field into a readable role label (e.g. witness_name → Witness). */
function roleForField(field: string): string {
  return field
    .replace(/_name$/i, '')
    .replace(/_organization$/i, '')
    .replace(/_person$/i, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Derive a relationship label between two entity types (mirrors service.ts mapping). */
function linkTypeFor(sourceType: string, targetType: string): string {
  const pairs: Record<string, string> = {
    'person-organization': 'affiliation',
    'organization-person': 'employs',
    'person-person': 'co-mentioned',
    'organization-organization': 'collaborates',
    'person-location': 'based-in',
    'location-person': 'location-of',
    'organization-location': 'located-in',
    'location-organization': 'headquartered',
  };
  return pairs[`${sourceType}-${targetType}`] ?? 'co-occurs-with';
}

/**
 * Build the entity graph from a list of module records.
 * Failure-safe: a bad record logs an error and is skipped, never thrown.
 */
export function buildEntityGraphFromRecords(
  moduleName: string,
  records: unknown[],
  sourceUrl = '',
): GraphBuildResult {
  const result: GraphBuildResult = { entities: 0, mentions: 0, links: 0, recordsProcessed: 0, errors: [] };
  if (!Array.isArray(records) || records.length === 0) return result;

  const objects = records.filter(
    (r): r is Record<string, unknown> => r !== null && typeof r === 'object',
  );
  if (objects.length === 0) return result;

  const sampled = objects.slice(0, MAX_ENTITIES_PER_RUN);
  // Licence policy: personal-information sources never materialize person-level
  // entities (no cross-source profiles of individuals). Organization mentions
  // still land.
  const restrictPersons = restrictsPersonProfiles(moduleName);
  if (sampled.length < objects.length) {
    console.warn(
      `[graph] ${moduleName}: truncating entity extraction to ${sampled.length} of ${objects.length} records (QUILL_GRAPH_MAX=${MAX_ENTITIES_PER_RUN})`,
    );
  }

  try {
    ensureEntityGraph();
    const db = getRawDb();
    const tx = db.transaction(() => {
      for (const record of sampled) {
        try {
          const recordId = String(record.id ?? record.record_id ?? record.slug ?? '');
          const config = getExtractionConfig(moduleName, recordId, record);
          const mentions = extractEntities(config);
          if (mentions.length === 0) continue;

          // Thread the source rule field into each mention so roles are
          // semantic (witness_name → Witness, client_name → Client) rather
          // than the bare entity type. extractEntities emits one mention per
          // rule that produced a value, in rule order, so we can zip.
          const producedFields: string[] = [];
          for (const rule of config.extractionRules) {
            const value = config.data[rule.field];
            if (value && typeof value === 'string' && value.trim()) {
              producedFields.push(rule.field);
            }
          }

          const recordDate =
            (record.date as string) ||
            (record.year as string) ||
            (record.published_at as string) ||
            '';
          const recordUrl =
            (record.url as string) ||
            (record.source_url as string) ||
            (record.sourceUrl as string) ||
            sourceUrl;

          // Filter person mentions as pairs (not indexes) so the rule-field
          // zip stays aligned when persons are dropped.
          const mentionPairs = mentions.map((mention, k) => ({
            mention,
            field: producedFields[k] ?? mention.entityType,
          }));
          const keptPairs = restrictPersons
            ? mentionPairs.filter((pair) => pair.mention.entityType !== 'person')
            : mentionPairs;
          if (keptPairs.length === 0) continue;

          for (const { mention, field } of keptPairs) {
            const entityId = entityIdFor(mention.entityNormalized, mention.entityType);
            upsertEntity(db, entityId, mention.entityName.trim(), mention.entityType, mention.confidenceScore);
            upsertAlias(db, entityId, mention.entityNormalized);
            upsertMention(db, {
              entityId,
              moduleName,
              sourceTable: moduleName,
              role: roleForField(field),
              date: recordDate || mention.recordDate || '',
              sourceUrl: recordUrl,
            });
            result.entities++;
            result.mentions++;
          }

          // Co-occurrence links within the same record. The pair is collapsed
          // to a canonical A<B order and the link label is derived FROM the
          // collapsed order, so the stored direction always matches the label
          // (person→org with 'affiliation', never org→person with 'affiliation').
          const ids = keptPairs.map(({ mention: m }) => ({
            id: entityIdFor(m.entityNormalized, m.entityType),
            type: m.entityType,
            confidence: m.confidenceScore,
          }));
          for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
              if (ids[i].id === ids[j].id) continue;
              upsertLink(db, ids[i], ids[j], moduleName);
              result.links++;
            }
          }
          result.recordsProcessed++;
        } catch (err) {
          result.errors.push(
            `Record ${(record as { id?: unknown }).id ?? 'unknown'}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    });
    tx();
  } catch (err) {
    result.errors.push(`transaction: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Shape-agnostic wrapper (mirrors registerModuleResultClaims)        */
/* ------------------------------------------------------------------ */

/**
 * Register entity mentions for a module result. Handles the same result
 * shapes the claims hook handles: bare arrays, `{ records }`, `{ results }`,
 * `{ items }`, dict-shaped results (each value is a record), and single
 * record-shaped results. Never throws — graph building must not break
 * ingestion.
 */
export async function registerModuleResultEntities(
  moduleName: string,
  result: unknown,
  sourceUrl = '',
): Promise<GraphBuildResult> {
  try {
    if (Array.isArray(result)) {
      return buildEntityGraphFromRecords(moduleName, result, sourceUrl);
    }
    if (result && typeof result === 'object') {
      const r = result as Record<string, unknown>;
      if (Array.isArray(r.records)) {
        return buildEntityGraphFromRecords(moduleName, r.records, sourceUrl);
      }
      if (Array.isArray(r.results)) {
        return buildEntityGraphFromRecords(moduleName, r.results, sourceUrl);
      }
      if (Array.isArray(r.items)) {
        return buildEntityGraphFromRecords(moduleName, r.items, sourceUrl);
      }
      // Dict-shaped — committees returns Record<acronym, result>, influence
      // returns { actors, funding }, corporate returns Record<label, result>.
      // Guard: every value must be an object (status envelopes fall through).
      const dictValues = Object.values(r);
      if (
        dictValues.length > 0 &&
        dictValues.every((v) => v !== null && typeof v === 'object' && !Array.isArray(v))
      ) {
        return buildEntityGraphFromRecords(moduleName, dictValues, sourceUrl);
      }
      // Count-only envelopes have no records to extract from.
      if (typeof r.count === 'number' || typeof r.recordsCount === 'number') {
        return { entities: 0, mentions: 0, links: 0, recordsProcessed: 0, errors: [] };
      }
      const looksLikeStatusEnvelope =
        r.skipped === true || r.error !== undefined || r.status === 'skipped';
      if (
        !looksLikeStatusEnvelope &&
        (r.id !== undefined || r.name !== undefined || r.title !== undefined || r.url !== undefined)
      ) {
        return buildEntityGraphFromRecords(moduleName, [r], sourceUrl);
      }
    }
    return { entities: 0, mentions: 0, links: 0, recordsProcessed: 0, errors: [] };
  } catch (err) {
    console.warn(
      `[graph] registerModuleResultEntities(${moduleName}) failed: ` +
        `${err instanceof Error ? err.message : String(err)}`,
    );
    return { entities: 0, mentions: 0, links: 0, recordsProcessed: 0, errors: [] };
  }
}

/* ------------------------------------------------------------------ */
/*  Committee backfill — materialize persisted committee data          */
/* ------------------------------------------------------------------ */

/**
 * Materialize the persisted committee tables into the entity graph.
 * Reads committee_speakers (person entities), committee_interventions
 * (person mentions with dates/roles), and meeting co-occurrence
 * (person ↔ person links within the same meeting, party affiliations).
 *
 * Idempotent: all inserts are INSERT OR IGNORE against unique indexes.
 * Failure-safe: returns the counts; never throws.
 */
export function backfillCommitteeEntityGraph(): GraphBuildResult {
  const result: GraphBuildResult = { entities: 0, mentions: 0, links: 0, recordsProcessed: 0, errors: [] };

  let db: Database;
  try {
    ensureEntityGraph();
    db = getRawDb();
  } catch (err) {
    result.errors.push(`db: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  const hasTable = (t: string): boolean =>
    Boolean(
      db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(t),
    );
  if (!hasTable('committee_speakers') && !hasTable('committee_interventions')) return result;

  try {
    // 1. Speakers → person entities + mentions.
    if (hasTable('committee_speakers')) {
      const speakers = db
        .prepare(
          `SELECT name, latest_affiliation, latest_party, total_appearances, first_seen, last_seen
           FROM committee_speakers`,
        )
        .all() as Array<{
        name: string;
        latest_affiliation: string | null;
        latest_party: string | null;
        total_appearances: number;
        first_seen: string | null;
        last_seen: string | null;
      }>;

      for (const s of speakers) {
        if (!s.name || !s.name.trim()) continue;
        const normalized = normalizeName(s.name);
        const personId = entityIdFor(normalized, 'person');
        upsertEntity(db, personId, s.name.trim(), 'person', 0.9);
        upsertAlias(db, personId, normalized);
        upsertMention(db, {
          entityId: personId,
          moduleName: 'committees',
          sourceTable: 'committee_speakers',
          role: 'Speaker',
          date: s.last_seen ?? s.first_seen ?? '',
          sourceUrl: '',
        });
        result.entities++;
        result.mentions++;

        // Party affiliation → org entity + link.
        const party = s.latest_party?.trim();
        if (party && party.length > 1 && !/^as an/i.test(party)) {
          const partyNorm = normalizeName(party);
          const partyId = entityIdFor(partyNorm, 'organization');
          upsertEntity(db, partyId, party, 'organization', 0.7);
          upsertAlias(db, partyId, partyNorm);
          upsertLink(db, { id: personId, type: 'person', confidence: 0.9 }, { id: partyId, type: 'organization', confidence: 0.7 }, 'committees');
          result.entities++;
          result.links++;
        }
      }
    }

    // 2. Interventions → co-occurrence links between speakers of the same meeting.
    if (hasTable('committee_interventions') && hasTable('committee_meetings')) {
      const meetingSpeakers = db
        .prepare(
          `SELECT i.meeting_id, i.speaker_name, i.speaker_affiliation, m.date
           FROM committee_interventions i
           JOIN committee_meetings m ON i.meeting_id = m.id
           WHERE i.speaker_name IS NOT NULL AND i.speaker_name != ''
           GROUP BY i.meeting_id, i.speaker_name`,
        )
        .all() as Array<{
        meeting_id: string;
        speaker_name: string;
        speaker_affiliation: string | null;
        date: string;
      }>;

      const byMeeting = new Map<string, Array<{ id: string; type: string; name: string; date: string; affiliation: string | null }>>();
      for (const row of meetingSpeakers) {
        const list = byMeeting.get(row.meeting_id) ?? [];
        list.push({
          id: entityIdFor(normalizeName(row.speaker_name), 'person'),
          type: 'person',
          name: row.speaker_name,
          date: row.date ?? '',
          affiliation: row.speaker_affiliation,
        });
        byMeeting.set(row.meeting_id, list);
      }

      for (const list of byMeeting.values()) {          for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
              if (list[i].id === list[j].id) continue;
              upsertLink(db, { id: list[i].id, type: 'person', confidence: 0.8 }, { id: list[j].id, type: 'person', confidence: 0.8 }, 'committees');
              result.links++;
            }
          }
        // Record one mention per speaker so date evidence is present.
        for (const speaker of list) {
          upsertMention(db, {
            entityId: speaker.id,
            moduleName: 'committees',
            sourceTable: 'committee_interventions',
            role: 'Witness',
            date: speaker.date,
            sourceUrl: '',
          });
          result.mentions++;
        }
      }
      result.recordsProcessed += byMeeting.size;
    }
  } catch (err) {
    result.errors.push(`backfill: ${err instanceof Error ? err.message : String(err)}`);
    console.warn(`[graph] backfillCommitteeEntityGraph failed: ${result.errors[0]}`);
  }

  return result;
}

/**
 * Materialize the persisted lobbying_records table into the entity graph.
 * db-first corporate module persists records and returns a count envelope,
 * so the generic path skips them — this backfill reads the persisted rows:
 * registrant → person, client → organization, public office holder → person,
 * plus registrant↔client ('represents') and registrant↔institution links.
 * Idempotent (INSERT OR IGNORE against unique indexes), failure-safe.
 */
export function backfillLobbyingEntityGraph(): GraphBuildResult {
  const result: GraphBuildResult = { entities: 0, mentions: 0, links: 0, recordsProcessed: 0, errors: [] };
  // Licence policy: no person-level profiles from lobbying records — the
  // registrant and public-office-holder nodes are persons, and the registry
  // licences do not grant personal-information rights. Organization mentions
  // (clients, institutions) still land.
  const restrictPersons = restrictsPersonProfiles('lobbying');

  let db: Database;
  try {
    ensureEntityGraph();
    db = getRawDb();
  } catch (err) {
    result.errors.push(`db: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  const hasTable = (t: string): boolean =>
    Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(t));
  if (!hasTable('lobbying_records')) return result;

  try {
    const rows = db
      .prepare(
        `SELECT registrant_name, client_name, public_office_holder, government_institution,
                communication_date, source_url
         FROM lobbying_records
         WHERE registrant_name IS NOT NULL AND registrant_name != ''`,
      )
      .all() as Array<{
      registrant_name: string;
      client_name: string | null;
      public_office_holder: string | null;
      government_institution: string | null;
      communication_date: string;
      source_url: string | null;
    }>;

    for (const r of rows) {
      const date = r.communication_date ?? '';
      const url = r.source_url ?? '';
      const registrantId = entityIdFor(normalizeName(r.registrant_name), 'person');
      if (!restrictPersons) {
        upsertEntity(db, registrantId, r.registrant_name.trim(), 'person', 0.85);
        upsertAlias(db, registrantId, normalizeName(r.registrant_name));
        upsertMention(db, {
          entityId: registrantId, moduleName: 'lobbying', sourceTable: 'lobbying_records',
          role: 'Registrant', date, sourceUrl: url,
        });
        result.entities++;
        result.mentions++;
      }

      if (r.client_name && r.client_name.trim()) {
        const clientId = entityIdFor(normalizeName(r.client_name), 'organization');
        upsertEntity(db, clientId, r.client_name.trim(), 'organization', 0.9);
        upsertAlias(db, clientId, normalizeName(r.client_name));
        upsertMention(db, {
          entityId: clientId, moduleName: 'lobbying', sourceTable: 'lobbying_records',
          role: 'Client', date, sourceUrl: url,
        });
        if (!restrictPersons) {
          upsertLink(db, { id: registrantId, type: 'person', confidence: 0.85 }, { id: clientId, type: 'organization', confidence: 0.9 }, 'lobbying');
          result.links++;
        }
        result.entities++;
        result.mentions++;
      }

      if (!restrictPersons && r.public_office_holder && r.public_office_holder.trim()) {
        const holderId = entityIdFor(normalizeName(r.public_office_holder), 'person');
        upsertEntity(db, holderId, r.public_office_holder.trim(), 'person', 0.8);
        upsertAlias(db, holderId, normalizeName(r.public_office_holder));
        upsertMention(db, {
          entityId: holderId, moduleName: 'lobbying', sourceTable: 'lobbying_records',
          role: 'Public Office Holder', date, sourceUrl: url,
        });
        upsertLink(db, { id: registrantId, type: 'person', confidence: 0.85 }, { id: holderId, type: 'person', confidence: 0.8 }, 'lobbying');
        result.entities++;
        result.mentions++;
        result.links++;
      }

      if (r.government_institution && r.government_institution.trim()) {
        const instId = entityIdFor(normalizeName(r.government_institution), 'organization');
        upsertEntity(db, instId, r.government_institution.trim(), 'organization', 0.75);
        upsertAlias(db, instId, normalizeName(r.government_institution));
        if (!restrictPersons) {
          upsertLink(db, { id: registrantId, type: 'person', confidence: 0.85 }, { id: instId, type: 'organization', confidence: 0.75 }, 'lobbying');
          result.links++;
        }
        result.entities++;
      }
      result.recordsProcessed++;
    }
  } catch (err) {
    result.errors.push(`lobbying backfill: ${err instanceof Error ? err.message : String(err)}`);
    console.warn(`[graph] backfillLobbyingEntityGraph failed: ${result.errors[0]}`);
  }

  return result;
}

/**
 * Materialize the persisted gic_appointments table into the entity graph.
 * The GIC module is db-first and returns a count envelope, so the generic
 * path skips it — this backfill reads the persisted rows: appointee → person,
 * organization → organization, with an appointee↔organization link.
 * Idempotent, failure-safe.
 */
export function backfillGicEntityGraph(): GraphBuildResult {
  const result: GraphBuildResult = { entities: 0, mentions: 0, links: 0, recordsProcessed: 0, errors: [] };

  let db: Database;
  try {
    ensureEntityGraph();
    db = getRawDb();
  } catch (err) {
    result.errors.push(`db: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  const hasTable = (t: string): boolean =>
    Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(t));
  if (!hasTable('gic_appointments')) return result;

  try {
    const rows = db
      .prepare(
        `SELECT appointee_name, position_title, organization, department, appointment_date, source_url
         FROM gic_appointments
         WHERE appointee_name IS NOT NULL AND appointee_name != ''`,
      )
      .all() as Array<{
      appointee_name: string;
      position_title: string | null;
      organization: string | null;
      department: string | null;
      appointment_date: string;
      source_url: string | null;
    }>;

    for (const r of rows) {
      const date = r.appointment_date ?? '';
      const url = r.source_url ?? '';
      const appointeeId = entityIdFor(normalizeName(r.appointee_name), 'person');
      upsertEntity(db, appointeeId, r.appointee_name.trim(), 'person', 0.9);
      upsertAlias(db, appointeeId, normalizeName(r.appointee_name));
      upsertMention(db, {
        entityId: appointeeId, moduleName: 'gic', sourceTable: 'gic_appointments',
        role: r.position_title ?? 'Appointee', date, sourceUrl: url,
      });
      result.entities++;
      result.mentions++;

      const orgName = r.organization || r.department;
      if (orgName && orgName.trim()) {
        const orgId = entityIdFor(normalizeName(orgName), 'organization');
        upsertEntity(db, orgId, orgName.trim(), 'organization', 0.85);
        upsertAlias(db, orgId, normalizeName(orgName));
        upsertMention(db, {
          entityId: orgId, moduleName: 'gic', sourceTable: 'gic_appointments',
          role: 'Organization', date, sourceUrl: url,
        });
        upsertLink(db, { id: appointeeId, type: 'person', confidence: 0.9 }, { id: orgId, type: 'organization', confidence: 0.85 }, 'gic');
        result.entities++;
        result.mentions++;
        result.links++;
      }
      result.recordsProcessed++;
    }
  } catch (err) {
    result.errors.push(`gic backfill: ${err instanceof Error ? err.message : String(err)}`);
    console.warn(`[graph] backfillGicEntityGraph failed: ${result.errors[0]}`);
  }

  return result;
}

/**
 * Full graph build for a module run: generic extraction from the result
 * records, plus module-specific backfills for db-first modules that persist
 * records and return count envelopes (committees, corporate/lobbying, gic).
 * Failure-safe wrapper for runModule.
 */
export async function buildEntityGraph(
  moduleName: string,
  result: unknown,
  sourceUrl = '',
): Promise<GraphBuildResult> {
  const generic = await registerModuleResultEntities(moduleName, result, sourceUrl);
  let backfill: GraphBuildResult = { entities: 0, mentions: 0, links: 0, recordsProcessed: 0, errors: [] };
  try {
    if (moduleName === 'committees') {
      backfill = backfillCommitteeEntityGraph();
    } else if (moduleName === 'corporate' || moduleName === 'lobbying') {
      backfill = backfillLobbyingEntityGraph();
    } else if (moduleName === 'gic') {
      backfill = backfillGicEntityGraph();
    }
  } catch (err) {
    backfill.errors.push(`backfill: ${err instanceof Error ? err.message : String(err)}`);
  }
  return {
    entities: generic.entities + backfill.entities,
    mentions: generic.mentions + backfill.mentions,
    links: generic.links + backfill.links,
    recordsProcessed: generic.recordsProcessed + backfill.recordsProcessed,
    errors: [...generic.errors, ...backfill.errors],
  };
}

/* ------------------------------------------------------------------ */
/*  Internal upserts                                                   */
/* ------------------------------------------------------------------ */

function upsertEntity(
  db: Database,
  id: string,
  canonicalName: string,
  type: string,
  confidence: number,
): void {
  db.prepare(
    `INSERT INTO entities (id, canonical_name, type, confidence) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       canonical_name = excluded.canonical_name,
       type = excluded.type,
       confidence = MAX(entities.confidence, excluded.confidence)`,
  ).run(id, canonicalName, type, confidence);
}

function upsertAlias(db: Database, entityId: string, alias: string): void {
  if (!alias || !alias.trim()) return;
  db.prepare(
    `INSERT OR IGNORE INTO entity_aliases (entity_id, alias) VALUES (?, ?)`,
  ).run(entityId, alias.trim());
}

function upsertMention(
  db: Database,
  m: { entityId: string; moduleName: string; sourceTable: string; role: string; date: string; sourceUrl: string },
): void {
  db.prepare(
    `INSERT OR IGNORE INTO entity_mentions
       (entity_id, module_name, source_table, role, date, source_url)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(m.entityId, m.moduleName, m.sourceTable, m.role, m.date ?? '', m.sourceUrl ?? '');
}

function upsertLink(
  db: Database,
  source: { id: string; type: string; confidence: number },
  target: { id: string; type: string; confidence: number },
  sourceModule: string,
): void {
  // Keep the pair canonical so A→B and B→A collapse to one row, then derive
  // the label from the COLLAPSED order so stored direction matches the label.
  const [a, b] = source.id < target.id ? [source, target] : [target, source];
  const linkType = linkTypeFor(a.type, b.type);
  db.prepare(
    `INSERT OR IGNORE INTO entity_links (source_entity_id, target_entity_id, link_type, weight, source)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(a.id, b.id, linkType, Math.min(source.confidence, target.confidence), sourceModule);
}
