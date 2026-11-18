// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getRawDb } from "../db/connection";
import { runSweep } from "./run";

const SOURCE_DDL = `
  CREATE TABLE IF NOT EXISTS lobbying_records (
    id TEXT PRIMARY KEY, registrant_name TEXT NOT NULL, registrant_client TEXT,
    registrant_address TEXT, client_name TEXT NOT NULL, client_business TEXT,
    subject_matter TEXT, government_institution TEXT, public_office_holder TEXT,
    communication_date TEXT NOT NULL, start_date TEXT, end_date TEXT,
    lobbying_cost_cad REAL, lobbyist_type TEXT DEFAULT 'consultant',
    source_url TEXT NOT NULL, ingested_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS contract_awards (
    id TEXT PRIMARY KEY, vendor_name TEXT NOT NULL, vendor_address TEXT,
    contract_value REAL NOT NULL, currency TEXT DEFAULT 'CAD', award_date TEXT NOT NULL,
    start_date TEXT, end_date TEXT, description TEXT, department TEXT NOT NULL,
    department_acronym TEXT, procurement_method TEXT, gsin TEXT, trade_agreement TEXT,
    bids_received INTEGER, source_url TEXT NOT NULL, is_sole_source INTEGER DEFAULT 0,
    ingested_at TEXT NOT NULL
  );
`;

function useTempDb(): string {
  closeDb();
  const dir = mkdtempSync(join(tmpdir(), "engine-sweep-"));
  const path = join(dir, "quill.db");
  process.env.QUILL_DB_PATH = path;
  return path;
}

describe("engine sweep", () => {
  afterEach(() => {
    closeDb();
    delete process.env.QUILL_DB_PATH;
  });

  it("produces no brief when the store has no canonical records", () => {
    useTempDb();
    const sweep = runSweep();
    assertNoBrief(sweep.briefId);
    expectZero(sweep.records);
  });

  it("writes a brief from seeded lobbying and contract rows", () => {
    useTempDb();
    runSweep();
    const db = getRawDb();
    db.exec(SOURCE_DDL);
    const now = new Date().toISOString();
    db.prepare("INSERT INTO lobbying_records VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
      "lob-1", "Jane Lobbyist", "Acme Consulting", "123 Main St", "Acme Corp", "Defence",
      "Procurement", "DND", "Minister of National Defence", now, now, now, 50000,
      "consultant", "https://lobbycanada.gc.ca/example", now,
    );
    db.prepare("INSERT INTO contract_awards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
      "ca-1", "Acme Corp", "123 Main", 15000000, "CAD", now, now, null,
      "IT modernization", "DND", "DND", "Competitive", "GSIN-123", "CFTA", 3,
      "https://open.canada.ca/data/en/dataset/d8f85d91-7dec-4fd1-8055-483b77225d8b", 0, now,
    );

    const sweep = runSweep();
    if (!sweep.briefId) {
      throw new Error(`expected a brief, records=${sweep.records} signals=${sweep.signals}`);
    }
    const row = db.prepare("SELECT id, generated_at FROM briefs WHERE id = ?").get(sweep.briefId) as
      | { id: string; generated_at: string }
      | undefined;
    if (!row?.generated_at) throw new Error("brief row missing generated_at");
  });
});

function assertNoBrief(briefId: string | null): void {
  if (briefId) throw new Error(`empty store must not write a brief (${briefId})`);
}

function expectZero(records: number): void {
  if (records !== 0) throw new Error(`expected 0 records, got ${records}`);
}
