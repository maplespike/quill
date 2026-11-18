// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — v0.3.0 Migration: Add Committee and Charity Tables
 *
 * Adds parliamentary committee tables, governance committee tables,
 * and charity tables with their related sub-tables.
 *
 * Usage:
 *   import { migrate } from "./002_add_committee_charity_tables.js";
 *   await migrate(poolOrDb);
 *
 * Supports both PostgreSQL (Pool) and SQLite (better-sqlite3) backends.
 */

export const MIGRATION_VERSION = "002";
export const MIGRATION_NAME = "add_committee_charity_tables";

// ─── PostgreSQL SQL ─────────────────────────────────────────────────────────

export const PG_MIGRATION_SQL = `
-- ─── Committees (Parliamentary) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS committees (
  id TEXT PRIMARY KEY,
  parliament TEXT NOT NULL,
  chamber TEXT NOT NULL,
  committee_name TEXT NOT NULL,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  party TEXT,
  province TEXT,
  startDate TEXT NOT NULL
);

-- ─── Committee Meetings ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS committee_meetings (
  id TEXT PRIMARY KEY,
  committee_id TEXT NOT NULL REFERENCES committees(id),
  meeting TEXT NOT NULL,
  date TEXT NOT NULL,
  topic TEXT NOT NULL,
  inCamera INTEGER NOT NULL DEFAULT 0,
  witnesses TEXT,
  durationMinutes INTEGER
);

CREATE INDEX IF NOT EXISTS idx_cm_committee ON committee_meetings(committee_id);

-- ─── Committee Reports ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS committee_reports (
  id TEXT PRIMARY KEY,
  committee_id TEXT NOT NULL REFERENCES committees(id),
  reportNumber TEXT NOT NULL,
  title TEXT NOT NULL,
  presentedDate TEXT NOT NULL,
  parliament TEXT NOT NULL,
  session TEXT,
  pages INTEGER,
  recommendations INTEGER
);

CREATE INDEX IF NOT EXISTS idx_cr_committee ON committee_reports(committee_id);

-- ─── Committee Witnesses ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS committee_witnesses (
  id TEXT PRIMARY KEY,
  committee_id TEXT NOT NULL REFERENCES committees(id),
  witness TEXT NOT NULL,
  role TEXT NOT NULL,
  date TEXT NOT NULL,
  topic TEXT NOT NULL,
  meeting TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cw_committee ON committee_witnesses(committee_id);

-- ─── Governance Committees ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS committee_governance (
  id TEXT PRIMARY KEY,
  names JSONB NOT NULL DEFAULT '[]',
  type TEXT NOT NULL,
  scope TEXT NOT NULL,
  chamber TEXT,
  mandate TEXT NOT NULL,
  parent_committee_id TEXT,
  source_url TEXT,
  source_last_updated TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cg_type ON committee_governance(type);
CREATE INDEX IF NOT EXISTS idx_cg_scope ON committee_governance(scope);

-- ─── Governance Committee Members ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS committee_governance_members (
  id TEXT PRIMARY KEY,
  committee_id TEXT NOT NULL REFERENCES committee_governance(id) ON DELETE CASCADE,
  person_id TEXT,
  person_name TEXT NOT NULL,
  role TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  party TEXT,
  riding TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cgm_committee ON committee_governance_members(committee_id);

-- ─── Governance Committee Meetings ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS committee_governance_meetings (
  id TEXT PRIMARY KEY,
  committee_id TEXT NOT NULL REFERENCES committee_governance(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  location TEXT,
  agenda JSONB DEFAULT '[]',
  attendees JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cgm_meeting_committee ON committee_governance_meetings(committee_id);

-- ─── Charities ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS charities (
  id TEXT PRIMARY KEY,
  names JSONB NOT NULL DEFAULT '[]',
  registration_number TEXT UNIQUE,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  mandate TEXT NOT NULL,
  website TEXT,
  street TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'Canada',
  parent_organization_id TEXT,
  source_url TEXT,
  source_last_updated TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_charities_type ON charities(type);
CREATE INDEX IF NOT EXISTS idx_charities_status ON charities(status);
CREATE INDEX IF NOT EXISTS idx_charities_province ON charities(province);

-- ─── Charity Activities ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS charity_activities (
  id TEXT PRIMARY KEY,
  charity_id TEXT NOT NULL REFERENCES charities(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  beneficiaries TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca_charity ON charity_activities(charity_id);

-- ─── Charity Financials ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS charity_financials (
  id TEXT PRIMARY KEY,
  charity_id TEXT NOT NULL REFERENCES charities(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  total_revenue DOUBLE PRECISION NOT NULL,
  total_expenses DOUBLE PRECISION NOT NULL,
  assets DOUBLE PRECISION NOT NULL,
  currency TEXT DEFAULT 'CAD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cf_charity ON charity_financials(charity_id);

-- ─── Charity Board Members ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS charity_board_members (
  id TEXT PRIMARY KEY,
  charity_id TEXT NOT NULL REFERENCES charities(id) ON DELETE CASCADE,
  person_id TEXT,
  person_name TEXT NOT NULL,
  title TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  is_compensated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cbm_charity ON charity_board_members(charity_id);
`;

// ─── SQLite SQL ────────────────────────────────────────────────────────────

export const SQLITE_MIGRATION_SQL = `
-- ─── Committees (Parliamentary) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS committees (
  id TEXT PRIMARY KEY,
  parliament TEXT NOT NULL,
  chamber TEXT NOT NULL,
  committee_name TEXT NOT NULL,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  party TEXT,
  province TEXT,
  startDate TEXT NOT NULL
);

-- ─── Committee Meetings ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS committee_meetings (
  id TEXT PRIMARY KEY,
  committee_id TEXT NOT NULL REFERENCES committees(id),
  meeting TEXT NOT NULL,
  date TEXT NOT NULL,
  topic TEXT NOT NULL,
  inCamera INTEGER NOT NULL DEFAULT 0,
  witnesses TEXT,
  durationMinutes INTEGER
);

CREATE INDEX IF NOT EXISTS idx_cm_committee ON committee_meetings(committee_id);

-- ─── Committee Reports ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS committee_reports (
  id TEXT PRIMARY KEY,
  committee_id TEXT NOT NULL REFERENCES committees(id),
  reportNumber TEXT NOT NULL,
  title TEXT NOT NULL,
  presentedDate TEXT NOT NULL,
  parliament TEXT NOT NULL,
  session TEXT,
  pages INTEGER,
  recommendations INTEGER
);

CREATE INDEX IF NOT EXISTS idx_cr_committee ON committee_reports(committee_id);

-- ─── Committee Witnesses ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS committee_witnesses (
  id TEXT PRIMARY KEY,
  committee_id TEXT NOT NULL REFERENCES committees(id),
  witness TEXT NOT NULL,
  role TEXT NOT NULL,
  date TEXT NOT NULL,
  topic TEXT NOT NULL,
  meeting TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cw_committee ON committee_witnesses(committee_id);

-- ─── Governance Committees ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS committee_governance (
  id TEXT PRIMARY KEY,
  names TEXT NOT NULL DEFAULT '[]',
  type TEXT NOT NULL,
  scope TEXT NOT NULL,
  chamber TEXT,
  mandate TEXT NOT NULL,
  parent_committee_id TEXT,
  source_url TEXT,
  source_last_updated TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cg_type ON committee_governance(type);
CREATE INDEX IF NOT EXISTS idx_cg_scope ON committee_governance(scope);

-- ─── Governance Committee Members ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS committee_governance_members (
  id TEXT PRIMARY KEY,
  committee_id TEXT NOT NULL REFERENCES committee_governance(id) ON DELETE CASCADE,
  person_id TEXT,
  person_name TEXT NOT NULL,
  role TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  party TEXT,
  riding TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cgm_committee ON committee_governance_members(committee_id);

-- ─── Governance Committee Meetings ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS committee_governance_meetings (
  id TEXT PRIMARY KEY,
  committee_id TEXT NOT NULL REFERENCES committee_governance(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  location TEXT,
  agenda TEXT NOT NULL DEFAULT '[]',
  attendees TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cgm_meeting_committee ON committee_governance_meetings(committee_id);

-- ─── Charities ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS charities (
  id TEXT PRIMARY KEY,
  names TEXT NOT NULL DEFAULT '[]',
  registration_number TEXT UNIQUE,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  mandate TEXT NOT NULL,
  website TEXT,
  street TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'Canada',
  parent_organization_id TEXT,
  source_url TEXT,
  source_last_updated TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_charities_type ON charities(type);
CREATE INDEX IF NOT EXISTS idx_charities_status ON charities(status);
CREATE INDEX IF NOT EXISTS idx_charities_province ON charities(province);

-- ─── Charity Activities ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS charity_activities (
  id TEXT PRIMARY KEY,
  charity_id TEXT NOT NULL REFERENCES charities(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  beneficiaries TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ca_charity ON charity_activities(charity_id);

-- ─── Charity Financials ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS charity_financials (
  id TEXT PRIMARY KEY,
  charity_id TEXT NOT NULL REFERENCES charities(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  total_revenue REAL NOT NULL,
  total_expenses REAL NOT NULL,
  assets REAL NOT NULL,
  currency TEXT DEFAULT 'CAD',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cf_charity ON charity_financials(charity_id);

-- ─── Charity Board Members ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS charity_board_members (
  id TEXT PRIMARY KEY,
  charity_id TEXT NOT NULL REFERENCES charities(id) ON DELETE CASCADE,
  person_id TEXT,
  person_name TEXT NOT NULL,
  title TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  is_compensated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cbm_charity ON charity_board_members(charity_id);
`;

// ─── Runner ────────────────────────────────────────────────────────────────

export async function migratePg(pool: any): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(PG_MIGRATION_SQL);
    console.log(`[migration:${MIGRATION_VERSION}] ${MIGRATION_NAME} (pg) complete`);
  } finally {
    client.release();
  }
}

export async function migrateSqlite(db: any): Promise<void> {
  const sqlite = typeof db.exec === "function" ? db : (db as any).$client;
  sqlite.exec(SQLITE_MIGRATION_SQL);
  console.log(`[migration:${MIGRATION_VERSION}] ${MIGRATION_NAME} (sqlite) complete`);
}
