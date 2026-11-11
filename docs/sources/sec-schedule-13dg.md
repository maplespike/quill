# SEC Schedule 13D/G source limits

Status: disabled. Last reviewed: 2026-11-11.

Quill by Maplespike does not serve SEC Schedule 13D or Schedule 13G data. The foundation in `packages/pipeline-core/src/disclosures/schedule-13dg/` parses synthetic XML in memory, applies admission rules, and stops. It is outside the ingestion registry. Nothing in this tree schedules a job, opens a route, or downloads a filing.

This page is not a legal clearance. Research notes are not an admission to enable the source.

## Enablement gates

Every gate blocks a future enablement. None of these statuses is green.

| Gate | Status | What remains |
| --- | --- | --- |
| Identity and security class | blocked | Issuer CIK and the class title as filed stay a pair. Classes, preferred shares, and other titles do not collapse. Ambiguous identity fails closed. |
| Privacy and eligibility | blocked | Every reporting entity needs its own reviewed eligibility record. A type code does not prove eligibility. A 13F-manager flag does not prove eligibility. Personal-vehicle risk stays closed unless a review records it absent. |
| Retention | blocked | Sanitized reason-code logs use a 7-day TTL. The 365-day entity-metadata window runs only when `FUTURE_ENABLEMENT_CLEARED` is true. That flag is false. |
| Corrections | blocked | A correction, withdrawal, or missing index entry tombstones the record and scrubs the in-memory payload. The event date as reported stays distinct from the filed date. |
| Access | unapproved | Rate, backoff, and a monitored contact are not approved. The default request budget is zero. The budget contract does not open a socket. |
| Language | unapproved | French labels are absent. Machine translation of legal terms is off. Do not mark this review green. |
| CUSIP / CGS drop rule | blocked | The parser drops CUSIP and ISIN fields. That drop is not a licence decision. |
| Aggregate claims | blocked | Counts and one filer's reported snapshot are the only shapes. Percentages are not added across filers. Absence is not zero. An amendment is not a sale. A reported zero holding is not a sale. |
| Live index re-sync | not implemented | Stale handling accepts an in-memory accession list from the caller. There is no live index client. |

An entity-type screen is a ceiling check only. It is not an admitted count. A filing that passes the screen is still rejected when any reporting entity lacks reviewed eligibility.

Unknown, missing, or ambiguous eligibility fails closed. An individual filing, a mixed filing, and an unknown filing are rejected as a whole. The result of a rejection is a reason code. It does not carry names, person identifiers, percentages, or the raw body.

## Source limits

The foundation does not include:

- Form 13F holdings, notices, or manager data
- SEDI or SEDAR+
- Section 16 forms
- CUSIP, ISIN, or any map built from them
- Derivative positions
- Individual names, addresses, signatures, or citizenship
- Narrative text, exhibits, or a cached source body
- A hash of the source bytes or of a person
- A production issuer list or a real filing row
- A monitored contact address
- A claim of complete coverage or real-time coverage

Raw XML lives in the parse call. It is not written to the log, the metric map, or the stored record. Exclusion metrics are counts by reason code.

Operational logs store the time, the reason code, and the source id `sec-schedule-13dg`. Rows at or past 7 days are deleted from that list. The deletion test covers this list.

The 365-day function deletes every metadata row while future enablement is uncleared. When a test clears the flag, a row at or past 365 days is deleted. The runtime does not call that store.

Secondary stores are not built. The default store list is empty. A test can attach an in-memory stand-in. Scrub deletes the payload there. This does not cover SQLite, Redis, a search index, an export, or a backup. Those stores do not exist for this source.

The kill switch starts engaged. It blocks synthetic ingest and serving. Turning it off in process still does not enable `liveIngest()`. That function throws `live-ingest-disabled` and does not call `fetch`.

## Dates and issuer status

A stored record keeps three different facts:

- `eventDateAsReported`, taken from the filing's event-date field
- `filedDate`, supplied beside the filing and not copied from the event date
- fetch metadata (`timestampUtc`, a CT label, and the parser version), which may be null

A missing event date does not become the filed date. The filing is rejected.

A historical incorporation note stays `historical-only`. Current status stays `not-reverified`. Review stays `unreviewed`. A label correction must keep the source filing date. The repository does not ship a real issuer fixture for that rule.

## What the tests do

The tests use synthetic identifiers such as `SYN-CIK-` and `SYN-ACC-`. They do not contain pilot rows. They do not call the network. A URL string is rejected, and a replaced `fetch` records zero calls. Retry and backoff use an injected transport and an injected sleep.
