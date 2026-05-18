import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { unlinkSync } from 'node:fs';

describe('@maplespike/database connection', () => {
  const TEST_DB = '/tmp/maplespike-test.db';
  const SCHEMA_DB = '/tmp/maplespike-schema-test.db';

  after(() => {
    try { unlinkSync(TEST_DB); } catch {}
    try { unlinkSync(SCHEMA_DB); } catch {}
  });

  it('createDb opens SQLite database at path', async () => {
    const { createDb } = await import('../connection.js');
    const db = createDb(TEST_DB);
    assert.ok(db, 'createDb should return a Drizzle client');
    assert.equal(typeof (db as any).select, 'function', 'db should have select method');
  });

  it('createDb with :memory: works', async () => {
    const { createDb } = await import('../connection.js');
    const db = createDb(':memory:');
    assert.ok(db);
  });

  it('runMigrations creates all required tables', async () => {
    const { createDb, runMigrations, getRawFromDb } = await import('../connection.js');
    const db = createDb(SCHEMA_DB);
    runMigrations(db);
    const raw = getRawFromDb(db);

    const tables = raw.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as Array<{ name: string }>;

    const names = tables.map(t => t.name);
    assert.ok(names.includes('persons'), 'persons table');
    assert.ok(names.includes('organizations'), 'organizations table');
    assert.ok(names.includes('contracts'), 'contracts table');
    assert.ok(names.includes('graph_nodes'), 'graph_nodes table');
    assert.ok(names.includes('graph_edges'), 'graph_edges table');
    assert.ok(names.includes('entities'), 'entities table');
    assert.ok(names.includes('entity_aliases'), 'entity_aliases table');
    assert.ok(names.includes('entity_links'), 'entity_links table');
    assert.ok(names.includes('briefs'), 'briefs table');
    assert.ok(names.includes('intelligence_threads'), 'intelligence_threads table');
  });

  it('getRawFromDb extracts better-sqlite3 instance', async () => {
    const { createDb, getRawFromDb } = await import('../connection.js');
    const db = createDb(':memory:');
    const raw = getRawFromDb(db);
    assert.ok(raw, 'raw db should exist');
    assert.equal(typeof raw.prepare, 'function', 'raw should have prepare method');
  });
});
