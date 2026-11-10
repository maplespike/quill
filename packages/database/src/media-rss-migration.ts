// SPDX-License-Identifier: AGPL-3.0-only
/**
 * On-deploy migration: news and NGO RSS rows keep headline, source, date,
 * and link only. Excerpt, summary, description, and body columns are cleared.
 * The statements are idempotent and skip databases that do not have the table.
 */

export interface SqliteLike {
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): unknown;
  };
  exec(sql: string): unknown;
}

export interface PgLike {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

/** D1 / Workers binding used by the API server. */
export interface D1Like {
  prepare(sql: string): {
    bind(...params: unknown[]): {
      run(): Promise<unknown>;
      all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
      first<T = Record<string, unknown>>(): Promise<T | null>;
    };
  };
}

/** Columns cleared on `articles`. `summary` is NOT NULL, so it becomes ''. */
const NULLABLE_ARTICLE_TEXT = ['content', 'excerpt', 'description', 'content_snippet'] as const;

function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`refusing to interpolate column ${name}`);
  }
  return name;
}

export function applyMediaRssMetadataSqlite(db: SqliteLike): void {
  const table = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
  ).get('articles') as { name: string } | undefined;
  if (!table) return;

  const cols = db.prepare('PRAGMA table_info(articles)').all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (names.has('summary')) {
    db.prepare("UPDATE articles SET summary = '' WHERE summary IS NOT NULL AND summary != ''").run();
  }
  for (const column of NULLABLE_ARTICLE_TEXT) {
    if (!names.has(column)) continue;
    db.prepare(`UPDATE articles SET ${quoteIdent(column)} = NULL WHERE ${quoteIdent(column)} IS NOT NULL`).run();
  }
}

export async function applyMediaRssMetadataPostgres(db: PgLike): Promise<void> {
  const tables = await db.query(
    `SELECT 1 AS ok FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'articles'`,
  );
  if (tables.rows.length === 0) return;

  const cols = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'articles'`,
  );
  const names = new Set(cols.rows.map((r) => String(r.column_name)));
  if (names.has('summary')) {
    await db.query("UPDATE articles SET summary = '' WHERE summary IS NOT NULL AND summary <> ''");
  }
  for (const column of NULLABLE_ARTICLE_TEXT) {
    if (!names.has(column)) continue;
    const col = quoteIdent(column);
    await db.query(`UPDATE articles SET ${col} = NULL WHERE ${col} IS NOT NULL`);
  }
}

export async function applyMediaRssMetadataD1(db: D1Like): Promise<void> {
  const table = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
  ).bind('articles').first<{ name: string }>();
  if (!table) return;

  const info = await db.prepare('PRAGMA table_info(articles)').bind().all<{ name: string }>();
  const names = new Set((info.results ?? []).map((c) => c.name));
  if (names.has('summary')) {
    await db.prepare(
      "UPDATE articles SET summary = '' WHERE summary IS NOT NULL AND summary != ''",
    ).bind().run();
  }
  for (const column of NULLABLE_ARTICLE_TEXT) {
    if (!names.has(column)) continue;
    const col = quoteIdent(column);
    await db.prepare(`UPDATE articles SET ${col} = NULL WHERE ${col} IS NOT NULL`).bind().run();
  }
}

/** Memory storage has no article rows. The call still runs on that backend. */
export function applyMediaRssMetadataMemory(): void {
  return;
}
