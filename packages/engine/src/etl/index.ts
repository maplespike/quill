// SPDX-License-Identifier: AGPL-3.0-only
import Database from "better-sqlite3";
import { getRawDb, generateId, nowISO } from "../db/connection";

// ─── Helpers ──────────────────────────────────────────────────────────

function uid(prefix: string): string {
  return `${prefix}-${generateId()}`;
}

function runPrepared(db: Database.Database, sql: string, params: unknown[]): void {
  db.prepare(sql).run(...params);
}

// ─── Lobbying Records → lobbying_filings ──────────────────────────

export function transformLobbying(db: Database.Database): number {
  let rows: any[];
  try {
    rows = db.prepare("SELECT * FROM lobbying_records").all() as any[];
  } catch {
    return 0;
  }
  const insert = db.prepare(`
    INSERT OR REPLACE INTO lobbying_filings
      (id, filing_number, registrant_name, registrant_firm, client_name,
       subject_matter, communications, start_date, end_date, activities,
       institution, source, raw_data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const del = db.prepare("DELETE FROM lobbying_filings");
  del.run();
  for (const r of rows) {
    const filingNumber = r.filing_number || `LF-${r.id}`;
    insert.run(
      r.id || uid("lob"),
      filingNumber,
      r.registrant_name || "",
      r.registrant_client || null,
      r.client_name || "",
      r.subject_matter || "",
      JSON.stringify([]),
      r.start_date || r.communication_date || nowISO().substring(0, 10),
      r.end_date || nowISO().substring(0, 10),
      JSON.stringify([r.lobbyist_type || "lobbyist"]),
      r.government_institution || "",
      "lobbying_commissioner",
      JSON.stringify(r),
      nowISO(),
      nowISO(),
    );
  }
  return rows.length;
}

// ─── Contract Awards → contracts ──────────────────────────────────

export function transformContracts(db: Database.Database): number {
  let rows: any[];
  try {
    rows = db.prepare("SELECT * FROM contract_awards").all() as any[];
  } catch { /* table may not exist */ return 0; }
  const del = db.prepare("DELETE FROM contracts");
  del.run();
  const insert = db.prepare(`
    INSERT OR REPLACE INTO contracts
      (id, contract_number, title, description, vendor_name, department,
       value, currency, start_date, end_date, status, is_sole_source,
       province, source, raw_data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const r of rows) {
    insert.run(
      r.id || uid("ct"),
      r.contract_number || `CA-${r.id}`,
      r.description?.substring(0, 200) || "Contract",
      r.description || "",
      r.vendor_name || "",
      r.department || "",
      r.contract_value ?? 0,
      r.currency || "CAD",
      r.award_date || nowISO().substring(0, 10),
      r.end_date || null,
      "active",
      r.is_sole_source ? 1 : 0,
      r.province || null,
      "open_canada_contracts",
      JSON.stringify(r),
      nowISO(),
      nowISO(),
    );
  }
  return rows.length;
}

// ─── Extract Persons from domain tables ──────────────────────────

export function transformPersons(db: Database.Database): number {
  const del = db.prepare("DELETE FROM persons");
  del.run();
  const insert = db.prepare(`
    INSERT OR REPLACE INTO persons
      (id, names, first_name, last_name, source, raw_data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const seen = new Set<string>();
  let count = 0;

  // From lobbying_records
  let lobbyRows: any[] = [];
  try {
    lobbyRows = db.prepare("SELECT DISTINCT registrant_name as name FROM lobbying_records WHERE registrant_name IS NOT NULL AND registrant_name != ''").all() as any[];
  } catch { /* table may not exist */ }
  for (const r of lobbyRows) {
    if (!seen.has(r.name)) {
      seen.add(r.name);
      const parts = r.name.split(/\s+/);
      insert.run(uid("per"), JSON.stringify([r.name]), parts[0], parts.slice(1).join(" ") || null, "lobbying_commissioner", JSON.stringify(r), nowISO(), nowISO());
      count++;
    }
  }

  // From committee_interventions
  try {
    const cmtRows = db.prepare("SELECT DISTINCT speaker_name as name FROM committee_speakers WHERE speaker_name IS NOT NULL AND speaker_name != ''").all() as any[];
    for (const r of cmtRows) {
      if (!seen.has(r.name)) {
        seen.add(r.name);
        const parts = r.name.split(/\s+/);
        insert.run(uid("per"), JSON.stringify([r.name]), parts[0], parts.slice(1).join(" ") || null, "parliament", JSON.stringify(r), nowISO(), nowISO());
        count++;
      }
    }
  } catch { /* table may not exist */ }

  // From GIC appointments
  try {
    const gicRows = db.prepare("SELECT DISTINCT appointee_name as name FROM gic_appointments WHERE appointee_name IS NOT NULL AND appointee_name != ''").all() as any[];
    for (const r of gicRows) {
      if (!seen.has(r.name)) {
        seen.add(r.name);
        const parts = r.name.split(/\s+/);
        insert.run(uid("per"), JSON.stringify([r.name]), parts[0], parts.slice(1).join(" ") || null, "gic", JSON.stringify(r), nowISO(), nowISO());
        count++;
      }
    }
  } catch { /* table may not exist */ }

  return count;
}

// ─── Extract Organizations from domain tables ─────────────────────

export function transformOrganizations(db: Database.Database): number {
  const del = db.prepare("DELETE FROM organizations");
  del.run();
  const insert = db.prepare(`
    INSERT OR REPLACE INTO organizations
      (id, names, type, industry, province, source, raw_data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const seen = new Set<string>();
  let count = 0;

  // From lobbying_records (client organizations)
  let lobbyRows: any[] = [];
  try {
    lobbyRows = db.prepare("SELECT DISTINCT client_name as name FROM lobbying_records WHERE client_name IS NOT NULL AND client_name != ''").all() as any[];
  } catch { /* table may not exist */ }
  for (const r of lobbyRows) {
    if (!seen.has(r.name)) {
      seen.add(r.name);
      insert.run(uid("org"), JSON.stringify([r.name]), "corporation", null, null, "lobbying_commissioner", JSON.stringify(r), nowISO(), nowISO());
      count++;
    }
  }

  // From contract_awards (vendor organizations)
  try {
    const contractRows = db.prepare("SELECT DISTINCT vendor_name as name FROM contract_awards WHERE vendor_name IS NOT NULL AND vendor_name != ''").all() as any[];
    for (const r of contractRows) {
      if (!seen.has(r.name)) {
        seen.add(r.name);
        insert.run(uid("org"), JSON.stringify([r.name]), "corporation", null, null, "open_canada_contracts", JSON.stringify(r), nowISO(), nowISO());
        count++;
      }
    }
  } catch { /* table may not exist */ }

  // From corporate_entities
  try {
    const corpRows = db.prepare("SELECT DISTINCT corporation_name as name, corporation_type as type, province FROM corporate_entities WHERE corporation_name IS NOT NULL AND corporation_name != ''").all() as any[];
    for (const r of corpRows) {
      if (!seen.has(r.name)) {
        seen.add(r.name);
        insert.run(uid("org"), JSON.stringify([r.name]), r.type || "corporation", null, r.province || null, "corporations_canada", JSON.stringify(r), nowISO(), nowISO());
        count++;
      }
    }
  } catch { /* table may not exist */ }

  return count;
}

// ─── Elections Data → donations ───────────────────────────────────

export function transformDonations(db: Database.Database): number {
  const del = db.prepare("DELETE FROM donations");
  del.run();
  const insert = db.prepare(`
    INSERT OR REPLACE INTO donations
      (id, donor_name, recipient_name, recipient_type, amount, currency, date,
       province, is_corporate, source, raw_data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  let count = 0;

  // From third_party_ads
  try {
    const adRows = db.prepare("SELECT * FROM third_party_ads").all() as any[];
    for (const r of adRows) {
      insert.run(
        uid("don"), r.advertiser_name || r.sponsor_name || "Unknown",
        "Elections Canada", "regulatory_body", r.amount_spent ?? 0,
        "CAD", r.period_start || nowISO().substring(0, 10),
        r.province || null, 1, "elections_canada", JSON.stringify(r), nowISO(), nowISO(),
      );
      count++;
    }
  } catch { /* table may not exist */ }

  // From third_party_spending
  try {
    const spendRows = db.prepare("SELECT * FROM third_party_spending").all() as any[];
    for (const r of spendRows) {
      insert.run(
        uid("don"), r.sponsor_name || r.organization_name || "Unknown",
        "Elections Canada", "regulatory_body", r.amount ?? 0,
        "CAD", r.date || nowISO().substring(0, 10),
        r.province || null, 1, "elections_canada", JSON.stringify(r), nowISO(), nowISO(),
      );
      count++;
    }
  } catch { /* table may not exist */ }

  return count;
}

// ─── Proactive Disclosure → disclosures ──────────────────────────

export function transformDisclosures(db: Database.Database): number {
  const del = db.prepare("DELETE FROM disclosures");
  del.run();
  const insert = db.prepare(`
    INSERT OR REPLACE INTO disclosures
      (id, person_name, position, department, year, interests,
       filing_date, source, raw_data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  let count = 0;

  try {
    const rows = db.prepare("SELECT * FROM proactive_disclosure").all() as any[];
    for (const r of rows) {
      const year = r.year ? parseInt(String(r.year), 10) : new Date().getFullYear();
      insert.run(
        uid("dis"), r.name || r.employee_name || "Unknown",
        r.position || r.title || "", r.department || "",
        year, JSON.stringify([]),
        r.date || r.filing_date || nowISO().substring(0, 10),
        "proactive_disclosure", JSON.stringify(r), nowISO(), nowISO(),
      );
      count++;
    }
  } catch { /* table may not exist */ }

  return count;
}

// ─── Global Canada Records → gac_projects ────────────────────────

export function transformGacProjects(db: Database.Database): number {
  const del = db.prepare("DELETE FROM gac_projects");
  del.run();
  const insert = db.prepare(`
    INSERT OR REPLACE INTO gac_projects
      (id, project_id, title, description, department, country, region,
       budget, currency, start_date, end_date, status,
       implementing_partners, sector, source, raw_data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  let count = 0;

  try {
    const rows = db.prepare("SELECT * FROM global_canada_records").all() as any[];
    for (const r of rows) {
        const partners = r.partner_names
          ? (typeof r.partner_names === "string"
            ? [{ name: r.partner_names }]
            : (r.partner_names as string[]).map((n: string) => ({ name: n })))
          : [];
        insert.run(
          uid("gac"), r.project_id || uid("pj"),
          r.title || r.project_name || "Global Affairs Project",
          r.description || r.summary || "",
          "Global Affairs Canada",
          r.country || r.recipient_country || "Canada",
          r.region || "International",
          r.budget ?? r.amount ?? 0, r.currency || "CAD",
          r.start_date || nowISO().substring(0, 10),
          r.end_date || null, r.status || "active",
          JSON.stringify(partners),
        r.sector || null, "gac", JSON.stringify(r), nowISO(), nowISO(),
      );
      count++;
    }
  } catch { /* table may not exist */ }

  return count;
}

// ─── Orchestrator ─────────────────────────────────────────────────

export interface EtlResult {
  lobbyingFilings: number;
  contracts: number;
  persons: number;
  organizations: number;
  donations: number;
  disclosures: number;
  gacProjects: number;
}

export function runAllTransforms(db?: Database.Database): EtlResult {
  const d = db ?? (getRawDb() as unknown as Database.Database);
  return {
    lobbyingFilings: transformLobbying(d),
    contracts: transformContracts(d),
    persons: transformPersons(d),
    organizations: transformOrganizations(d),
    donations: transformDonations(d),
    disclosures: transformDisclosures(d),
    gacProjects: transformGacProjects(d),
  };
}
