/**
 * Ingestion freshness ledger (#889 readiness, 2026-09-22).
 *
 * The deployed API reported `fresh: 0, stale: 0` for every module because
 * freshness depended on an in-process singleton the API never feeds. These tests
 * pin the ledger that fixes it — including the failure paths that matter:
 * a corrupt file must not throw, and a failed run must not erase the last
 * known good timestamp.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { recordIngest, readLedger, getIngestRecord, ledgerFilePath } from '../ingest-ledger.js';
import { requireInternalAuth, generateInternalToken } from '../middleware/internal-auth.js';

function tmpLedger(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quill-ledger-'));
  return path.join(dir, 'ingest-ledger.json');
}

test('a success records the timestamp, count and run', () => {
  const file = tmpLedger();
  const entry = recordIngest({ module: 'statcan-wds', status: 'success', records: 42 }, file);
  assert.ok(entry.lastSuccess, 'lastSuccess must be set');
  assert.equal(entry.records, 42);
  assert.equal(entry.runs, 1);
  assert.equal(entry.failures, 0);
  assert.equal(getIngestRecord('statcan-wds', file)?.records, 42);
});

test('a failure keeps the last known good timestamp (data does not become "never ingested")', () => {
  const file = tmpLedger();
  recordIngest({ module: 'm', status: 'success', at: '2026-09-01T00:00:00.000Z', records: 5 }, file);
  const after = recordIngest({ module: 'm', status: 'failure', at: '2026-09-22T00:00:00.000Z', error: 'upstream 503' }, file);
  assert.equal(after.lastSuccess, '2026-09-01T00:00:00.000Z', 'the good timestamp must survive');
  assert.equal(after.lastError, '2026-09-22T00:00:00.000Z');
  assert.equal(after.lastErrorMessage, 'upstream 503');
  assert.equal(after.runs, 2);
  assert.equal(after.failures, 1);
});

test('a corrupt ledger reads as empty and never throws', () => {
  const file = tmpLedger();
  fs.writeFileSync(file, '{ this is not json', 'utf8');
  assert.deepEqual(readLedger(file), {});
  const entry = recordIngest({ module: 'after-corruption', status: 'success' }, file);
  assert.ok(entry.lastSuccess, 'a corrupt file must not block recording');
});

test('writes are atomic — no temp file is left behind', () => {
  const file = tmpLedger();
  recordIngest({ module: 'm', status: 'success' }, file);
  assert.equal(fs.existsSync(`${file}.tmp`), false, 'the temp file must be renamed away');
  assert.ok(fs.existsSync(file));
});

test('the default path sits beside the SQLite database', () => {
  const prev = process.env.QUILL_DB_PATH;
  process.env.QUILL_DB_PATH = '/var/lib/quill/quill.db';
  try {
    assert.equal(ledgerFilePath(), '/var/lib/quill/ingest-ledger.json');
  } finally {
    if (prev === undefined) delete process.env.QUILL_DB_PATH;
    else process.env.QUILL_DB_PATH = prev;
  }
});

test('the endpoint guard refuses an unconfigured secret and a bad token', () => {
  const notConfigured = requireInternalAuth(undefined)(new Request('http://x/v1/internal/ingest-report'));
  assert.equal(notConfigured.ok, false);
  if (!notConfigured.ok) assert.equal(notConfigured.response.status, 500);

  const guard = requireInternalAuth('a'.repeat(48));
  const anon = guard(new Request('http://x/v1/internal/ingest-report'));
  assert.equal(anon.ok, false);
  if (!anon.ok) assert.equal(anon.response.status, 403);

  const token = generateInternalToken('ingest', 'a'.repeat(48));
  const ok = guard(new Request('http://x/v1/internal/ingest-report', { headers: { 'X-Internal-Token': token } }));
  assert.equal(ok.ok, true, 'a valid internal token must pass');
});
