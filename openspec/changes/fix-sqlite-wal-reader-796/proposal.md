# Proposal: Fix the node:sqlite WAL reader race (#796)

## Why

`GET /v1/municipal/toronto` falls back to `municipal_records_cache` when the
upstream portal fails. That read comes back empty when another connection
holds the SQLite write lock. `node:sqlite` defaults `busy_timeout` to 0, the
cache write swallows `database is locked`, and the next read looks like a
cache miss. The Toronto cache-fallback check flakes on that miss.

## What Changes

- Give municipal cache readers their own read-only connection, with
  `busy_timeout`, and stop them from taking a write lock (no DDL, no
  `wal_checkpoint(FULL)` on the read path).
- Make cache writes use WAL, `synchronous=NORMAL`, and `BEGIN IMMEDIATE`,
  and retry while the file is locked instead of dropping the row.
- Set `busy_timeout` on the long-lived `NodeSqliteStorage` connection that
  shares `QUILL_DB_PATH`.
- Add a regression test that keeps a writer transaction open, reads the
  committed Toronto row from a second process, and asserts the follow-up
  write is visible. The barrier is a lock signal, not a sleep.

No API change. No new dependency.

## Capabilities

### New Capabilities

- `municipal-cache-wal`: concurrent readers see committed municipal cache
  rows while a writer holds the database lock.

### Modified Capabilities

- None.

## Impact

- `packages/api-server` only (`src/cache/municipal.ts`,
  `src/node-sqlite-storage.ts`, and a new unit test).
- Same SQLite file as today (`QUILL_DB_PATH`). Cache rows are still
  best-effort: a lock that outlasts the wait is logged and skipped, and the
  HTTP request still returns.
