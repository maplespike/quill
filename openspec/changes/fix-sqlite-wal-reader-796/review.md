# Review: WAL readers for the municipal cache (#796)

## Spec Compliance

- [x] A second connection can read a committed Toronto row while a writer
  transaction is open, with no throw and no empty list.
- [x] A cache write that observes the lock still commits after the holder
  commits, and a later read returns the new row.
- [x] Both scenarios are covered by
  `src/cache/__tests__/municipal-wal-reader.test.ts`. The barrier is the
  `BUSY` line from the write-lock hook. The test does not sleep to guess
  timing.

## Design Alignment

- [x] Readers do not run DDL or `wal_checkpoint(FULL)`.
- [x] Writers use WAL, `synchronous=NORMAL`, and `BEGIN IMMEDIATE`.
- [x] `NodeSqliteStorage` keeps `synchronous=FULL` and gains a 5 second
  busy timeout.
- [x] No new dependency. No HTTP contract change.

## Risk Assessment

- [x] A lock past the wait limit still does not fail the HTTP request.
- [x] The test hook is unset in production.
- [x] Rollback is a revert of the api-server change. The table shape is
  the same.

## Completeness

- [x] Root cause is the zero busy timeout plus a swallowed lock on a
  connection that also checkpointed and created tables on the read path.
- [x] The fix is not a retry loop inside the test.

VERDICT: APPROVED
