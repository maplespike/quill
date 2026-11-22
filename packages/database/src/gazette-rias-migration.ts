// SPDX-License-Identifier: AGPL-3.0-only
/**
 * On-deploy migration: stored Canada Gazette RIAS text is capped at 300
 * characters. Title, description, and links are unchanged. Idempotent.
 */

export interface SqliteLike {
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): unknown;
  };
}

export interface PgLike {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface D1Like {
  prepare(sql: string): {
    bind(...params: unknown[]): {
      run(): Promise<unknown>;
      all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
      first<T = Record<string, unknown>>(): Promise<T | null>;
    };
  };
}

const SQLITE_CAP =
  'UPDATE gazette_records SET rias_text = substr(rias_text, 1, 300) WHERE rias_text IS NOT NULL AND length(rias_text) > 300';

const POSTGRES_CAP =
  'UPDATE gazette_records SET rias_text = substring(rias_text from 1 for 300) WHERE rias_text IS NOT NULL AND char_length(rias_text) > 300';

export function applyGazetteRiasCapSqlite(db: SqliteLike): void {
  const table = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
  ).get('gazette_records') as { name: string } | undefined;
  if (!table) return;
  const cols = db.prepare('PRAGMA table_info(gazette_records)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'rias_text')) return;
  db.prepare(SQLITE_CAP).run();
}

export async function applyGazetteRiasCapPostgres(db: PgLike): Promise<void> {
  const tables = await db.query(
    `SELECT 1 AS ok FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'gazette_records'`,
  );
  if (tables.rows.length === 0) return;
  const cols = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'gazette_records' AND column_name = 'rias_text'`,
  );
  if (cols.rows.length === 0) return;
  await db.query(POSTGRES_CAP);
}

export async function applyGazetteRiasCapD1(db: D1Like): Promise<void> {
  const table = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
  ).bind('gazette_records').first<{ name: string }>();
  if (!table) return;
  const info = await db.prepare('PRAGMA table_info(gazette_records)').bind().all<{ name: string }>();
  if (!(info.results ?? []).some((c) => c.name === 'rias_text')) return;
  await db.prepare(SQLITE_CAP).bind().run();
}

/** Memory storage has no gazette rows. The call still runs on that backend. */
export function applyGazetteRiasCapMemory(): void {
  return;
}
