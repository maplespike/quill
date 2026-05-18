import { describe, expect, it, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { unlinkSync } from "node:fs";

const TEST_DB = "/tmp/maplespike-entity-migration-test.db";

beforeAll(() => {
  try { unlinkSync(TEST_DB); } catch {}
  const sqlite = new Database(TEST_DB);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS persons (
      id TEXT PRIMARY KEY, names TEXT NOT NULL, first_name TEXT, last_name TEXT,
      email TEXT, province TEXT, city TEXT, source TEXT NOT NULL,
      raw_data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY, names TEXT NOT NULL, type TEXT NOT NULL,
      industry TEXT, province TEXT, city TEXT, website TEXT, parent_organization_id TEXT,
      source TEXT NOT NULL, raw_data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const insP = sqlite.prepare(
    "INSERT INTO persons (id, names, first_name, last_name, province, source, raw_data) VALUES (?, ?, ?, ?, ?, ?, '{}')"
  );
  insP.run("p1", JSON.stringify(["Justin Trudeau"]), "Justin", "Trudeau", "QC", "test");
  insP.run("p2", JSON.stringify(["Justin P.J. Trudeau"]), "Justin", "Trudeau", "QC", "test");
  insP.run("p3", JSON.stringify(["Mark Carney"]), "Mark", "Carney", "ON", "test");
  insP.run("p4", JSON.stringify(["Mark J. Carney"]), "Mark", "Carney", "ON", "test");
  insP.run("p5", JSON.stringify(["Pierre Poilievre"]), "Pierre", "Poilievre", "ON", "test");

  const insO = sqlite.prepare(
    "INSERT INTO organizations (id, names, type, province, source, raw_data) VALUES (?, ?, ?, ?, ?, '{}')"
  );
  insO.run("o1", JSON.stringify(["Department of National Defence"]), "federal", "ON", "test");
  insO.run("o2", JSON.stringify(["DND"]), "federal", "ON", "test");
  insO.run("o3", JSON.stringify(["National Defence"]), "federal", "ON", "test");
  insO.run("o4", JSON.stringify(["Global Affairs Canada"]), "federal", "ON", "test");
  insO.run("o5", JSON.stringify(["GAC"]), "federal", "ON", "test");

  sqlite.close();
});

afterAll(() => {
  try { unlinkSync(TEST_DB); } catch {}
});

describe("entity resolution migration", () => {
  it("resolves aliases, writes entities and links", async () => {
    const { runEntityResolution } = await import("./resolve");
    const { createDb, runMigrations } = await import("@maplespike/database");
    const db = createDb(TEST_DB);
    runMigrations(db);
    const rawDb = (db as unknown as { $client: import("better-sqlite3").Database }).$client;
    await runEntityResolution(db, rawDb);

    const raw = (db as unknown as { $client: import("better-sqlite3").Database }).$client;

    const entities = raw.prepare(
      "SELECT id, canonical_name, type FROM entities ORDER BY type, canonical_name"
    ).all() as Array<{ id: string; canonical_name: string; type: string }>;

    expect(entities.filter(e => e.type === "person").map(e => e.canonical_name).sort())
      .toEqual(["Justin Trudeau", "Mark Carney", "Pierre Poilievre"]);
    expect(entities.filter(e => e.type === "org").map(e => e.canonical_name).sort())
      .toEqual(["Department of National Defence", "Global Affairs Canada"]);

    const aliases = raw.prepare(
      "SELECT alias, type FROM entity_aliases"
    ).all() as Array<{ alias: string; type: string }>;

    const aliasNames = aliases.map(a => a.alias);
    expect(aliasNames).toContain("Justin P.J. Trudeau");
    expect(aliasNames).toContain("Mark J. Carney");
    expect(aliasNames).toContain("DND");
    expect(aliasNames).toContain("National Defence");
    expect(aliasNames).toContain("GAC");

    const links = raw.prepare(
      "SELECT link_type FROM entity_links"
    ).all() as Array<{ link_type: string }>;

    expect(links.some(l => l.link_type === "shared_province")).toBe(true);
  });
});
