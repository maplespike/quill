/**
 * Regression for issue #796.
 *
 * The Toronto cache-fallback flake was a read-while-write race: a second
 * node:sqlite connection held the write lock, `busy_timeout` was 0, and
 * `saveMunicipalRecordCache` swallowed `database is locked`. The following
 * read then came back empty.
 *
 * This test keeps a writer transaction open, reads the already-committed
 * Toronto row from another process, and only commits the writer after the
 * cache write reports that it is waiting on the lock. No sleep. The barrier
 * is the BUSY line.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadMunicipalRecordCache,
  saveMunicipalRecordCache,
} from '../municipal.js';

const childPath = join(dirname(fileURLToPath(import.meta.url)), 'municipal-wal-reader.child.mjs');

function lineQueue(stream: NodeJS.ReadableStream): { next: () => Promise<string> } {
  let buf = '';
  const pending: string[] = [];
  let waiter: ((line: string) => void) | null = null;
  let ended = false;
  const push = (line: string) => {
    if (waiter) {
      const resolve = waiter;
      waiter = null;
      resolve(line);
      return;
    }
    pending.push(line);
  };
  stream.on('data', (chunk: Buffer | string) => {
    buf += chunk.toString();
    let idx = buf.indexOf('\n');
    while (idx >= 0) {
      push(buf.slice(0, idx));
      buf = buf.slice(idx + 1);
      idx = buf.indexOf('\n');
    }
  });
  stream.on('end', () => {
    ended = true;
    if (buf.length > 0) push(buf);
    if (waiter) {
      const resolve = waiter;
      waiter = null;
      resolve('');
    }
  });
  return {
    next() {
      if (pending.length > 0) return Promise.resolve(pending.shift() as string);
      if (ended) return Promise.resolve('');
      return new Promise((resolve) => {
        waiter = resolve;
      });
    },
  };
}

function withDeadline<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

test('WAL reader sees committed municipal rows while another writer holds the lock', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'quill-wal-reader-'));
  const dbPath = join(dir, 'cache.sqlite');
  const previous = process.env.QUILL_DB_PATH;
  process.env.QUILL_DB_PATH = dbPath;

  const created = new DatabaseSync(dbPath);
  created.exec('PRAGMA journal_mode = WAL');
  created.close();

  let holder: DatabaseSync | undefined;
  let child: ReturnType<typeof spawn> | undefined;
  let stderr = '';

  try {
    saveMunicipalRecordCache('toronto', 'budget', 'https://open.toronto.ca', [
      { id: 'tb1', title: 'Toronto Budget 2026' },
    ]);
    const primed = loadMunicipalRecordCache('toronto', 'budget');
    assert.ok(primed, 'priming write must be visible to a reader on the same file');
    assert.equal(primed.records[0]?.id, 'tb1');
    assert.ok(primed.records.length > 0);

    holder = new DatabaseSync(dbPath, { timeout: 0 });
    holder.exec('PRAGMA busy_timeout = 0');
    holder.exec('PRAGMA journal_mode = WAL');
    holder.exec('BEGIN IMMEDIATE');
    holder.prepare(
      `INSERT INTO municipal_records_cache
         (schema_version, city_id, dataset, source, record_count, records_json)
       VALUES (1, 'montreal', 'budget', 'https://montreal.example', 1, '[]')`,
    ).run();
    assert.equal(holder.isTransaction, true, 'writer must still be inside the transaction');

    child = spawn(process.execPath, ['--experimental-strip-types', childPath], {
      env: { ...process.env, QUILL_DB_PATH: dbPath, NODE_NO_WARNINGS: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    const lines = lineQueue(child.stdout!);

    const loadLine = await withDeadline(lines.next(), 10_000, 'LOAD');
    assert.ok(loadLine.startsWith('LOAD '), `expected LOAD line, got ${JSON.stringify(loadLine)} stderr=${stderr}`);
    const loaded = JSON.parse(loadLine.slice(5)) as { records?: Array<{ id?: string }> } | null;
    assert.ok(loaded, 'committed Toronto row must not read as empty while a writer transaction is open');
    assert.ok(Array.isArray(loaded.records) && loaded.records.length > 0, 'reader returned an empty record list');
    assert.equal(loaded.records[0]?.id, 'tb1');

    const busyLine = await withDeadline(lines.next(), 10_000, 'BUSY');
    assert.equal(busyLine, 'BUSY', `cache write must observe the lock before the holder commits; stderr=${stderr}`);

    holder.exec('COMMIT');
    assert.equal(holder.isTransaction, false);

    const saveLine = await withDeadline(lines.next(), 10_000, 'SAVE');
    assert.ok(saveLine.startsWith('SAVE '), `expected SAVE line, got ${JSON.stringify(saveLine)} stderr=${stderr}`);
    const saved = JSON.parse(saveLine.slice(5)) as { records?: Array<{ id?: string }> } | null;
    assert.ok(saved, 'write that waited on the lock must be visible after the holder commits');
    assert.ok(Array.isArray(saved.records) && saved.records.length > 0, 'saved read was empty');
    assert.equal(saved.records[0]?.id, '311a');

    const exitCode = await withDeadline(new Promise<number | null>((resolve) => {
      child?.on('exit', (code) => resolve(code));
    }), 10_000, 'child exit');
    assert.equal(exitCode, 0, `child failed: ${stderr}`);

    // The writer connection is still open. A fresh reader must see both commits.
    const toronto = loadMunicipalRecordCache('toronto', 'budget');
    const calls = loadMunicipalRecordCache('toronto', '311-calls');
    assert.equal(toronto?.records[0]?.id, 'tb1');
    assert.equal(calls?.records[0]?.id, '311a');
    assert.ok((calls?.records.length ?? 0) > 0);
  } finally {
    try { holder?.close(); } catch { /* ignore */ }
    if (child && child.exitCode === null) child.kill();
    if (previous === undefined) delete process.env.QUILL_DB_PATH;
    else process.env.QUILL_DB_PATH = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});
