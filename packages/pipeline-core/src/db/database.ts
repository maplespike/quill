/**
 * Database types — Quill
 *
 * Defines the DB interface used by pipeline-core modules.
 * The underlying implementation uses better-sqlite3 via Drizzle ORM,
 * but modules interact through this typed interface.
 *
 * The `run` method accepts a SQL string and an array of bind parameters,
 * returning an object with the count of changed rows.
 */
export interface DB {
  /** Execute a SQL statement with positional bind parameters. */
  run(
    sql: string,
    params?: Array<unknown>,
  ): Promise<{ changes: number; lastInsertRowid?: number }>;

  /** Prepare a SQL statement for repeated execution. */
  prepare(sql: string): {
    run: (...params: unknown[]) => Promise<{ changes: number; lastInsertRowid?: number }>;
    all: (...params: unknown[]) => Promise<unknown[]>;
    get: (...params: unknown[]) => Promise<unknown | undefined>;
    bind: (...params: unknown[]) => { run: () => Promise<{ changes: number; lastInsertRowid?: number }> };
  };
}
