## 1. Cache connections

- [x] 1.1 Open municipal cache readers read-only with `busy_timeout`, and
  do not checkpoint or create tables on the read path
- [x] 1.2 Write with WAL, `synchronous=NORMAL`, and `BEGIN IMMEDIATE`, and
  retry while the file is locked
- [x] 1.3 Set `busy_timeout` on `NodeSqliteStorage`

## 2. Regression test

- [x] 2.1 Add a test that holds a writer transaction, reads the committed
  Toronto row from another process, and asserts the follow-up write is
  visible after the lock barrier
- [x] 2.2 Run the test repeatedly and run the municipal cache tests
