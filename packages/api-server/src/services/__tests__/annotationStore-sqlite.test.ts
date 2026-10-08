/**
 * The annotation store's backend selection, through initAnnotationStore.
 *
 * index.ts is the only caller, and what it passes is the D1 binding; a Node
 * deployment reaches the file-backed branch through QUILL_DB_PATH instead. That
 * branch is the entire point of the SQLite store, so it is pinned against the
 * failure this file was written for: the native module not loading, every
 * annotation quietly landing in memory, and nothing saying so. The last case
 * pins the other half — when the file cannot be opened the store must fall back
 * to memory *loudly* rather than pretend it is persistent.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  annotationStoreBackend,
  createAnnotation,
  deleteAnnotation,
  initAnnotationStore,
  listAnnotations,
  updateAnnotation,
} from '../annotationService.js';

const DB_PATH = join(tmpdir(), `quill-annotations-${process.pid}-${Date.now()}.db`);
const SAVED_DB_PATH = process.env.QUILL_DB_PATH;

/** Collect warnings for the duration of `run`, so a swallowed init failure fails the case. */
async function withWarnings<T>(run: () => T | Promise<T>): Promise<{ result: T; messages: string[] }> {
  const messages: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => { messages.push(args.map(String).join(' ')); };
  try {
    return { result: await run(), messages };
  } finally {
    console.warn = original;
  }
}

/** Only this service's warnings matter; the rest of the pipeline logs on its own. */
const annotationWarnings = (messages: string[]): string[] => messages.filter((m) => m.includes('[AnnotationService]'));

after(() => {
  initAnnotationStore(); // leave the process on the in-memory default
  if (SAVED_DB_PATH === undefined) delete process.env.QUILL_DB_PATH;
  else process.env.QUILL_DB_PATH = SAVED_DB_PATH;
  for (const suffix of ['', '-wal', '-shm']) {
    if (existsSync(DB_PATH + suffix)) rmSync(DB_PATH + suffix);
  }
});

describe('annotation store backends', () => {
  it('answers from memory when nothing is configured', () => {
    delete process.env.QUILL_DB_PATH;
    initAnnotationStore();
    assert.equal(annotationStoreBackend(), 'memory');
  });

  it('answers from the D1 binding when the entry passes one', () => {
    initAnnotationStore({ prepare: () => ({ bind: () => ({ run: async () => ({ success: true }) }) }) });
    assert.equal(annotationStoreBackend(), 'd1');
  });

  it('writes through to the file QUILL_DB_PATH names', async () => {
    const app = (await import('../../index.js')).default;
    process.env.QUILL_DB_PATH = DB_PATH;

    // Through the entry, because that is what calls initAnnotationStore.
    const { result: res, messages } = await withWarnings(() =>
      app.fetch(new Request('http://annotations.test/v1/health'), {} as never));
    assert.equal(res.status, 200);
    assert.deepEqual(annotationWarnings(messages), [], 'the entry warned while initializing the annotation store');
    assert.equal(annotationStoreBackend(), 'sqlite');
    assert.ok(existsSync(DB_PATH), `no database at ${DB_PATH}, so the SQLite store was not selected`);

    const created = createAnnotation({
      entityType: 'bill', entityId: 'c-13', userId: 'u1', annotationType: 'note', content: 'first',
    });
    assert.equal(updateAnnotation(created.id, { content: 'second' })?.content, 'second');

    // Re-initializing reopens the file from scratch: only rows that really
    // reached disk survive this, so a silent fallback to memory fails the case.
    initAnnotationStore();
    assert.equal(annotationStoreBackend(), 'sqlite');
    const rows = listAnnotations('bill', 'c-13');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, created.id);
    assert.equal(rows[0].content, 'second');

    assert.ok(deleteAnnotation(created.id), 'the delete never reached a row in the file');
    assert.deepEqual(listAnnotations('bill', 'c-13'), []);
  });

  it('falls back to memory loudly when the file cannot be opened', async () => {
    process.env.QUILL_DB_PATH = join(tmpdir(), `quill-missing-${process.pid}`, 'nested', 'quill.db');

    const { messages } = await withWarnings(() => initAnnotationStore());

    assert.equal(annotationStoreBackend(), 'memory');
    assert.match(
      annotationWarnings(messages).join('\n'),
      /SQLite store init failed, annotations fall back to memory/,
      'degrading to memory left no trace',
    );
  });
});
