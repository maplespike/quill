// SPDX-License-Identifier: AGPL-3.0-only
/**
 * The latest-claims index must apply on a database that already has
 * citation_records, and the latest query must return the same rows.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { closeDb } from '@maplespike/database';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(here, '../../db/migrations/20261110_citation_records_latest_index.sql');
const connectionPath = path.resolve(here, '../../../../database/src/connection.ts');
const require = createRequire(path.resolve(here, '../../../../database/package.json'));
const Database = require('better-sqlite3') as typeof import('better-sqlite3');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quill-latest-index-'));
const storeDbPath = path.join(tmpDir, 'store.db');
process.env.QUILL_DB_PATH = storeDbPath;

after(() => {
  closeDb();
  delete process.env.QUILL_DB_PATH;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

import {
  CITATION_LATEST_SQL,
  CITATION_RECORDS_DDL,
  CITATION_RECORDS_LATEST_INDEX_DDL,
  citationStore,
} from '../store.js';

const OLD_TABLE = `
CREATE TABLE citation_records (
  hash TEXT PRIMARY KEY,
  serialized TEXT NOT NULL,
  citation_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

interface StoredRow {
  hash: string;
  citation_json: string;
  created_at: string;
}

function bundleJson(hash: string, claim: string): string {
  return JSON.stringify({
    claim,
    sha256: hash,
    value: { claim },
    sourceName: 'Index source',
    sourceUrl: 'https://example.ca/records',
  });
}

/** Fixed-width hex hashes so SQLite binary order matches JavaScript `<`. */
function seedRows(): StoredRow[] {
  const rows: StoredRow[] = [];
  for (let i = 0; i < 40; i++) {
    const hash = i.toString(16).padStart(64, '0');
    let created: string;
    if (i < 3) created = '2026-03-01T00:00:00.000Z';
    else if (i === 38) created = '2026-11-09T00:00:00.000Z';
    else if (i === 39) created = '2020-01-01T00:00:00.000Z';
    else {
      const day = String((i % 28) + 1).padStart(2, '0');
      const hour = String(i % 24).padStart(2, '0');
      created = `2025-01-${day}T${hour}:00:00.000Z`;
    }
    rows.push({
      hash,
      created_at: created,
      citation_json: bundleJson(hash, `claim-${i}`),
    });
  }
  return rows;
}

function insertRows(db: import('better-sqlite3').Database, rows: StoredRow[]): void {
  const insert = db.prepare(
    'INSERT INTO citation_records (hash, serialized, citation_json, created_at) VALUES (?, ?, ?, ?)',
  );
  const tx = db.transaction((items: StoredRow[]) => {
    for (const row of items) insert.run(row.hash, '{}', row.citation_json, row.created_at);
  });
  tx(rows);
}

function latestRows(db: import('better-sqlite3').Database, limit: number): StoredRow[] {
  return db.prepare(CITATION_LATEST_SQL).all(limit) as StoredRow[];
}

function planDetails(db: import('better-sqlite3').Database, limit: number): string[] {
  const rows = db.prepare(`EXPLAIN QUERY PLAN ${CITATION_LATEST_SQL}`).all(limit) as Array<{ detail: string }>;
  return rows.map((row) => row.detail);
}

function expectedHashes(rows: StoredRow[], limit: number): string[] {
  return [...rows]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0)
      || (a.hash < b.hash ? 1 : a.hash > b.hash ? -1 : 0))
    .slice(0, limit)
    .map((row) => row.hash);
}

describe('citation_records latest index migration', () => {
  it('applies on an existing table and the latest query returns the same rows', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');
    assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_citation_records_created_at_hash/);
    assert.doesNotMatch(migration, /\b(DROP|DELETE|ALTER)\b/i);
    assert.ok(migration.includes(CITATION_RECORDS_LATEST_INDEX_DDL.trim()));
    assert.ok(CITATION_RECORDS_DDL.includes(CITATION_RECORDS_LATEST_INDEX_DDL.trim()));
    const connection = fs.readFileSync(connectionPath, 'utf8');
    assert.ok(connection.includes('idx_citation_records_created_at_hash'));
    assert.ok(connection.includes('created_at DESC, hash DESC'));

    const db = new Database(path.join(tmpDir, 'migrate.db'));
    db.exec(OLD_TABLE);
    const rows = seedRows();
    insertRows(db, rows);

    const beforeIndexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'citation_records'",
    ).all() as Array<{ name: string }>;
    assert.equal(
      beforeIndexes.some((index) => index.name === 'idx_citation_records_created_at_hash'),
      false,
    );

    const before = latestRows(db, 25);
    assert.deepEqual(before.map((row) => row.hash), expectedHashes(rows, 25));
    assert.ok(planDetails(db, 25).some((detail) => detail.includes('USE TEMP B-TREE FOR ORDER BY')));

    db.exec(migration);
    db.exec(migration);

    const index = db.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_citation_records_created_at_hash'",
    ).get() as { sql: string };
    assert.match(index.sql, /created_at DESC, hash DESC/);

    const after = latestRows(db, 25);
    assert.deepEqual(after, before);

    const afterPlan = planDetails(db, 25);
    assert.equal(afterPlan.some((detail) => detail.includes('USE TEMP B-TREE FOR ORDER BY')), false);
    assert.ok(afterPlan.some((detail) => detail.includes('idx_citation_records_created_at_hash')));
    db.close();
  });

  it('applies the index when CitationStore opens an existing database', () => {
    const db = new Database(storeDbPath);
    db.exec(OLD_TABLE);
    const rows = seedRows();
    insertRows(db, rows);
    const before = latestRows(db, 25).map((row) => ({
      hash: row.hash,
      createdAt: row.created_at,
      claim: JSON.parse(row.citation_json).claim as string,
    }));
    db.close();

    const got = citationStore.latest(25);
    assert.deepEqual(
      got.map((row) => ({ hash: row.hash, createdAt: row.createdAt, claim: row.claim })),
      before,
    );

    const check = new Database(storeDbPath);
    const index = check.prepare(
      "SELECT sql FROM sqlite_master WHERE name = 'idx_citation_records_created_at_hash'",
    ).get() as { sql: string } | undefined;
    assert.ok(index);
    assert.match(index.sql, /created_at DESC, hash DESC/);
    const plan = planDetails(check, 25);
    assert.ok(plan.some((detail) => detail.includes('idx_citation_records_created_at_hash')));
    check.close();
  });
});
