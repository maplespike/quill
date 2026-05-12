import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export type DbClient = ReturnType<typeof createDb>;

const DEFAULT_DB_PATH = "civic-intel.sqlite";

export function createDb(dbPath?: string): ReturnType<typeof drizzle> {
  const path = dbPath ?? DEFAULT_DB_PATH;
  const sqlite = new Database(path);

  // Enable WAL mode for better concurrent read performance
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  return drizzle(sqlite, { schema });
}

export function runMigrations(db: DbClient): void {
  const sqlite = (db as unknown as { $client: Database.Database }).$client;

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
  `);
}
