/**
 * The Worker entry itself — the branches index.ts owns before the pipeline runs.
 *
 * Every case goes through the default export (`fetch`), which is the surface a
 * Worker binding or the dev server actually calls, not `handleRequest`. What is
 * pinned here is the entry: env mapping and config validation, and which storage
 * backend each environment selects. Dispatch is routes-smoke.test.ts and the
 * pre-routing guards are pipeline-guards.test.ts.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import app from '../index.js';
import type { Env } from '../types.js';

function entry(path: string, env: Record<string, unknown> = {}, init: RequestInit = {}) {
  return app.fetch(new Request(`http://entry.test${path}`, init), env as unknown as Env);
}

/** A D1/KV stand-in that records the SQL it is asked to prepare. */
function bindingStub() {
  const prepared = (): Record<string, unknown> => ({
    bind: () => prepared(),
    first: async () => null,
    all: async () => ({ results: [] }),
    run: async () => ({ success: true }),
  });
  const preparedSql: string[] = [];
  return {
    preparedSql,
    db: { prepare: (sql: string) => { preparedSql.push(sql); return prepared(); } },
    kv: { get: async () => null, put: async () => {}, delete: async () => {} },
  };
}

describe('worker entry', () => {
  it('answers 500 CONFIG_ERROR when production config does not validate', async () => {
    const res = await entry('/v1/health', { ENVIRONMENT: 'production' });

    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'CONFIG_ERROR');
    assert.match(body.error.message, /JWT_SECRET/);
    assert.ok(body.error.message_fr.length > 0, 'the config error is bilingual');
  });

  it('serves the pipeline once production config validates', async () => {
    const res = await entry('/v1/health', { ENVIRONMENT: 'production', JWT_SECRET: 'a'.repeat(48) });
    assert.equal(res.status, 200);
  });

  it('falls back to in-memory storage when no backend is configured', async () => {
    const res = await entry('/v1/health');
    assert.equal(res.status, 200);
    assert.equal((await res.json()).data.status, 'ok');
  });

  it('uses the D1 binding when one is provided', async () => {
    const { db, kv, preparedSql } = bindingStub();
    const res = await entry('/v1/keys', { DB: db, CACHE: kv }, { headers: { Authorization: 'Bearer entry-test' } });

    // The stub answers no rows, so the key gate rejects — and only D1Storage
    // ever asks the binding to prepare that lookup.
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error.code, 'UNAUTHORIZED');
    assert.ok(preparedSql.length > 0, 'the D1 binding was never queried, so it was not the selected backend');
  });

  it('uses a file-backed SQLite store when QUILL_DB_PATH is set', async (t) => {
    const dbPath = join(tmpdir(), `quill-entry-${process.pid}-${Date.now()}.db`);
    const saved = process.env.QUILL_DB_PATH;
    process.env.QUILL_DB_PATH = dbPath;
    t.after(() => {
      if (saved === undefined) delete process.env.QUILL_DB_PATH;
      else process.env.QUILL_DB_PATH = saved;
      if (existsSync(dbPath)) rmSync(dbPath);
    });

    const res = await entry('/v1/health', { QUILL_STORAGE: 'sqlite' });
    assert.equal(res.status, 200);
    assert.ok(existsSync(dbPath), `no database was opened at ${dbPath}, so the SQLite backend was not selected`);
  });

  it('hands off to Postgres when DATABASE_URL is set', async () => {
    // Port 1 refuses immediately: this pins which backend the entry selects, not
    // that Postgres answers — no test may depend on a live server.
    await assert.rejects(
      entry('/v1/health', { DATABASE_URL: 'postgresql://127.0.0.1:1/none' }),
      /ECONNREFUSED/,
    );
  });
});
