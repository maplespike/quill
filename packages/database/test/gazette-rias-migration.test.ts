import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  applyGazetteRiasCapSqlite,
  applyGazetteRiasCapPostgres,
  applyGazetteRiasCapD1,
  applyGazetteRiasCapMemory,
} from '../src/gazette-rias-migration.ts';

test('sqlite migration caps rias_text at 300 characters and is idempotent', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE gazette_records (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      rias_text TEXT,
      html_url TEXT NOT NULL
    );
    INSERT INTO gazette_records (id, title, description, rias_text, html_url)
    VALUES ('g1', 'SOR/2026-1', 'A proposed rule.', '${'B'.repeat(450)}', 'https://gazette.gc.ca/example');
  `);

  applyGazetteRiasCapSqlite(db);
  applyGazetteRiasCapSqlite(db);

  const row = db.prepare('SELECT title, description, rias_text, html_url FROM gazette_records').get() as {
    title: string;
    description: string;
    rias_text: string;
    html_url: string;
  };
  assert.equal(row.title, 'SOR/2026-1');
  assert.equal(row.description, 'A proposed rule.');
  assert.equal(row.rias_text.length, 300);
  assert.equal(row.rias_text, 'B'.repeat(300));
  assert.equal(row.html_url, 'https://gazette.gc.ca/example');
  db.close();
});

test('sqlite migration skips a database with no gazette table', () => {
  const db = new DatabaseSync(':memory:');
  applyGazetteRiasCapSqlite(db);
  db.close();
});

test('postgres migration issues the 300-character cap when the column exists', async () => {
  const updates: string[] = [];
  await applyGazetteRiasCapPostgres({
    async query(sql: string) {
      if (sql.includes('information_schema.tables')) return { rows: [{ ok: 1 }] };
      if (sql.includes('information_schema.columns')) return { rows: [{ column_name: 'rias_text' }] };
      updates.push(sql);
      return { rows: [] };
    },
  });
  assert.equal(updates.length, 1);
  assert.match(updates[0], /substring\(rias_text from 1 for 300\)/);
});

test('D1 migration caps rias_text', async () => {
  const ran: string[] = [];
  await applyGazetteRiasCapD1({
    prepare(sql: string) {
      return {
        bind() {
          return {
            async first() {
              return { name: 'gazette_records' };
            },
            async all() {
              return { results: [{ name: 'rias_text' }] };
            },
            async run() {
              ran.push(sql);
            },
          };
        },
      };
    },
  });
  assert.equal(ran.length, 1);
  assert.match(ran[0], /substr\(rias_text, 1, 300\)/);
});

test('memory backend migration is a no-op', () => {
  applyGazetteRiasCapMemory();
});
