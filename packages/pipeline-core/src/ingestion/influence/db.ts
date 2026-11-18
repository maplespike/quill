// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Influence Database — Quill
 *
 * D1 SQLite persistence for influence tracking tables:
 *   - influence_actors
 *   - influence_connections
 *   - government_funding
 *   - cra_charity_cache
 *
 * DDL matches the central schema/d1.sql definitions.
 */

import type { D1Database } from '../committees/db.js';
import type { InfluenceActor, InfluenceConnection, GovernmentFunding } from './types.js';


/* ------------------------------------------------------------------ */
/*  DDL                                                                */
/* ------------------------------------------------------------------ */

export const INFLUENCE_DDL = `
CREATE TABLE IF NOT EXISTS influence_actors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  aliases TEXT,
  category TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  headquarters TEXT,
  founded_year INTEGER,
  annual_budget_cad REAL,
  website TEXT,
  wikipedia_url TEXT,
  is_cra_charity INTEGER DEFAULT 0,
  cra_bn TEXT,
  key_people_json TEXT,
  policy_areas TEXT,
  notes TEXT,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inf_category ON influence_actors(category);
CREATE INDEX IF NOT EXISTS idx_inf_priority ON influence_actors(priority);
CREATE INDEX IF NOT EXISTS idx_inf_cra_bn ON influence_actors(cra_bn);

CREATE TABLE IF NOT EXISTS influence_connections (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES influence_actors(id),
  actor_name TEXT NOT NULL,
  government_entity TEXT NOT NULL,
  connection_type TEXT NOT NULL,
  description TEXT,
  date TEXT,
  value_cad REAL,
  source_url TEXT,
  source_system TEXT NOT NULL,
  source_record_id TEXT,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inf_conn_actor ON influence_connections(actor_id);
CREATE INDEX IF NOT EXISTS idx_inf_conn_type ON influence_connections(connection_type);
CREATE INDEX IF NOT EXISTS idx_inf_conn_gov ON influence_connections(government_entity);
CREATE INDEX IF NOT EXISTS idx_inf_conn_date ON influence_connections(date);

CREATE TABLE IF NOT EXISTS government_funding (
  id TEXT PRIMARY KEY,
  recipient_name TEXT NOT NULL,
  recipient_type TEXT,
  department TEXT NOT NULL,
  department_acronym TEXT,
  program_name TEXT NOT NULL,
  agreement_type TEXT,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'CAD',
  fiscal_year TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  description TEXT,
  source_url TEXT,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_funding_recipient ON government_funding(recipient_name);
CREATE INDEX IF NOT EXISTS idx_funding_dept ON government_funding(department);
CREATE INDEX IF NOT EXISTS idx_funding_fiscal ON government_funding(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_funding_amount ON government_funding(amount DESC);

CREATE TABLE IF NOT EXISTS cra_charity_cache (
  bn TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL,
  operating_names TEXT,
  status TEXT,
  category TEXT,
  designation TEXT,
  total_revenue REAL,
  total_assets REAL,
  programs TEXT,
  directors TEXT,
  fiscal_year_end TEXT,
  source_url TEXT,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cra_name ON cra_charity_cache(legal_name);
`;


/* ------------------------------------------------------------------ */
/*  Upsert: influence_actors                                           */
/* ------------------------------------------------------------------ */

export async function upsertInfluenceActor(
  db: D1Database,
  actor: InfluenceActor,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO influence_actors
      (id, name, aliases, category, priority, headquarters, founded_year,
       annual_budget_cad, website, wikipedia_url, is_cra_charity, cra_bn,
       key_people_json, policy_areas, notes, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    actor.id,
    actor.name,
    JSON.stringify(actor.aliases),
    actor.category,
    actor.priority,
    actor.headquarters,
    actor.founded,
    actor.annualBudgetCad,
    actor.website,
    actor.wikipediaUrl,
    actor.isCraCharity ? 1 : 0,
    actor.craBn,
    JSON.stringify(actor.keyPeople),
    JSON.stringify(actor.policyAreas),
    actor.notes,
    actor.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}


/* ------------------------------------------------------------------ */
/*  Upsert: influence_connections                                      */
/* ------------------------------------------------------------------ */

export async function upsertInfluenceConnection(
  db: D1Database,
  conn: InfluenceConnection,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO influence_connections
      (id, actor_id, actor_name, government_entity, connection_type, description,
       date, value_cad, source_url, source_system, source_record_id, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    conn.id,
    conn.actorId,
    conn.actorName,
    conn.governmentEntity,
    conn.connectionType,
    conn.description,
    conn.date,
    conn.valueCad,
    conn.sourceUrl,
    conn.sourceSystem,
    conn.sourceRecordId,
    conn.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}


/* ------------------------------------------------------------------ */
/*  Upsert: government_funding                                         */
/* ------------------------------------------------------------------ */

export async function upsertGovernmentFunding(
  db: D1Database,
  funding: GovernmentFunding,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO government_funding
      (id, recipient_name, recipient_type, department, department_acronym,
       program_name, agreement_type, amount, currency, fiscal_year,
       start_date, end_date, description, source_url, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    funding.id,
    funding.recipientName,
    funding.recipientType,
    funding.department,
    funding.departmentAcronym,
    funding.programName,
    funding.agreementType,
    funding.amount,
    funding.currency,
    funding.fiscalYear,
    funding.startDate,
    funding.endDate,
    funding.description,
    funding.sourceUrl,
    funding.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}


/* ------------------------------------------------------------------ */
/*  Cross-Reference: Committee Appearances                             */
/* ------------------------------------------------------------------ */

/**
 * Search the committee_interventions table for speakers affiliated
 * with a tracked actor (by name or aliases).
 *
 * Returns matching meeting records so we can build real
 * committee-testimony connections.
 */
export async function searchCommitteeMentions(
  db: D1Database,
  actorName: string,
  actorAliases: string[],
): Promise<Array<{
  meetingId: string;
  committeeName: string;
  date: string;
  speakerName: string;
  evidenceUrl: string;
}>> {
  const searchTerms = [actorName, ...actorAliases.filter(a => a !== actorName)];
  const seen = new Set<string>();
  const results: Array<{
    meetingId: string;
    committeeName: string;
    date: string;
    speakerName: string;
    evidenceUrl: string;
  }> = [];

  for (const term of searchTerms) {
    const stmt = db.prepare(`
      SELECT DISTINCT cm.id as meeting_id, cm.committee_name, cm.date,
             ci.speaker_name, cm.evidence_url
      FROM committee_interventions ci
      JOIN committee_meetings cm ON ci.meeting_id = cm.id
      WHERE LOWER(ci.speaker_affiliation) LIKE LOWER(?)
      LIMIT 20
    `).bind(`%${term}%`);

    const result = await stmt.all<{
      meeting_id: string;
      committee_name: string;
      date: string;
      speaker_name: string;
      evidence_url: string;
    }>();

    for (const row of (result.results ?? [])) {
      const key = `${row.meeting_id}|${row.speaker_name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        meetingId: row.meeting_id,
        committeeName: row.committee_name,
        date: row.date,
        speakerName: row.speaker_name,
        evidenceUrl: row.evidence_url,
      });
    }
  }

  return results;
}
