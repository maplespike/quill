import { describe, expect, it, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { unlinkSync } from "node:fs";

const TEST_DB = "/tmp/maplespike-graph-migration-test.db";

beforeAll(() => {
  try { unlinkSync(TEST_DB); } catch {}
  const sqlite = new Database(TEST_DB);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY, canonical_name TEXT NOT NULL, type TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 1, metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS entity_aliases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id TEXT NOT NULL REFERENCES entities(id),
      alias TEXT NOT NULL, type TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'resolution',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const insE = sqlite.prepare(
    "INSERT INTO entities (id, canonical_name, type, confidence, metadata) VALUES (?, ?, ?, ?, ?)"
  );
  insE.run("ent-person-trudeau", "Justin Trudeau", "person", 1.0, JSON.stringify({ province: "QC", sources: ["test"] }));
  insE.run("ent-person-carney", "Mark Carney", "person", 1.0, JSON.stringify({ province: "ON", sources: ["test"] }));
  insE.run("ent-org-dnd", "Department of National Defence", "org", 1.0, JSON.stringify({ province: "ON", orgType: "federal", sources: ["test"] }));
  insE.run("ent-org-gac", "Global Affairs Canada", "org", 1.0, JSON.stringify({ province: "ON", orgType: "federal", sources: ["test"] }));

  const insA = sqlite.prepare(
    "INSERT INTO entity_aliases (entity_id, alias, type, source) VALUES (?, ?, ?, ?)"
  );
  insA.run("ent-person-trudeau", "Justin P.J. Trudeau", "person", "migration");
  insA.run("ent-org-dnd", "DND", "org", "migration");
  insA.run("ent-org-gac", "GAC", "org", "migration");

  sqlite.close();
});

afterAll(() => {
  try { unlinkSync(TEST_DB); } catch {}
});

describe("graph builder migration", () => {
  it("builds graph nodes from entities and persists them", async () => {
    const { buildAndPersistGraph } = await import("./build-graph");
    const { createDb, runMigrations, getRawFromDb } = await import("@maplespike/database");
    const db = createDb(TEST_DB);
    runMigrations(db);
    await buildAndPersistGraph(db, getRawFromDb(db));

    const raw = getRawFromDb(db);

    const nodes = raw.prepare(
      "SELECT id, type, label FROM graph_nodes ORDER BY type, label"
    ).all() as Array<{ id: string; type: string; label: string }>;

    expect(nodes.length).toBeGreaterThanOrEqual(4);
    const personNodes = nodes.filter(n => n.type === "person").map(n => n.label).sort();
    expect(personNodes).toEqual(["Justin Trudeau", "Mark Carney"]);
    const orgNodes = nodes.filter(n => n.type === "organization").map(n => n.label).sort();
    expect(orgNodes).toEqual(["Department of National Defence", "Global Affairs Canada"]);

    const edges = raw.prepare(
      "SELECT id, source_node, target_node, type FROM graph_edges"
    ).all() as Array<{ id: string; source_node: string; target_node: string; type: string }>;

    expect(edges.length).toBeGreaterThanOrEqual(2);
    const partneredEdges = edges.filter(e => e.type === "partnered_with");
    expect(partneredEdges.length).toBeGreaterThanOrEqual(2);
  });
});
