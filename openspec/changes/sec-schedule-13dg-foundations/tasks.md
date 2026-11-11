## 1. Contracts

- [x] 1.1 Add disabled constants, gate list, and types
- [x] 1.2 Parse synthetic 13D/G XML and drop CUSIP and ISIN fields
- [x] 1.3 Admit only reviewed entities and reject individual, mixed, and unknown filings as a whole

## 2. Provenance and retention

- [x] 2.1 Keep event date, filed date, and fetch metadata distinct
- [x] 2.2 Tombstone corrections, withdrawals, and stale rows and scrub attached memory
- [x] 2.3 Enforce the 7-day log TTL and the uncleared 365-day metadata window

## 3. Safety and docs

- [x] 3.1 Fail closed on the kill switch, live ingest, and a zero budget
- [x] 3.2 Document blocked gates and source limits for Quill by Maplespike
- [x] 3.3 Run the synthetic contract tests without a network call
