// SPDX-License-Identifier: AGPL-3.0-only
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

// ─── Types ────────────────────────────────────────────────────────────

export type DbClient = BetterSQLite3Database<typeof schema>;

export interface DbConfig {
  path?: string;
  memory?: boolean;
  readonly?: boolean;
  enableWal?: boolean;
}

// ─── Singleton State ──────────────────────────────────────────────────

let sqliteInstance: Database.Database | null = null;
let dbInstance: DbClient | null = null;

const DEFAULT_DB_PATH = "quill.sqlite";

// ─── Connection Factory (internal) ────────────────────────────────────

function buildConnection(config: DbConfig): { sqlite: Database.Database; db: DbClient } {
  const isMemory = config.memory ?? false;
  // Respect QUILL_DB_PATH so shared stores (claims, entity links) land in the
  // same SQLite file the api-server's NodeSqliteStorage uses (/data/quill.db
  // in prod). Without this, CitationStore opened a relative quill.sqlite in
  // the pod cwd — ephemeral, so claims never survived a restart. Explicit
  // config.path always wins; QUILL_DB_PATH is the environment default.
  const dbPath = config.path ?? (process.env.QUILL_DB_PATH || (isMemory ? ":memory:" : DEFAULT_DB_PATH));

  const sqlite = new Database(dbPath, {
    readonly: config.readonly ?? false,
    fileMustExist: config.readonly ?? false,
    timeout: 10000,
  });

  if (config.enableWal ?? !config.readonly) {
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
  }

  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Get the shared database instance (lazy singleton).
 * First call creates the connection; subsequent calls return the cached instance.
 */
export function getDb(config?: DbConfig): DbClient {
  if (dbInstance && !config) {
    return dbInstance;
  }

  const { sqlite, db } = buildConnection(config ?? {});

  if (!config) {
    // No config = first time with defaults → cache as singleton
    sqliteInstance = sqlite;
    dbInstance = db;
  }

  return db;
}

/**
 * Get the raw better-sqlite3 instance for direct SQL access.
 */
export function getRawDb(): Database.Database {
  if (!sqliteInstance) {
    getDb();
  }
  return sqliteInstance!;
}

/**
 * Create a new database instance (always returns a new connection).
 * Useful for testing with :memory: or multi-tenant setups.
 */
export function createDb(dbPath?: string): DbClient {
  const { sqlite, db } = buildConnection({
    path: dbPath,
    memory: dbPath === ":memory:",
  });

  return db;
}

/**
 * Run SQLite schema migrations on the shared database instance.
 * Creates all tables if they don't exist.
 */
export function runMigrations(db?: DbClient): void {
  const target = db ?? getDb();
  const sqlite = (target as unknown as { $client: Database.Database }).$client;

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS persons (
      id TEXT PRIMARY KEY,
      names TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      province TEXT,
      city TEXT,
      source TEXT NOT NULL,
      raw_data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      names TEXT NOT NULL,
      type TEXT NOT NULL,
      industry TEXT,
      province TEXT,
      city TEXT,
      website TEXT,
      parent_organization_id TEXT,
      source TEXT NOT NULL,
      raw_data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      contract_number TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      vendor_name TEXT NOT NULL,
      vendor_id TEXT,
      department TEXT NOT NULL,
      value REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'CAD',
      start_date TEXT NOT NULL,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      is_sole_source INTEGER NOT NULL DEFAULT 0,
      province TEXT,
      commodity_type TEXT,
      source TEXT NOT NULL,
      raw_data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tenders (
      id TEXT PRIMARY KEY,
      solicitation_number TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      department TEXT NOT NULL,
      estimated_value REAL,
      currency TEXT NOT NULL DEFAULT 'CAD',
      publish_date TEXT NOT NULL,
      closing_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      is_sole_source INTEGER NOT NULL DEFAULT 0,
      province TEXT,
      source TEXT NOT NULL,
      raw_data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS donations (
      id TEXT PRIMARY KEY,
      donor_name TEXT NOT NULL,
      donor_person_id TEXT,
      donor_organization_id TEXT,
      recipient_name TEXT NOT NULL,
      recipient_type TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'CAD',
      date TEXT NOT NULL,
      province TEXT,
      riding TEXT,
      is_corporate INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL,
      raw_data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gac_projects (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      department TEXT NOT NULL,
      country TEXT NOT NULL,
      region TEXT NOT NULL,
      budget REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'CAD',
      start_date TEXT NOT NULL,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      implementing_partners TEXT NOT NULL,
      sector TEXT,
      source TEXT NOT NULL,
      raw_data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS graph_nodes (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      properties TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS graph_edges (
      id TEXT PRIMARY KEY,
      source_node TEXT NOT NULL REFERENCES graph_nodes(id),
      target_node TEXT NOT NULL REFERENCES graph_nodes(id),
      type TEXT NOT NULL,
      weight REAL NOT NULL DEFAULT 1,
      properties TEXT NOT NULL,
      source_ref TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS intelligence_threads (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      signal_type TEXT NOT NULL,
      confidence REAL NOT NULL,
      nodes TEXT NOT NULL,
      edges TEXT NOT NULL,
      sources TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS briefs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    sections TEXT NOT NULL,
    entity_ids TEXT NOT NULL,
    confidence REAL NOT NULL,
    generated_at TEXT NOT NULL,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Committees (Parliamentary) ───────────────────────────────────
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

    -- ─── Committee Meetings ───────────────────────────────────────────
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

    -- ─── Committee Reports ────────────────────────────────────────────
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

    -- ─── Committee Witnesses ──────────────────────────────────────────
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

    -- ─── Governance Committees ────────────────────────────────────────
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

    -- ─── Governance Committee Members ───────────────────────────────
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

    -- ─── Governance Committee Meetings ──────────────────────────────
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

    -- ─── Charities ────────────────────────────────────────────────────
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

    -- ─── Charity Activities ───────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS charity_activities (
      id TEXT PRIMARY KEY,
      charity_id TEXT NOT NULL REFERENCES charities(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      beneficiaries TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_ca_charity ON charity_activities(charity_id);

    -- ─── Charity Financials ───────────────────────────────────────────
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

    -- ─── Charity Board Members ────────────────────────────────────────
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

    -- Decision 0002: notification subscriptions no longer store
    -- plaintext email. subject_hash + unsubscribe_token replace it.
    CREATE TABLE IF NOT EXISTS notification_subscriptions (
    id TEXT PRIMARY KEY NOT NULL,
    subject_hash TEXT NOT NULL,
    source_filter TEXT NOT NULL,
    event_types TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    label TEXT,
    unsubscribe_token TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notification_events (
    id TEXT PRIMARY KEY NOT NULL,
    subscription_id TEXT NOT NULL REFERENCES notification_subscriptions(id),
    source_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    summary TEXT NOT NULL,
    delivered_at TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Claim Stack: verifiable claim bundles (ECOSYSTEM-EXECUTION-PLAN WS-1)
    CREATE TABLE IF NOT EXISTS citation_records (
      hash TEXT PRIMARY KEY,
      serialized TEXT NOT NULL,
      citation_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    `);
}

/**
 * Close the shared database connection and reset the singleton.
 */
export function closeDb(): void {
  if (sqliteInstance) {
    sqliteInstance.pragma("wal_checkpoint(TRUNCATE)");
    sqliteInstance.close();
    sqliteInstance = null;
    dbInstance = null;
  }
}
