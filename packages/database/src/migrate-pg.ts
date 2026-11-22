/**
 * Quill — PostgreSQL Schema Migration
 *
 * Creates all domain-data tables in PostgreSQL.
 * Mirrors the SQLite tables defined in schema.ts / connection.ts.
 *
 * Usage:
 *   import { migratePg } from "@maplespike/database/migrate-pg";
 *   await migratePg(pool);
 */

import { applyMediaRssMetadataPostgres } from "./media-rss-migration.js";

export const PG_DOMAIN_MIGRATION_SQL = `
-- ─── Persons ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS persons (
  id TEXT PRIMARY KEY,
  names JSONB NOT NULL DEFAULT '[]',
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  province TEXT,
  city TEXT,
  source TEXT NOT NULL,
  raw_data TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_persons_source ON persons(source);
CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(last_name, first_name);

-- ─── Organizations ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  names JSONB NOT NULL DEFAULT '[]',
  type TEXT NOT NULL,
  industry TEXT,
  province TEXT,
  city TEXT,
  website TEXT,
  parent_organization_id TEXT,
  source TEXT NOT NULL,
  raw_data TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_source ON organizations(source);
CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(type);
CREATE INDEX IF NOT EXISTS idx_organizations_parent ON organizations(parent_organization_id);

-- ─── Contracts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  contract_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  vendor_id TEXT,
  department TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CAD',
  start_date TEXT NOT NULL,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  is_sole_source INTEGER NOT NULL DEFAULT 0,
  province TEXT,
  commodity_type TEXT,
  source TEXT NOT NULL,
  raw_data TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_source ON contracts(source);
CREATE INDEX IF NOT EXISTS idx_contracts_department ON contracts(department);
CREATE INDEX IF NOT EXISTS idx_contracts_vendor ON contracts(vendor_name);

-- ─── Tenders ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenders (
  id TEXT PRIMARY KEY,
  solicitation_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  department TEXT NOT NULL,
  estimated_value DOUBLE PRECISION,
  currency TEXT NOT NULL DEFAULT 'CAD',
  publish_date TEXT NOT NULL,
  closing_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  is_sole_source INTEGER NOT NULL DEFAULT 0,
  province TEXT,
  source TEXT NOT NULL,
  raw_data TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenders_source ON tenders(source);
CREATE INDEX IF NOT EXISTS idx_tenders_status ON tenders(status);
CREATE INDEX IF NOT EXISTS idx_tenders_closing ON tenders(closing_date);

-- ─── Lobbying Filings ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lobbying_filings (
  id TEXT PRIMARY KEY,
  filing_number TEXT NOT NULL,
  registrant_name TEXT NOT NULL,
  registrant_firm TEXT,
  registrant_person_id TEXT,
  client_name TEXT NOT NULL,
  client_organization_id TEXT,
  subject_matter TEXT NOT NULL,
  communications TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  activities TEXT NOT NULL,
  institution TEXT NOT NULL,
  province TEXT,
  source TEXT NOT NULL,
  raw_data TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lobbying_source ON lobbying_filings(source);
CREATE INDEX IF NOT EXISTS idx_lobbying_registrant ON lobbying_filings(registrant_name);

-- ─── Donations ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY,
  donor_name TEXT NOT NULL,
  donor_person_id TEXT,
  donor_organization_id TEXT,
  recipient_name TEXT NOT NULL,
  recipient_type TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CAD',
  date TEXT NOT NULL,
  province TEXT,
  riding TEXT,
  is_corporate INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  raw_data TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_donations_source ON donations(source);
CREATE INDEX IF NOT EXISTS idx_donations_donor ON donations(donor_name);

-- ─── Disclosures ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS disclosures (
  id TEXT PRIMARY KEY,
  person_name TEXT NOT NULL,
  person_id TEXT,
  position TEXT NOT NULL,
  department TEXT NOT NULL,
  year INTEGER NOT NULL,
  interests TEXT NOT NULL,
  province TEXT,
  filing_date TEXT NOT NULL,
  source TEXT NOT NULL,
  raw_data TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disclosures_source ON disclosures(source);
CREATE INDEX IF NOT EXISTS idx_disclosures_year ON disclosures(year);

-- ─── GAC Projects ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gac_projects (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  department TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  budget DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CAD',
  start_date TEXT NOT NULL,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  implementing_partners TEXT NOT NULL,
  sector TEXT,
  source TEXT NOT NULL,
  raw_data TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gac_source ON gac_projects(source);
CREATE INDEX IF NOT EXISTS idx_gac_country ON gac_projects(country);

-- ─── Graph Nodes ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS graph_nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  properties TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_graph_nodes_type ON graph_nodes(type);

-- ─── Graph Edges ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS graph_edges (
  id TEXT PRIMARY KEY,
  source_node TEXT NOT NULL REFERENCES graph_nodes(id),
  target_node TEXT NOT NULL REFERENCES graph_nodes(id),
  type TEXT NOT NULL,
  weight DOUBLE PRECISION NOT NULL DEFAULT 1,
  properties TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON graph_edges(source_node);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges(target_node);
CREATE INDEX IF NOT EXISTS idx_graph_edges_type ON graph_edges(type);

-- ─── Intelligence Threads ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intelligence_threads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  nodes TEXT NOT NULL,
  edges TEXT NOT NULL,
  sources TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intel_signal_type ON intelligence_threads(signal_type);

-- ─── Briefs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS briefs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  sections TEXT NOT NULL,
  entity_ids TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- ─── Notification Subscriptions ───────────────────────────────────────────
-- Decision 0002: PII avoidance. subject_hash replaces email.
-- Real delivery happens via the user client (web-push, wallet).
CREATE TABLE IF NOT EXISTS notification_subscriptions (
  id TEXT PRIMARY KEY,
  subject_hash TEXT NOT NULL,
  source_filter JSONB NOT NULL DEFAULT '[]',
  event_types JSONB NOT NULL DEFAULT '[]',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  label TEXT,
  unsubscribe_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Notification Events ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_events (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES notification_subscriptions(id),
  source_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  delivered_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ne_subscription ON notification_events(subscription_id);
`;

/**
 * Run the full PostgreSQL domain-data migration against a pg Pool.
 */
export async function migrateDomainTables(pool: import("pg").Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(PG_DOMAIN_MIGRATION_SQL);
    await applyMediaRssMetadataPostgres(client);
    console.log("[migrate-pg] Domain tables migration complete");
  } finally {
    client.release();
  }
}
