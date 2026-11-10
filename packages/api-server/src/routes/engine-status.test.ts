// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { readEngineStatusFromSqlite } from './engine-status.js';

function tempDb(): string {
  return join(mkdtempSync(join(tmpdir(), 'engine-status-')), 'quill.db');
}

describe('readEngineStatusFromSqlite', () => {
  it('reports operational and lastRun from a briefs row', () => {
    const path = tempDb();
    const db = new Database(path);
    db.exec(`
      CREATE TABLE briefs (
        id TEXT PRIMARY KEY,
        title TEXT,
        summary TEXT,
        generated_at TEXT
      );
    `);
    db.prepare('INSERT INTO briefs (id, title, summary, generated_at) VALUES (?, ?, ?, ?)').run(
      'brief-1',
      'Daily brief',
      'Summary with source links.',
      '2026-10-26T03:00:00.000Z',
    );
    db.close();

    const status = readEngineStatusFromSqlite(path);
    assert.equal(status.engine.status, 'operational');
    assert.equal(status.engine.lastRun, '2026-10-26T03:00:00.000Z');
    assert.equal(status.tables.briefs, 1);
  });

  it('reports never_run when the file has no engine tables', () => {
    const path = tempDb();
    const db = new Database(path);
    db.exec('CREATE TABLE unrelated (id TEXT)');
    db.close();

    const status = readEngineStatusFromSqlite(path);
    assert.equal(status.engine.status, 'never_run');
    assert.equal(status.engine.lastRun, null);
    assert.equal(status.tables.briefs, 0);
    assert.equal(status.totalRecords, 0);
  });

  it('reports never_run when the database file is missing', () => {
    const status = readEngineStatusFromSqlite(join(tmpdir(), 'missing-quill-engine.db'));
    assert.equal(status.engine.status, 'never_run');
    assert.equal(status.engine.lastRun, null);
  });
});
