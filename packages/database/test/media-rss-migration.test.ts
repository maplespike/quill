import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  applyMediaRssMetadataSqlite,
  applyMediaRssMetadataMemory,
  applyMediaRssMetadataPostgres,
  applyMediaRssMetadataD1,
} from '../src/media-rss-migration.ts';

test('sqlite migration clears article body fields and is idempotent', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE articles (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT,
      excerpt TEXT,
      url TEXT NOT NULL,
      source TEXT NOT NULL,
      published_at TEXT NOT NULL
    );
    INSERT INTO articles (title, summary, content, excerpt, url, source, published_at)
    VALUES ('Headline', 'A long excerpt of the article.', 'Full body text.', 'snippet', 'https://example.com/a', 'CBC News', '2026-01-01');
  `);

  applyMediaRssMetadataSqlite(db);
  applyMediaRssMetadataSqlite(db);

  const row = db.prepare('SELECT title, summary, content, excerpt, source, url, published_at FROM articles').get() as {
    title: string;
    summary: string;
    content: string | null;
    excerpt: string | null;
    source: string;
    url: string;
    published_at: string;
  };
  assert.equal(row.title, 'Headline');
  assert.equal(row.summary, '');
  assert.equal(row.content, null);
  assert.equal(row.excerpt, null);
  assert.equal(row.source, 'CBC News');
  assert.equal(row.url, 'https://example.com/a');
  assert.equal(row.published_at, '2026-01-01');
  db.close();
});

test('sqlite migration skips a database with no articles table', () => {
  const db = new DatabaseSync(':memory:');
  applyMediaRssMetadataSqlite(db);
  db.close();
});

test('memory backend migration is a no-op', () => {
  applyMediaRssMetadataMemory();
});

test('postgres migration clears article body columns when the table exists', async () => {
  const columns = ['title', 'summary', 'content', 'excerpt'];
  const updates: string[] = [];
  const db = {
    async query(sql: string) {
      if (sql.includes('information_schema.tables')) return { rows: [{ ok: 1 }] };
      if (sql.includes('information_schema.columns')) {
        return { rows: columns.map((column_name) => ({ column_name })) };
      }
      updates.push(sql);
      return { rows: [] };
    },
  };
  await applyMediaRssMetadataPostgres(db);
  await applyMediaRssMetadataPostgres(db);
  assert.ok(updates.some((sql) => sql.includes("summary = ''")));
  assert.ok(updates.some((sql) => sql.includes('SET content = NULL')));
  assert.ok(updates.some((sql) => sql.includes('SET excerpt = NULL')));
});

test('postgres migration skips when articles is absent', async () => {
  let updates = 0;
  await applyMediaRssMetadataPostgres({
    async query(sql: string) {
      if (sql.includes('information_schema.tables')) return { rows: [] };
      updates += 1;
      return { rows: [] };
    },
  });
  assert.equal(updates, 0);
});

test('D1 migration clears article body columns', async () => {
  const ran: string[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind() {
          return {
            async first() {
              return sql.includes('sqlite_master') ? { name: 'articles' } : null;
            },
            async all() {
              return { results: [{ name: 'summary' }, { name: 'content' }, { name: 'description' }] };
            },
            async run() {
              ran.push(sql);
            },
          };
        },
      };
    },
  };
  await applyMediaRssMetadataD1(db);
  assert.ok(ran.some((sql) => sql.includes("summary = ''")));
  assert.ok(ran.some((sql) => sql.includes('SET content = NULL')));
  assert.ok(ran.some((sql) => sql.includes('SET description = NULL')));
});
