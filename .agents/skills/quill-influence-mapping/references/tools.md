---
title: "tools"
last-reviewed: 2026-11-09
status: active
---

# Quill MCP tools used by influence-mapping

Checked against `packages/quill-mcp/src/tools/` and
`packages/pipeline-core/src/entity/graph-builder.ts` (`linkTypeFor`).

| Tool | What the handler returns | Key args |
|------|--------------------------|----------|
| `resolve_entity` | Canonical name, confidence, aliases, appearances (`module`, `role`, `date`, `sourceUrl`) from the local entity graph. Empty graph is not proof of absence. | `name` (required), `type` (`person` \| `organization` \| `auto`, default `auto`), `threshold` (0.5–1.0, default 0.7) |
| `linked_entities` | Per-registry buckets for the same graph (lobbying, GIC, committees, corporate, and others) plus connections. | `name` (required), `type`, `threshold` (same defaults as `resolve_entity`) |
| `get_entity_profile` | `mpFound` / `mpDetails` if the name is in the first five Open Parliament politicians. `lobbyingRecords` and `gicAppointments` are CKAN package-search totals, not registry rows. | `name` |
| `find_connections` | Graph edges. Report `relationship` as returned. The writer stores `affiliation`, `employs`, `co-mentioned`, `collaborates`, `based-in`, `location-of`, `located-in`, `headquartered`, or `co-occurs-with`. Also `weight`, `source`, `target`, `discoveredBy`. The handler ignores `type`. | `name` (required), `maxConnections` (1–50, default 20). `type` is in the schema and unused. |
| `search_gic` | Infobase GC search results. Optional `department` is a client-side filter. | `query` (required), `department`, `limit` (default 10, max 50) |
| `search_corporate` | CKAN packages for `query` plus `lobbying`. `dataset` is echoed and not applied. | `query` (required), `dataset` (unused), `limit` (default 10, max 50) |
| `search_corporate_registry` | CKAN packages for `query` plus `corporate registry`. | `query` (required), `limit` (default 10, max 50) |
| `search_committees` | CKAN packages for `query` plus `committees`. Discovery-only (bodies stripped). `committee` filters the page. `chamber` is echoed and not applied. | `query` (required), `chamber` (unused), `committee`, `limit` (default 10, max 50) |
| `search_debates` | First Open Parliament `/debates/` page, then a client-side text filter. Dates, numbers, and frequent words. Not the debate text. | `query` (required), `limit` (default 10, max 50) |
| `search_votes` | First Open Parliament `/votes/` page, then a client-side text filter. | `query` (required), `limit` (default 10, max 50) |
| `search_financial_regulation` | CKAN packages for `query` plus `financial regulation banking`. Not an OSFI, CDIC, or FCAC API. | `query` (required, max 500), `limit` (default 20) |
| `search_proactive_disclosure` | CKAN package search of the raw query. No dollar-amount filter. | `query` (required), `limit` (default 20) |
| `track_bill` | First Open Parliament page of bills, debates, and votes, filtered in process. Not a full LEGISinfo lifecycle. | `query` (required) |
| `search_bills` | Same bills page as `track_bill`, without a `claims` array. | `query` (required), `limit` (default 10, max 50) |
| `get_citation` | Stored citation for a hash. Accepts `sha256:` or 64 hex characters. | `hash` |
| `verify_claim` | Store lookup, and a recompute when `data` is set. The recompute hashes `canonicalJson(data)`, not the raw string. | `sha256`, optional `data` |

These tools attach a `claims` array (`sha256` is 64 hex characters, plus
`claim`, `sourceName`, `sourceUrl`): `resolve_entity`, `linked_entities`,
`find_connections`, `get_entity_profile`, `track_bill`, `signal_check`,
`fact_check`, `ai_ask`.

`search_gic`, `search_corporate`, `search_corporate_registry`,
`search_committees`, `search_debates`, `search_votes`,
`search_financial_regulation`, `search_proactive_disclosure`, and
`search_bills` do not. Do not invent a hash for them.

A claim digest is SHA-256 of canonical JSON (object keys sorted at every
depth) of the claim `value`. The public `claims` entry does not include
`value`. Reproduce a known value with `echo -n '<canonical json>' | sha256sum`.
Do not hash the claim sentence with `echo -n '<data>' | sha256sum`.
