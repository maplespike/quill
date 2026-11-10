// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import Database from "better-sqlite3";
import { runAllTransforms } from "./etl";

describe("EngineOrchestrator full pipeline", () => {
  let db: Database.Database;

  beforeAll(() => {
    db = new Database(":memory:");
    db.exec(`
      CREATE TABLE IF NOT EXISTS persons (id TEXT PRIMARY KEY, names TEXT NOT NULL, first_name TEXT, last_name TEXT, email TEXT, province TEXT, city TEXT, source TEXT NOT NULL, raw_data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, names TEXT NOT NULL, type TEXT NOT NULL, industry TEXT, province TEXT, city TEXT, website TEXT, parent_organization_id TEXT, source TEXT NOT NULL, raw_data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS contracts (id TEXT PRIMARY KEY, contract_number TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, vendor_name TEXT NOT NULL, vendor_id TEXT, department TEXT NOT NULL, value REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'CAD', start_date TEXT NOT NULL, end_date TEXT, status TEXT NOT NULL DEFAULT 'active', is_sole_source INTEGER NOT NULL DEFAULT 0, province TEXT, commodity_type TEXT, source TEXT NOT NULL, raw_data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS lobbying_filings (id TEXT PRIMARY KEY, filing_number TEXT NOT NULL, registrant_name TEXT NOT NULL, registrant_firm TEXT, registrant_person_id TEXT, client_name TEXT NOT NULL, client_organization_id TEXT, subject_matter TEXT NOT NULL, communications TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, activities TEXT NOT NULL, institution TEXT NOT NULL, province TEXT, source TEXT NOT NULL, raw_data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS donations (id TEXT PRIMARY KEY, donor_name TEXT NOT NULL, donor_person_id TEXT, donor_organization_id TEXT, recipient_name TEXT NOT NULL, recipient_type TEXT NOT NULL, amount REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'CAD', date TEXT NOT NULL, province TEXT, riding TEXT, is_corporate INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL, raw_data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS disclosures (id TEXT PRIMARY KEY, person_name TEXT NOT NULL, person_id TEXT, position TEXT NOT NULL, department TEXT NOT NULL, year INTEGER NOT NULL, interests TEXT NOT NULL, province TEXT, filing_date TEXT NOT NULL, source TEXT NOT NULL, raw_data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS gac_projects (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, department TEXT NOT NULL, country TEXT NOT NULL, region TEXT NOT NULL, budget REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'CAD', start_date TEXT NOT NULL, end_date TEXT, status TEXT NOT NULL DEFAULT 'active', implementing_partners TEXT NOT NULL, sector TEXT, source TEXT NOT NULL, raw_data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS lobbying_records (id TEXT PRIMARY KEY, registrant_name TEXT NOT NULL, registrant_client TEXT, registrant_address TEXT, client_name TEXT NOT NULL, client_business TEXT, subject_matter TEXT, government_institution TEXT, public_office_holder TEXT, communication_date TEXT NOT NULL, start_date TEXT, end_date TEXT, lobbying_cost_cad REAL, lobbyist_type TEXT DEFAULT 'consultant', source_url TEXT NOT NULL, ingested_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS contract_awards (id TEXT PRIMARY KEY, vendor_name TEXT NOT NULL, vendor_address TEXT, contract_value REAL NOT NULL, currency TEXT DEFAULT 'CAD', award_date TEXT NOT NULL, start_date TEXT, end_date TEXT, description TEXT, department TEXT NOT NULL, department_acronym TEXT, procurement_method TEXT, gsin TEXT, trade_agreement TEXT, bids_received INTEGER, source_url TEXT NOT NULL, is_sole_source INTEGER DEFAULT 0, ingested_at TEXT NOT NULL);
    `);

    const now = new Date().toISOString();
    db.prepare("INSERT INTO lobbying_records VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run("lob-1","Jane Lobbyist","Acme Consulting","123 Main St","Acme Corp","Defense","Procurement","DND","Minister",now,now,now,50000,"consultant","https://1",now);
    db.prepare("INSERT INTO lobbying_records VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run("lob-2","John Influence","Big PR","456 Oak","Big Corp","Pharma","Drug pricing","Health Canada","Minister",now,now,now,25000,"in-house","https://2",now);
    db.prepare("INSERT INTO contract_awards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run("ca-1","Acme Corp","123 Main",15000000,"CAD",now,now,null,"IT modernization","DND","DND","Competitive","GSIN-123","CFTA",3,"https://ca1",0,now);
    db.prepare("INSERT INTO contract_awards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run("ca-2","Big Corp","456 Oak",5000000,"CAD",now,now,null,"Pharma supply","Health Canada","HC","Sole Source","GSIN-456","CFTA",1,"https://ca2",1,now);
  });

  afterAll(() => { db.close(); });

  it("runAllTransforms populates canonical tables from seed data", () => {
    const result = runAllTransforms(db);
    expect(result.lobbyingFilings).toBe(2);
    expect(result.contracts).toBe(2);
    expect(result.persons).toBe(2);
    expect(result.organizations).toBe(2);
    expect(result.donations).toBe(0);
    expect(result.disclosures).toBe(0);
    expect(result.gacProjects).toBe(0);
    const filings = db.prepare("SELECT COUNT(*) as c FROM lobbying_filings").get() as any;
    expect(filings.c).toBe(2);
    const contracts = db.prepare("SELECT COUNT(*) as c FROM contracts").get() as any;
    expect(contracts.c).toBe(2);
    const persons = db.prepare("SELECT COUNT(*) as c FROM persons").get() as any;
    expect(persons.c).toBe(2);
    const orgs = db.prepare("SELECT COUNT(*) as c FROM organizations").get() as any;
    expect(orgs.c).toBe(2);
  });

  it("ETL maps columns correctly across tables", () => {
    runAllTransforms(db);
    const filingRows = db.prepare("SELECT * FROM lobbying_filings").all() as any[];
    expect(filingRows.length).toBe(2);
    const clientNames = filingRows.map(r => r.client_name).sort();
    expect(clientNames).toEqual(["Acme Corp", "Big Corp"]);
    const registrants = filingRows.map(r => r.registrant_name).sort();
    expect(registrants).toEqual(["Jane Lobbyist", "John Influence"]);
  });

  it("creates cross-referencing data for signal detection", () => {
    runAllTransforms(db);
    const lobbyingClients = db.prepare("SELECT DISTINCT client_name FROM lobbying_filings").all() as any[];
    const contractVendors = db.prepare("SELECT DISTINCT vendor_name FROM contracts").all() as any[];
    const lobbyNames = new Set(lobbyingClients.map(r => r.client_name));
    const contractNames = new Set(contractVendors.map(r => r.vendor_name));
    const overlap = [...lobbyNames].filter(n => contractNames.has(n));
    expect(overlap.length).toBeGreaterThanOrEqual(1);
    expect(overlap).toContain("Acme Corp");
  });

  it("creates organizations from multiple source tables", () => {
    runAllTransforms(db);
    const orgs = db.prepare("SELECT * FROM organizations").all() as any[];
    expect(orgs.length).toBeGreaterThanOrEqual(2);
    const orgNames = orgs.map(r => JSON.parse(r.names)[0]);
    expect(orgNames).toContain("Acme Corp");
    expect(orgNames).toContain("Big Corp");
  });

  it("idempotent: running ETL twice produces same row count", () => {
    const first = runAllTransforms(db);
    const second = runAllTransforms(db);
    expect(second.lobbyingFilings).toBe(first.lobbyingFilings);
    expect(second.contracts).toBe(first.contracts);
    expect(second.persons).toBe(first.persons);
    expect(second.organizations).toBe(first.organizations);
  });
});
