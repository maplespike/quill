// SPDX-License-Identifier: AGPL-3.0-only
/**
 * On-deploy migration: drop stored names of private individuals.
 *
 * - donations: rebuild as aggregates by party, riding, and amount band.
 *   donor_name and donor_person_id are not copied. Linked person rows are cleared.
 * - sedar_filings: insider reports and early-warning reports (10% holders)
 *   lose title and description text that can name a person.
 *
 * SEDI tables are not touched. Idempotent. Skips missing tables.
 */

import { aggregateDonationRows } from './donation-aggregate.js';

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

export interface D1Like {
  prepare(sql: string): {
    bind(...params: unknown[]): {
      run(): Promise<unknown>;
      all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
      first<T = Record<string, unknown>>(): Promise<T | null>;
    };
  };
  exec?(sql: string): Promise<unknown>;
}

const SEDAR_REDACT = `
UPDATE sedar_filings
SET description = NULL,
    title = CASE filing_type
      WHEN 'insider-report' THEN 'Insider report'
      WHEN 'early-warning-report' THEN 'Early warning report'
      ELSE title
    END
WHERE filing_type IN ('insider-report', 'early-warning-report')
`;

const SQLITE_DONATION_DDL = `
CREATE TABLE donations__licence (
  id TEXT PRIMARY KEY,
  party TEXT NOT NULL,
  riding TEXT NOT NULL DEFAULT '',
  amount_band TEXT NOT NULL,
  contribution_count INTEGER NOT NULL,
  total_amount REAL NOT NULL,
  jurisdiction TEXT,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

function sqliteColumns(db: SqliteLike, table: string): Set<string> | null {
  const found = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
  ).get(table) as { name: string } | undefined;
  if (!found) return null;
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return new Set(cols.map((c) => c.name));
}

export function applyPrivateNamesSqlite(db: SqliteLike): void {
  const donations = sqliteColumns(db, 'donations');
  if (donations?.has('donor_name')) {
    const persons = sqliteColumns(db, 'persons');
    if (persons && donations.has('donor_person_id')) {
      const sets = ["names = '[]'", 'first_name = NULL', 'last_name = NULL'];
      if (persons.has('email')) sets.push('email = NULL');
      if (persons.has('raw_data')) sets.push("raw_data = '{}'");
      db.prepare(
        `UPDATE persons SET ${sets.join(', ')}
         WHERE id IN (
           SELECT donor_person_id FROM donations
           WHERE donor_person_id IS NOT NULL AND donor_person_id != ''
         )`,
      ).run();
    }
    const rows = db.prepare('SELECT * FROM donations').all() as Record<string, unknown>[];
    const aggregates = aggregateDonationRows(rows);
    db.exec(SQLITE_DONATION_DDL);
    const insert = db.prepare(
      `INSERT INTO donations__licence
        (id, party, riding, amount_band, contribution_count, total_amount, jurisdiction, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const row of aggregates) {
      insert.run(
        row.id,
        row.party,
        row.riding,
        row.amount_band,
        row.contribution_count,
        row.total_amount,
        row.jurisdiction,
        row.source,
      );
    }
    db.exec('DROP TABLE donations');
    db.exec('ALTER TABLE donations__licence RENAME TO donations');
    db.exec('CREATE INDEX IF NOT EXISTS idx_donations_aggregate ON donations(party, riding, amount_band)');
  }
  if (sqliteColumns(db, 'sedar_filings')) {
    db.prepare(SEDAR_REDACT).run();
  }
}

export async function applyPrivateNamesPostgres(db: PgLike): Promise<void> {
  const donationCols = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'donations'`,
  );
  const names = new Set(donationCols.rows.map((r) => String(r.column_name)));
  if (names.has('donor_name')) {
    if (names.has('donor_person_id')) {
      await db.query(
        `UPDATE persons SET names = '[]'::jsonb, first_name = NULL, last_name = NULL, email = NULL, raw_data = '{}'
         WHERE id IN (
           SELECT donor_person_id FROM donations
           WHERE donor_person_id IS NOT NULL AND donor_person_id <> ''
         )`,
      );
    }
    const existing = await db.query('SELECT * FROM donations');
    const aggregates = aggregateDonationRows(existing.rows);
    await db.query('DROP INDEX IF EXISTS idx_donations_donor');
    await db.query('ALTER TABLE donations RENAME TO donations__named');
    await db.query(`
      CREATE TABLE donations (
        id TEXT PRIMARY KEY,
        party TEXT NOT NULL,
        riding TEXT NOT NULL DEFAULT '',
        amount_band TEXT NOT NULL,
        contribution_count INTEGER NOT NULL,
        total_amount DOUBLE PRECISION NOT NULL,
        jurisdiction TEXT,
        source TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    for (const row of aggregates) {
      await db.query(
        `INSERT INTO donations
          (id, party, riding, amount_band, contribution_count, total_amount, jurisdiction, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [row.id, row.party, row.riding, row.amount_band, row.contribution_count, row.total_amount, row.jurisdiction, row.source],
      );
    }
    await db.query('DROP TABLE donations__named');
    await db.query('CREATE INDEX IF NOT EXISTS idx_donations_aggregate ON donations(party, riding, amount_band)');
  }
  const sedar = await db.query(
    `SELECT 1 AS ok FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'sedar_filings'`,
  );
  if (sedar.rows.length > 0) {
    await db.query(SEDAR_REDACT);
  }
}

export async function applyPrivateNamesD1(db: D1Like): Promise<void> {
  const table = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
  ).bind('donations').first<{ name: string }>();
  if (table) {
    const info = await db.prepare('PRAGMA table_info(donations)').bind().all<{ name: string }>();
    const names = new Set((info.results ?? []).map((c) => c.name));
    if (names.has('donor_name')) {
      if (names.has('donor_person_id')) {
        await db.prepare(
          `UPDATE persons SET names = '[]', first_name = NULL, last_name = NULL, email = NULL
           WHERE id IN (
             SELECT donor_person_id FROM donations
             WHERE donor_person_id IS NOT NULL AND donor_person_id != ''
           )`,
        ).bind().run();
      }
      const listed = await db.prepare('SELECT * FROM donations').bind().all<Record<string, unknown>>();
      const aggregates = aggregateDonationRows(listed.results ?? []);
      if (db.exec) await db.exec(SQLITE_DONATION_DDL);
      else await db.prepare(SQLITE_DONATION_DDL).bind().run();
      for (const row of aggregates) {
        await db.prepare(
          `INSERT INTO donations__licence
            (id, party, riding, amount_band, contribution_count, total_amount, jurisdiction, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          row.id, row.party, row.riding, row.amount_band,
          row.contribution_count, row.total_amount, row.jurisdiction, row.source,
        ).run();
      }
      await db.prepare('DROP TABLE donations').bind().run();
      await db.prepare('ALTER TABLE donations__licence RENAME TO donations').bind().run();
    }
  }
  const sedar = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
  ).bind('sedar_filings').first<{ name: string }>();
  if (sedar) await db.prepare(SEDAR_REDACT).bind().run();
}

/** Memory storage has no donation or filing rows. The call still runs on that backend. */
export function applyPrivateNamesMemory(): void {
  return;
}
