import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { dropSediInsiderPostgres, dropSediInsiderSqlite } from '../src/migrations/003_drop_sedi_insider.ts';

function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE insider_transactions (
      id TEXT PRIMARY KEY,
      insider_name TEXT NOT NULL,
      source_url TEXT NOT NULL
    );
    INSERT INTO insider_transactions VALUES
      ('a', 'Ada', 'https://www.sedi.ca/report/1'),
      ('b', 'Bea', 'https://www.sedi.ca/report/2');

    CREATE TABLE citation_records (
      hash TEXT PRIMARY KEY,
      serialized TEXT NOT NULL,
      citation_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    INSERT INTO citation_records VALUES
      ('sedi-hash', '{"source":"sedi-insider-transactions"}', '{"sourceName":"sedi","claim":"sedi: Ada","sourceUrl":"https://www.sedi.ca/report/1"}', '2026-01-01'),
      ('other-hash', '{"title":"lobbying"}', '{"sourceName":"lobbying","claim":"lobbying: Acme","sourceUrl":"https://lobbycanada.gc.ca/1"}', '2026-01-01');

    CREATE TABLE entity_mentions (
      entity_id TEXT,
      module_name TEXT,
      source_table TEXT,
      source_url TEXT
    );
    INSERT INTO entity_mentions VALUES
      ('e1', 'sedi', 'insider_transactions', 'https://www.sedi.ca/report/1'),
      ('e2', 'lobbying', 'lobbying_records', 'https://lobbycanada.gc.ca/1');

    CREATE TABLE entity_links (
      source_entity_id TEXT,
      target_entity_id TEXT,
      source TEXT
    );
    INSERT INTO entity_links VALUES ('e1', 'e2', 'sedi'), ('e3', 'e2', 'lobbying');

    CREATE TABLE ingest_runs (pipeline TEXT, status TEXT);
    INSERT INTO ingest_runs VALUES ('sedi', 'success'), ('all:sedi', 'success'), ('corporate', 'success');
  `);
  return db;
}

describe('drop SEDI insider data', () => {
  it('deletes insider rows, SEDI citations, and graph rows, then is safe to run again', () => {
    const db = fixture();
    const first = dropSediInsiderSqlite(db);
    assert.equal(first.insiderTableDropped, true);
    assert.equal(first.citationRows, 1);
    assert.equal(first.mentionRows, 1);
    assert.equal(first.linkRows, 1);
    assert.equal(first.ingestRunRows, 2);

    const tables = db.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'insider_transactions'`,
    ).all();
    assert.equal(tables.length, 0);

    const citations = db.prepare('SELECT hash FROM citation_records ORDER BY hash').all() as { hash: string }[];
    assert.deepEqual(citations.map((row) => row.hash), ['other-hash']);

    const mentions = db.prepare('SELECT module_name FROM entity_mentions').all() as { module_name: string }[];
    assert.deepEqual(mentions.map((row) => row.module_name), ['lobbying']);

    const links = db.prepare('SELECT source FROM entity_links').all() as { source: string }[];
    assert.deepEqual(links.map((row) => row.source), ['lobbying']);

    const runs = db.prepare('SELECT pipeline FROM ingest_runs').all() as { pipeline: string }[];
    assert.deepEqual(runs.map((row) => row.pipeline), ['corporate']);

    const second = dropSediInsiderSqlite(db);
    assert.equal(second.insiderTableDropped, false);
    assert.equal(second.citationRows, 0);
    assert.equal(second.mentionRows, 0);
    assert.equal(second.linkRows, 0);
    assert.equal(second.ingestRunRows, 0);
    const still = db.prepare('SELECT hash FROM citation_records').all() as { hash: string }[];
    assert.deepEqual(still.map((row) => row.hash), ['other-hash']);
  });

  it('postgres path drops the same rows and survives a second run', async () => {
    const tables = new Map<string, Array<Record<string, string>>>([
      ['insider_transactions', [{ id: 'a' }]],
      ['citation_records', [
        { hash: 'sedi-hash', citation_json: '{"sourceName":"sedi"}', serialized: '{}' },
        { hash: 'other-hash', citation_json: '{"sourceName":"lobbying"}', serialized: '{}' },
      ]],
      ['entity_mentions', []],
      ['entity_links', []],
      ['ingest_runs', []],
    ]);
    const query: Parameters<typeof dropSediInsiderPostgres>[0] = async (sql) => {
      if (sql.startsWith('SELECT to_regclass')) {
        const name = sql.includes('$1') ? '' : '';
        // The name is the bound parameter. Tests pass it as the only arg via the wrapper below.
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };

    // Drive the real predicate with a tiny in-memory stand-in that honours $1.
    const seen: string[] = [];
    const smart: Parameters<typeof dropSediInsiderPostgres>[0] = async (sql, params = []) => {
      seen.push(sql);
      if (sql.startsWith('SELECT to_regclass')) {
        const name = String(params[0]);
        return { rows: [{ reg: tables.has(name) ? name : null }], rowCount: 1 };
      }
      if (sql.startsWith('DELETE FROM citation_records')) {
        const before = tables.get('citation_records')!.length;
        tables.set('citation_records', tables.get('citation_records')!.filter((row) => !row.citation_json.includes('"sedi"')));
        return { rows: [], rowCount: before - tables.get('citation_records')!.length };
      }
      if (sql.startsWith('DELETE FROM')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.startsWith('DROP TABLE')) {
        tables.delete('insider_transactions');
        return { rows: [], rowCount: 0 };
      }
      return query(sql, params);
    };

    const first = await dropSediInsiderPostgres(smart);
    assert.equal(first.insiderTableDropped, true);
    assert.equal(first.citationRows, 1);
    assert.equal(tables.has('insider_transactions'), false);
    assert.equal(tables.get('citation_records')!.length, 1);

    const second = await dropSediInsiderPostgres(smart);
    assert.equal(second.insiderTableDropped, false);
    assert.equal(second.citationRows, 0);
    assert.ok(seen.some((sql) => sql.startsWith('DROP TABLE IF EXISTS insider_transactions')));
  });
});
