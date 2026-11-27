import { describe, expect, it, vi } from "vitest";
import { checkpointIfPossible } from "../db/connection";

type Sqlite = Parameters<typeof checkpointIfPossible>[0];

function fakeSqlite(pragma: (sql: string) => unknown): Sqlite {
  return { pragma } as unknown as Sqlite;
}

function sqliteError(code: string): Error & { code: string } {
  const err = new Error(`sqlite error: ${code}`) as Error & { code: string };
  err.code = code;
  return err;
}

describe("checkpointIfPossible", () => {
  it("runs the checkpoint on a writable connection", () => {
    const pragma = vi.fn(() => []);
    checkpointIfPossible(fakeSqlite(pragma));
    expect(pragma).toHaveBeenCalledWith("wal_checkpoint(TRUNCATE)");
  });

  it("ignores SQLITE_READONLY so cleanup cannot fail a completed sweep", () => {
    const pragma = vi.fn(() => {
      throw sqliteError("SQLITE_READONLY");
    });
    expect(() => checkpointIfPossible(fakeSqlite(pragma))).not.toThrow();
    expect(pragma).toHaveBeenCalledOnce();
  });

  it("propagates every other SQLite error", () => {
    const pragma = vi.fn(() => {
      throw sqliteError("SQLITE_BUSY");
    });
    expect(() => checkpointIfPossible(fakeSqlite(pragma))).toThrow("SQLITE_BUSY");
  });
});
