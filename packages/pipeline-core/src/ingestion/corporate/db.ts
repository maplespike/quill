// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Corporate Database — Quill
 *
 * D1 SQLite persistence for corporate data:
 *   - lobbying_records (federal lobbying registry)
 *   - contract_awards (government procurement)
 *   - executive_statements (CEO/executive public statements)
 *
 * Uses the same D1 API pattern as the committee DB module.
 */

import type { D1Database } from '../committees/db.js';
import type { LobbyingRecord, ContractAward, ExecutiveStatement } from './types.js';

/* ------------------------------------------------------------------ */
/*  DDL                                                                */
/* ------------------------------------------------------------------ */

export const CORPORATE_DDL = `
CREATE TABLE IF NOT EXISTS lobbying_records (
  id TEXT PRIMARY KEY,
  registrant_name TEXT NOT NULL,
  registrant_client TEXT,
  registrant_address TEXT,
  client_name TEXT NOT NULL,
  client_business TEXT,
  subject_matter TEXT,
  government_institution TEXT,
  public_office_holder TEXT,
  communication_date TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  lobbying_cost_cad REAL,
  lobbyist_type TEXT DEFAULT 'consultant',
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  UNIQUE(registrant_name, client_name, communication_date, subject_matter)
);

CREATE INDEX IF NOT EXISTS idx_lobbying_client ON lobbying_records(client_name);
CREATE INDEX IF NOT EXISTS idx_lobbying_date ON lobbying_records(communication_date DESC);
CREATE INDEX IF NOT EXISTS idx_lobbying_institution ON lobbying_records(government_institution);
CREATE INDEX IF NOT EXISTS idx_lobbying_subject ON lobbying_records(subject_matter);

CREATE TABLE IF NOT EXISTS contract_awards (
  id TEXT PRIMARY KEY,
  vendor_name TEXT NOT NULL,
  vendor_address TEXT,
  contract_value REAL NOT NULL,
  currency TEXT DEFAULT 'CAD',
  award_date TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  description TEXT,
  department TEXT NOT NULL,
  department_acronym TEXT,
  procurement_method TEXT,
  gsin TEXT,
  trade_agreement TEXT,
  bids_received INTEGER,
  source_url TEXT NOT NULL,
  is_sole_source INTEGER DEFAULT 0,
  ingested_at TEXT NOT NULL,
  UNIQUE(vendor_name, department, award_date, contract_value)
);

CREATE INDEX IF NOT EXISTS idx_contract_vendor ON contract_awards(vendor_name);
CREATE INDEX IF NOT EXISTS idx_contract_department ON contract_awards(department);
CREATE INDEX IF NOT EXISTS idx_contract_date ON contract_awards(award_date DESC);
CREATE INDEX IF NOT EXISTS idx_contract_sole_source ON contract_awards(is_sole_source);
CREATE INDEX IF NOT EXISTS idx_contract_value ON contract_awards(contract_value DESC);

CREATE TABLE IF NOT EXISTS executive_statements (
  id TEXT PRIMARY KEY,
  executive_name TEXT NOT NULL,
  executive_title TEXT,
  organization TEXT NOT NULL,
  organization_ticker TEXT,
  statement_type TEXT NOT NULL,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  excerpt TEXT,
  source_url TEXT NOT NULL,
  topics TEXT,
  is_committee_appearance INTEGER DEFAULT 0,
  committee_meeting_id TEXT,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exec_org ON executive_statements(organization);
CREATE INDEX IF NOT EXISTS idx_exec_name ON executive_statements(executive_name);
CREATE INDEX IF NOT EXISTS idx_exec_type ON executive_statements(statement_type);
CREATE INDEX IF NOT EXISTS idx_exec_date ON executive_statements(date DESC);
CREATE INDEX IF NOT EXISTS idx_exec_committee ON executive_statements(committee_meeting_id);

-- corporate_entities: written by ingestCorporationsCanada() but missing from
-- this DDL, so every insert failed with "no such table". PK is required for
-- the INSERT OR REPLACE the ingester issues.
CREATE TABLE IF NOT EXISTS corporate_entities (
  corporation_number TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL,
  operating_names TEXT,
  jurisdiction TEXT,
  status TEXT,
  incorporation_date TEXT,
  office_address TEXT,
  directors TEXT,
  last_annual_return TEXT,
  source_url TEXT,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_corp_legal_name ON corporate_entities(legal_name);
CREATE INDEX IF NOT EXISTS idx_corp_status ON corporate_entities(status);
`;

/* ------------------------------------------------------------------ */
/*  Lobbying Records                                                   */
/* ------------------------------------------------------------------ */

/**
 * Upsert a single lobbying record.
 * Uses INSERT OR IGNORE to avoid duplicates based on the UNIQUE constraint.
 */
export async function upsertLobbyingRecord(
  db: D1Database,
  record: LobbyingRecord,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO lobbying_records
      (id, registrant_name, registrant_client, registrant_address,
       client_name, client_business, subject_matter,
       government_institution, public_office_holder,
       communication_date, start_date, end_date,
       lobbying_cost_cad, lobbyist_type,
       source_url, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    record.registrantName,
    record.registrantClient,
    record.registrantAddress,
    record.clientName,
    record.clientBusiness,
    Array.isArray(record.subjectMatter) ? record.subjectMatter.join(', ') : record.subjectMatter,
    record.governmentInstitution,
    record.publicOfficeHolder,
    record.communicationDate,
    record.startDate,
    record.endDate,
    record.lobbyingCostCad,
    record.lobbyistType,
    record.sourceUrl,
    record.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}

/**
 * Batch upsert lobbying records.
 * Returns the number of successfully inserted records.
 */
export async function upsertLobbyingRecords(
  db: D1Database,
  records: LobbyingRecord[],
): Promise<number> {
  let count = 0;
  for (const record of records) {
    try {
      const ok = await upsertLobbyingRecord(db, record);
      if (ok) count++;
    } catch {
      // Individual record failures are non-fatal; skip and continue
    }
  }
  return count;
}

/* ------------------------------------------------------------------ */
/*  Contract Awards                                                    */
/* ------------------------------------------------------------------ */

/**
 * Upsert a single contract award.
 * Uses INSERT OR IGNORE to avoid duplicates.
 */
export async function upsertContractAward(
  db: D1Database,
  award: ContractAward,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO contract_awards
      (id, vendor_name, vendor_address, contract_value, currency,
       award_date, start_date, end_date, description,
       department, department_acronym, procurement_method,
       gsin, trade_agreement, bids_received,
       source_url, is_sole_source, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    award.id,
    award.vendorName,
    award.vendorAddress,
    award.contractValue,
    award.currency,
    award.awardDate,
    award.startDate,
    award.endDate,
    award.description,
    award.department,
    award.departmentAcronym,
    award.procurementMethod,
    award.gsin,
    award.tradeAgreement,
    award.bidsReceived,
    award.sourceUrl,
    award.isSoleSource ? 1 : 0,
    award.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}

/**
 * Batch upsert contract awards.
 * Returns the number of successfully inserted records.
 */
export async function upsertContractAwards(
  db: D1Database,
  awards: ContractAward[],
): Promise<number> {
  let count = 0;
  for (const award of awards) {
    try {
      const ok = await upsertContractAward(db, award);
      if (ok) count++;
    } catch {
      // Individual failures are non-fatal
    }
  }
  return count;
}

/* ------------------------------------------------------------------ */
/*  Executive Statements                                               */
/* ------------------------------------------------------------------ */

/**
 * Upsert a single executive statement.
 * Uses INSERT OR IGNORE to avoid duplicates.
 */
export async function upsertExecutiveStatement(
  db: D1Database,
  statement: ExecutiveStatement,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO executive_statements
      (id, executive_name, executive_title, organization, organization_ticker,
       statement_type, date, title, text, excerpt,
       source_url, topics, is_committee_appearance, committee_meeting_id, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    statement.id,
    statement.executiveName,
    statement.executiveTitle,
    statement.organization,
    statement.organizationTicker,
    statement.statementType,
    statement.date,
    statement.title,
    statement.text,
    statement.excerpt,
    statement.sourceUrl,
    Array.isArray(statement.topics) ? statement.topics.join(', ') : statement.topics,
    statement.isCommitteeAppearance ? 1 : 0,
    statement.committeeMeetingId,
    statement.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}

/**
 * Batch upsert executive statements.
 * Returns the number of successfully inserted records.
 */
export async function upsertExecutiveStatements(
  db: D1Database,
  statements: ExecutiveStatement[],
): Promise<number> {
  let count = 0;
  for (const stmt of statements) {
    try {
      const ok = await upsertExecutiveStatement(db, stmt);
      if (ok) count++;
    } catch {
      // Individual failures are non-fatal
    }
  }
  return count;
}
