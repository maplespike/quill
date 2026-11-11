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
| Retention | blocked | The runtime refuses to store entity metadata unless the caller passes explicit synthetic-contract retention. That mode does not clear a gate. Sanitized reason-code logs expire at 7 days. Tombstones expire too. `FUTURE_ENABLEMENT_CLEARED` stays false, so the 365-day production window does not open. |
| Corrections | blocked | A correction must keep the same issuer, class, and filer CIKs. A withdrawal, a stale mark, or a kill-switch scrub tombstones the record and deletes payloads, including while the kill switch is engaged. The event date as reported stays distinct from the filed date. |
| Access | unapproved | Rate, backoff, and a monitored contact are not approved. The budget helper is per call, is not a shared limiter, and does not mark the access gate passed. The default request budget is zero. |
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

The runtime calls the metadata writer with future enablement cleared set to false. That write is refused. A separate `synthetic-contract` retention mode is explicit, in-process, and does not clear a gate. In that mode a record or a complete tombstone at or past 365 days is deleted. An incomplete scrub tombstone stays until a later scrub reads the copies back as gone, and serve stays blocked while it remains. Logs are deleted at or past 7 days. The default clock is `Date.now`.

The default constructor attaches no secondary store. A caller who passes stand-ins must also declare `requiredStoreIds`, and the ids must match exactly. That match is not an externally verified production manifest. A late enrollment is refused. Scrub deletes every attached store and reads it back. If one delete throws, the others still run, and the tombstone says `incomplete`. This does not cover SQLite, Redis, a search index, an export, or a backup. Those stores do not exist for this source.

The kill switch starts engaged. It blocks synthetic ingest and serving. `unlockSyntheticEvaluation()` opens only the in-memory contract path. It does not enable `liveIngest()`, and it does not mark a gate passed. `liveIngest()` throws `live-ingest-disabled` and does not call `fetch`. Withdrawal and scrub still run while the kill switch is engaged.

An `http` namespace in the XML is not a network call. A payload that is only a URL is refused. The parser does not fetch it.

## Dates and issuer status

A stored record keeps three different facts:

- `eventDateAsReported`, taken from the filing's event-date field
- `filedDate`, supplied beside the filing and not copied from the event date
- fetch metadata (`timestampUtc`, a CT label, and the parser version), which may be null

A missing event date does not become the filed date. The filing is rejected.

A historical incorporation note stays `historical-only`. Current status stays `not-reverified`. Review stays `unreviewed`. A label correction must keep the source filing date. The repository does not ship a real issuer fixture for that rule.

## What the tests do

The tests use synthetic identifiers such as `SYN-CIK-` and `SYN-ACC-`. They do not contain pilot rows. They do not call the network. A URL string is rejected, and a replaced `fetch` records zero calls. Retry and backoff use an injected transport and an injected sleep.
