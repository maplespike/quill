// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * SQLite-backed D1 adapter — lets db-first ingestion modules run locally.
 *
 * Many modules (committees, influence, corporate, ab-health, …) declare their
 * main ingest function as `(db, options)` where `db` is a Cloudflare
 * D1-style interface. When invoked through `runModule(name, options)` — the
 * CLI / run-pipeline / smoke-test calling convention — the options object was
 * landing in the `db` slot, so those modules silently ingested nothing.
 *
 * This adapter implements the same D1Database contract on top of the shared
 * better-sqlite3 handle (@maplespike/database getRawDb), so db-first modules
 * can run in-process against quill.sqlite. `runModule` injects it
 * automatically when the module's main function is db-first and the caller
 * didn't pass a db.
 */

import { getRawDb } from '@maplespike/database';
import type { D1Database, D1PreparedStatement } from './committees/db.js';

/**
 * Minimal D1PreparedStatement over a better-sqlite3 statement.
 * Executes lazily per call (the shared handle is a singleton), so no
 * statement caching or transaction bookkeeping is needed.
 */
class SqliteD1Statement implements D1PreparedStatement {
  private params: unknown[] = [];

  constructor(private readonly sql: string) {}

  bind(...args: unknown[]): D1PreparedStatement {
    this.params = args;
    return this;
  }

  async all<T = unknown>(): Promise<{ results: T[]; success: boolean }> {
    const stmt = getRawDb().prepare(this.sql);
    return { results: stmt.all(...this.params) as T[], success: true };
  }

  async first<T = unknown>(): Promise<T | null> {
    const stmt = getRawDb().prepare(this.sql);
    const row = stmt.get(...this.params) as T | undefined;
    return row ?? null;
  }

  async run(): Promise<{ success: boolean; meta?: { changes: number } }> {
    const stmt = getRawDb().prepare(this.sql);
    const info = stmt.run(...this.params);
    return { success: true, meta: { changes: info.changes } };
  }
}

/**
 * Build a D1Database-compatible adapter backed by the shared SQLite file.
 */
export function createSqliteD1Adapter(): D1Database {
  return {
    prepare(sql: string): D1PreparedStatement {
      return new SqliteD1Statement(sql);
    },

    async exec(sql: string): Promise<{ success: boolean; error?: string }> {
      try {
        getRawDb().exec(sql);
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },

    async batch(
      stmts: D1PreparedStatement[],
    ): Promise<{ results?: unknown[]; success: boolean }[]> {
      const out: { results?: unknown[]; success: boolean }[] = [];
      for (const s of stmts) {
        try {
          const res = await s.all();
          out.push(res);
        } catch {
          out.push({ results: [], success: false });
        }
      }
      return out;
    },
  };
}
