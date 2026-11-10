/**
 * Drop stored SEDI insider data.
 *
 * SEDI terms of use prohibit automated access. The product no longer ships
 * the module. This migration deletes the insider table, SEDI claim bundles,
 * and SEDI entity-graph rows. It is idempotent: a missing table is skipped,
 * and a second run deletes nothing.
 *
 * SQLite (better-sqlite3 and node:sqlite) and PostgreSQL both use this file.
 * D1 schema application uses the DROP in schema/d1.sql for the insider table.
 */

export interface DropSediResult {
  insiderTableDropped: boolean;
  citationRows: number;
  mentionRows: number;
  linkRows: number;
  ingestRunRows: number;
}

export interface SqliteLike {
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): { changes?: number | bigint };
  };
}

export interface PgQueryResult {
  rows: unknown[];
  rowCount: number | null;
}

export type PgQuery = (sql: string, params?: unknown[]) => Promise<PgQueryResult>;

const CITATION_PREDICATE = `
  lower(citation_json) LIKE '%"sourcename":"sedi"%'
  OR lower(citation_json) LIKE '%"sourcename": "sedi"%'
  OR lower(citation_json) LIKE '%"claim":"sedi:%'
  OR lower(citation_json) LIKE '%"claim": "sedi:%'
  OR lower(citation_json) LIKE '%sedi.ca%'
  OR lower(citation_json) LIKE '%sedi-insider-transactions%'
  OR lower(serialized) LIKE '%sedi.ca%'
  OR lower(serialized) LIKE '%sedi-insider-transactions%'
`;

function changesOf(info: { changes?: number | bigint } | undefined): number {
  const n = info?.changes ?? 0;
  return typeof n === 'bigint' ? Number(n) : n;
}

function sqliteHasTable(db: SqliteLike, name: string): boolean {
  const row = db.prepare(
    `SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?`,
  ).get(name) as { ok?: number } | undefined;
  return !!row;
}

function sqliteDelete(db: SqliteLike, table: string, where: string): number {
  if (!sqliteHasTable(db, table)) return 0;
  return changesOf(db.prepare(`DELETE FROM ${table} WHERE ${where}`).run());
}

/** Drop SEDI rows on a SQLite handle. Safe to call again. */
export function dropSediInsiderSqlite(db: SqliteLike): DropSediResult {
  const citationRows = sqliteDelete(db, 'citation_records', CITATION_PREDICATE);
  const mentionRows = sqliteDelete(
    db,
    'entity_mentions',
    `module_name = 'sedi' OR source_table = 'insider_transactions' OR lower(source_url) LIKE '%sedi.ca%'`,
  );
  const linkRows = sqliteDelete(db, 'entity_links', `source = 'sedi'`);
  const ingestRunRows = sqliteDelete(
    db,
    'ingest_runs',
    `pipeline = 'sedi' OR pipeline = 'all:sedi' OR pipeline LIKE 'all:sedi:%'`,
  );
  const insiderTableDropped = sqliteHasTable(db, 'insider_transactions');
  db.prepare('DROP TABLE IF EXISTS insider_transactions').run();
  return { insiderTableDropped, citationRows, mentionRows, linkRows, ingestRunRows };
}

async function pgHasTable(query: PgQuery, name: string): Promise<boolean> {
  const res = await query('SELECT to_regclass($1) AS reg', [name]);
  const reg = (res.rows[0] as { reg?: string | null } | undefined)?.reg;
  return reg != null;
}

async function pgDelete(query: PgQuery, table: string, where: string): Promise<number> {
  if (!(await pgHasTable(query, table))) return 0;
  const res = await query(`DELETE FROM ${table} WHERE ${where}`);
  return res.rowCount ?? 0;
}

/** Drop SEDI rows on PostgreSQL. Safe to call again. */
export async function dropSediInsiderPostgres(query: PgQuery): Promise<DropSediResult> {
  const citationRows = await pgDelete(query, 'citation_records', CITATION_PREDICATE);
  const mentionRows = await pgDelete(
    query,
    'entity_mentions',
    `module_name = 'sedi' OR source_table = 'insider_transactions' OR lower(source_url) LIKE '%sedi.ca%'`,
  );
  const linkRows = await pgDelete(query, 'entity_links', `source = 'sedi'`);
  const ingestRunRows = await pgDelete(
    query,
    'ingest_runs',
    `pipeline = 'sedi' OR pipeline = 'all:sedi' OR pipeline LIKE 'all:sedi:%'`,
  );
  const insiderTableDropped = await pgHasTable(query, 'insider_transactions');
  await query('DROP TABLE IF EXISTS insider_transactions');
  return { insiderTableDropped, citationRows, mentionRows, linkRows, ingestRunRows };
}
