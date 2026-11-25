/**
 * Quill — /v1/municipal/search: FTS5 full-text + keyset cursor (gh issue #794).
 *
 * What this pins down:
 *   1. `?q=` matches through the FTS5 inverted index — TOKEN matches, not the
 *      old `includes()` substring scan. `?q=rating` must NOT match
 *      "Operating" (substring would); `?q=operating` must. The index tables
 *      are asserted to exist and be populated, so deleting the FTS5 path
 *      fails this file even if a substring fallback were left behind.
 *   2. `?cursor=` is a true KEYSET cursor: the token carries the sort key of
 *      the last record (not an offset), and re-issuing page 2 after a record
 *      is inserted EARLIER in the canonical order neither duplicates nor skips
 *      records — the thing an offset cursor cannot do.
 *
 * Hermetic: QUILL_DB_PATH points at a tmpfile seeded with the same
 * node:sqlite schema the cache layer bootstraps, then the handler is invoked
 * directly.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const tmpDir = mkdtempSync(join(tmpdir(), 'quill-search-keyset-'));
const tmpDb = join(tmpDir, 'test.sqlite');
process.env.QUILL_DB_PATH = tmpDb;

const SCHEMA_DDL = `
  CREATE TABLE IF NOT EXISTS municipal_records_cache (
    schema_version INTEGER NOT NULL DEFAULT 1,
    city_id TEXT NOT NULL,
    dataset TEXT NOT NULL,
    source TEXT NOT NULL,
    record_count INTEGER NOT NULL,
    records_json TEXT NOT NULL,
    succeeded_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (city_id, dataset)
  )
`;

const DAY_MS = 24 * 3600 * 1000;

function upsertRow(
  cityId: string,
  dataset: string,
  records: Array<Record<string, unknown>>,
  ageMs = DAY_MS,
  dbFile = tmpDb,
): void {
  const db = new DatabaseSync(dbFile);
  try {
    db.exec('PRAGMA journal_mode = WAL');
    db.exec(SCHEMA_DDL);
    db.prepare(`
      INSERT OR REPLACE INTO municipal_records_cache
        (schema_version, city_id, dataset, source, record_count, records_json, succeeded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      1,
      cityId,
      dataset,
      `https://${cityId}.example/open-data/${dataset}`,
      records.length,
      JSON.stringify(records),
      new Date(Date.now() - ageMs).toISOString(),
    );
  } finally {
    db.close();
  }
}

// 8 records across 3 cities / 4 cache rows. Titles deliberately contain
// "Operating" so the token-vs-substring distinction is testable.
upsertRow('montreal', 'budget', [
  { id: 'mb1', title: 'Montreal Operating Budget 2026', url: 'https://donnees.montreal.ca/budget-2026' },
  { id: 'mb2', title: 'Montreal Capital Budget 2025', url: 'https://donnees.montreal.ca/budget-2025' },
  { id: 'mb3', title: 'Montreal Transit Funding', url: 'https://donnees.montreal.ca/transit' },
]);
upsertRow('montreal', 'permits', [
  { id: 'mp1', title: 'Permis de construction', url: 'https://donnees.montreal.ca/permits-1' },
  { id: 'mp2', title: 'Renovation permit', url: 'https://donnees.montreal.ca/permits-2' },
]);
upsertRow('toronto', 'budget', [
  { id: 'tb1', title: 'Toronto Operating Budget 2026', url: 'https://open.toronto.ca/budget-2026' },
  { id: 'tb2', title: 'Toronto Capital Plan', url: 'https://open.toronto.ca/capital-plan' },
]);
upsertRow('vancouver', 'budget', [
  { id: 'vb1', title: 'Vancouver Operating Budget', url: 'https://opendata.vancouver.ca/budget' },
]);

const ALL_ORIGINAL_IDS = [
  'montreal:budget:mb1',
  'montreal:budget:mb2',
  'montreal:budget:mb3',
  'montreal:permits:mp1',
  'montreal:permits:mp2',
  'toronto:budget:tb1',
  'toronto:budget:tb2',
  'vancouver:budget:vb1',
];

const { municipalSearchHandler } = await import('../routes/municipal.js');

const mkCtx = () => ({
  tenant: { id: 'test-tenant', tier: 'free', emailVerified: true, isActive: true, journalismMode: false },
  requestId: 'test-req',
  startTime: Date.now(),
  queryOptions: {},
  metaOverrides: {},
});

const invoke = async (url: string) => {
  const res = await municipalSearchHandler(new Request(url), mkCtx(), {} as never);
  const json = await res.json();
  return { res, json };
};

const search = (path: string) => invoke(`http://test/v1/municipal/search${path}`);

const decodeCursor = (cursor: string): unknown =>
  JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));

// ---------------------------------------------------------------------------
// FTS5 full-text path
// ---------------------------------------------------------------------------

test('search ?q= matches through FTS5 tokens (not substring)', async () => {
  // "rating" is a substring of "Operating": the old includes() scan matched it,
  // a token index must not.
  const substring = await search('?q=rating');
  assert.equal(substring.res.status, 200);
  assert.equal(substring.json.data.records.length, 0, 'FTS5 must not substring-match "rating" inside "Operating"');

  const token = await search('?q=operating');
  assert.equal(token.json.data.records.length, 3, 'q=operating should match the 3 Operating Budget records');
  for (const rec of token.json.data.records) {
    assert.match(rec.title, /Operating/);
  }
});

test('search ?q= requires every token (implicit AND) across the record JSON', async () => {
  const both = await search('?q=montreal+operating');
  assert.equal(both.json.data.records.length, 1);
  assert.equal(both.json.data.records[0].id, 'montreal:budget:mb1');

  const mixed = await search('?q=montreal+vancouver');
  assert.equal(mixed.json.data.records.length, 0, 'no single record contains both tokens');
});

test('FTS5 index exists and holds one row per cached record', async () => {
  // Exercise the search path so lazy sync runs, then inspect the index.
  await search('?q=budget');

  const db = new DatabaseSync(tmpDb);
  try {
    const tables = db.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'municipal_records_fts'`,
    ).all() as Array<{ name: string }>;
    assert.equal(tables.length, 1, 'municipal_records_fts must exist — removing the FTS5 path fails here');

    const count = db.prepare(`SELECT count(*) AS n FROM municipal_records_fts`).get() as { n: number };
    assert.equal(Number(count.n), ALL_ORIGINAL_IDS.length, 'every cached record must be indexed');

    const row = db.prepare(
      `SELECT body FROM municipal_records_fts WHERE city_id = 'montreal' AND dataset = 'budget' AND record_index = 0`,
    ).get() as { body: string } | undefined;
    assert.ok(row, 'montreal/budget record 0 must be indexed');
    assert.match(row.body, /Operating Budget/);
  } finally {
    db.close();
  }
});

// ---------------------------------------------------------------------------
// Keyset cursor
// ---------------------------------------------------------------------------

test('next_cursor is a keyset token, not an offset', async () => {
  const { json } = await search('?limit=2');
  const cursor = json.data.pagination.next_cursor;
  assert.equal(typeof cursor, 'string');
  assert.equal(json.data.pagination.cursor_kind, 'keyset');

  const decoded = decodeCursor(cursor) as { v?: number; k?: unknown[]; f?: string };
  assert.equal(decoded.v, 2, 'cursor must be a v2 keyset token');
  assert.ok(Array.isArray(decoded.k) && decoded.k.length === 3, 'cursor must carry [cityId, dataset, recordIndex]');
  assert.equal(typeof decoded.f, 'string', 'cursor must be pinned to a filter fingerprint');
  // An offset cursor decodes to a bare integer string — that must not be true.
  assert.notEqual(typeof decoded, 'number', 'cursor must not be a bare offset');
});

test('cursor walk returns every record exactly once', async () => {
  const seen: string[] = [];
  let cursor: string | null = null;
  let pages = 0;
  for (;;) {
    const { json } = await search(`?limit=2${cursor ? `&cursor=${cursor}` : ''}`);
    pages++;
    assert.ok(pages <= 10, 'pagination must terminate');
    for (const rec of json.data.records) seen.push(rec.id);
    if (!json.data.pagination.has_more) {
      assert.equal(json.data.pagination.next_cursor, null, 'exhausted result set must not hand out a cursor');
      break;
    }
    cursor = json.data.pagination.next_cursor;
    assert.equal(typeof cursor, 'string');
  }
  assert.equal(pages, 4, '8 records at limit=2 should take 4 pages');
  assert.equal(new Set(seen).size, seen.length, `duplicate records across pages: ${seen.join(',')}`);
  assert.deepEqual([...seen].sort(), [...ALL_ORIGINAL_IDS].sort());
});

test('keyset page 2 is stable when a record is inserted BEFORE the cursor', async () => {
  const first = await search('?limit=2');
  assert.equal(first.json.data.pagination.has_more, true);
  const page1Ids = first.json.data.records.map((r: { id: string }) => r.id);
  assert.deepEqual(page1Ids, ['montreal:budget:mb1', 'montreal:budget:mb2']);
  const cursor = first.json.data.pagination.next_cursor;

  // Calgary sorts before montreal in the canonical (city, dataset, index)
  // order. An offset cursor would shift every later page by one; a keyset
  // cursor resumes strictly after montreal/budget[1] and ignores it.
  upsertRow('calgary', 'budget', [
    { id: 'cb1', title: 'Calgary Operating Budget 2026', url: 'https://data.calgary.ca/budget' },
  ], 1000);

  const second = await search(`?limit=2&cursor=${cursor}`);
  const page2Ids = second.json.data.records.map((r: { id: string }) => r.id);
  assert.deepEqual(page2Ids, ['montreal:budget:mb3', 'montreal:permits:mp1'], 'keyset page 2 must not shift or duplicate');

  // Walk the rest and prove every pre-insert record is still reachable once.
  const seen = [...page1Ids, ...page2Ids];
  let next: string | null = second.json.data.pagination.next_cursor;
  while (next) {
    const page = await search(`?limit=2&cursor=${next}`);
    for (const rec of page.json.data.records) seen.push(rec.id);
    next = page.json.data.pagination.has_more ? page.json.data.pagination.next_cursor : null;
  }
  assert.equal(new Set(seen).size, seen.length, `duplicate records after insert: ${seen.join(',')}`);
  for (const id of ALL_ORIGINAL_IDS) {
    assert.ok(seen.includes(id), `record ${id} was skipped by keyset pagination`);
  }

  // Restore the fixture so later tests see the original 8-record corpus
  // (the lazy index sync also purges the deleted row's FTS entries).
  const cleanup = new DatabaseSync(tmpDb);
  try {
    cleanup.prepare(`DELETE FROM municipal_records_cache WHERE city_id = 'calgary'`).run();
  } finally {
    cleanup.close();
  }
});

test('has_more is false when the page exactly exhausts the result set', async () => {
  const { json } = await search('?cities=vancouver&datasets=budget&limit=1');
  assert.equal(json.data.records.length, 1);
  assert.equal(json.data.pagination.has_more, false, 'exactly-limit result set must not claim has_more');
  assert.equal(json.data.pagination.next_cursor, null);
});

test('cursor is rejected when replayed against a different filter set', async () => {
  const first = await search('?cities=montreal&limit=1');
  const cursor = first.json.data.pagination.next_cursor;
  assert.equal(typeof cursor, 'string');

  const mismatched = await search(`?cities=toronto&limit=1&cursor=${cursor}`);
  assert.equal(mismatched.res.status, 400, 'cursor from another filter set must 400, not silently skip');
  assert.equal(mismatched.json.code, 'VALIDATION_ERROR');
});

test('unparseable cursor falls back to the first page', async () => {
  const { res, json } = await search('?limit=3&cursor=%%not-a-cursor%%');
  assert.equal(res.status, 200);
  assert.equal(json.data.records.length, 3);
  assert.deepEqual(
    json.data.records.map((r: { id: string }) => r.id),
    ['montreal:budget:mb1', 'montreal:budget:mb2', 'montreal:budget:mb3'],
  );
});

test('keyset paging works over an FTS5 query result set', async () => {
  const seen: string[] = [];
  let cursor: string | null = null;
  for (;;) {
    const { json } = await search(`?q=budget&limit=2${cursor ? `&cursor=${cursor}` : ''}`);
    for (const rec of json.data.records) {
      seen.push(rec.id);
      assert.match(rec.title, /Budget/);
    }
    if (!json.data.pagination.has_more) break;
    cursor = json.data.pagination.next_cursor;
    assert.equal(typeof cursor, 'string');
  }
  assert.equal(new Set(seen).size, seen.length, `duplicate FTS pages: ${seen.join(',')}`);
  assert.deepEqual([...seen].sort(), [
    'montreal:budget:mb1',
    'montreal:budget:mb2',
    'toronto:budget:tb1',
    'vancouver:budget:vb1',
  ].sort());
});

test('teardown: remove tmpdir', async () => {
  rmSync(tmpDir, { recursive: true, force: true });
});
