# Design: WAL readers for the municipal cache (#796)

## Context

`packages/api-server/src/cache/municipal.ts` and `NodeSqliteStorage` open the
same file (`QUILL_DB_PATH`) with `node:sqlite`. The cache helper used to open
one connection, run `CREATE TABLE`, run `wal_checkpoint(FULL)`, then read or
write. `DatabaseSync` defaults `timeout` to 0, so any lock throws
`database is locked` at once. `saveMunicipalRecordCache` caught that error
and returned. The next `loadMunicipalRecordCache` call found no row. That is
the Toronto cache-fallback flake.

A connection that is already inside a transaction also keeps its snapshot.
A SELECT on that same connection does not see a commit from another
connection, and a later write on it throws `SQLITE_BUSY` even after the
other writer has committed (`SQLITE_BUSY_SNAPSHOT`).

## Goals / Non-Goals

**Goals**

- A committed cache row is visible to a second connection while the writer
  connection stays open.
- A cache write that collides with a short lock still lands.
- The regression test fails if the write is dropped or the read is empty.

**Non-Goals**

- Changing the HTTP shape of `/v1/municipal/*`.
- Turning the cache into a hard dependency of the request (writes stay
  best-effort when the file is missing or corrupt).
- Changing `synchronous` on `NodeSqliteStorage`. That connection stores
  tenants and Stripe orders. `FULL` stays there. The cache is allowed to
  use `NORMAL`, which is the usual WAL setting: a lost cache row is a
  refetch, not a lost payment.

## Decisions

1. **Separate connections.** Every read and every write opens a new
   `DatabaseSync` and closes it before return. Readers do not run DDL and
   do not checkpoint. Those statements take a write lock.
2. **Readers are read-only and set `busy_timeout` to 5 seconds.** WAL lets
   them read committed frames while a writer is in a transaction. If this
   Node build cannot open the file read-only, the fallback connection sets
   WAL if needed and then `PRAGMA query_only = ON`.
3. **Writers use `BEGIN IMMEDIATE` and retry in JavaScript.** The writer
   connection keeps `busy_timeout` at 0 so `BEGIN IMMEDIATE` fails fast,
   the code rolls back, and the next try starts a new transaction. A
   C-level busy timeout would sleep inside the statement and could not
   clear a snapshot conflict. The wait cap is 5 seconds, with a 1 ms yield
   between tries. One hook fires on the first lock so the test can release
   the other writer. Production does not set the hook.
4. **`NodeSqliteStorage` sets `timeout: 5000`.** It shares the file. A
   zero timeout made its own statements throw as soon as the cache took
   the write lock.

## Risks / Trade-offs

- [A lock held longer than 5 seconds] → the cache write logs and returns.
  The HTTP handler still responds. The row is absent until the next
  successful fetch.
- [Read-only open fails on a fresh or non-WAL file] → the query-only
  fallback still sets WAL when the mode is not already `wal`.
- [`synchronous=NORMAL` on the cache] → a power loss can drop the last
  uncheckpointed cache commit. The next live fetch fills it again.

## Migration Plan

Deploy with the api-server image. No schema migration: the table is
unchanged. Rollback is the previous image. Existing cache files stay valid.

## Open Questions

None.
