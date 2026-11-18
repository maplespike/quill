## ADDED Requirements

### Requirement: Committed cache rows stay visible to a concurrent reader

The municipal cache SHALL store rows in a SQLite database opened in WAL
mode. A reader SHALL use its own connection. A reader SHALL see a row that
another connection has committed, including while that writer connection is
still open and inside a later transaction. The read SHALL NOT throw and
SHALL NOT come back empty for that committed row.

#### Scenario: Toronto row is visible while a writer transaction is open

- **WHEN** a Toronto budget row is committed to `municipal_records_cache`
- **AND** a second connection starts a write transaction and has not committed it
- **THEN** a reader on its own connection returns the Toronto row
- **AND** the record list is not empty
- **AND** the read does not throw

### Requirement: A cache write waits out a lock instead of dropping the row

A cache write SHALL take the write lock with `BEGIN IMMEDIATE`. When another
connection holds the write lock, the write SHALL retry until the lock is
released or the wait limit is reached. A write that commits after that wait
SHALL be visible to a later reader. The reader connection SHALL set a
busy timeout so a brief lock does not surface as an empty miss.

#### Scenario: Write started during a lock lands after the holder commits

- **WHEN** a writer holds an open write transaction
- **AND** a cache write for Toronto 311 calls starts and observes the lock
- **AND** the holder then commits
- **THEN** the cache write commits
- **AND** a reader returns the 311 calls row
- **AND** the record list is not empty
