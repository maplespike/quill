# Design: Disabled Schedule 13D/G foundations

## Context

Quill by Maplespike already has ingestion modules, a licence policy map, and open pull requests that delete SEDI (#1324) and extend licence policy (#1323, #1325). The merge-gate repair is #1341. This change does not edit those files or workflows.

The research packet is evidence only. It is not fixture data and not an enablement admission. Operator corrections override it: the R1 field list is incomplete; identity, privacy, retention, corrections, access, and language all block enablement; a type code and a 13F-manager flag never prove eligibility; an entity-type screen is not an admitted count. A source-byte hash, which the research note suggested, is not stored.

## Goals / Non-Goals

**Goals**

- Parse synthetic Schedule 13D/G XML in memory.
- Drop CUSIP and ISIN fields before a record is built.
- Admit only when every reporting entity has reviewed eligibility.
- Keep event date, filed date, and fetch metadata apart.
- Tombstone and scrub in-memory payloads.
- Fail closed on the kill switch, on live ingest, and on a zero budget.

**Non-Goals**

- Live SEC access, a scheduler, or an HTTP route.
- Registry or MCP tool changes.
- Form 13F, SEDI, SEDAR+, or Section 16.
- A production allow-list or a real issuer row.
- Legal clearance, French copy, or a monitored contact address.
- Deletion claims for databases this source does not write.

## Decisions

- Place the code in `packages/pipeline-core/src/disclosures/schedule-13dg/`, not under `ingestion/`. The registry, the metrics drift path, and the scheduler stay unchanged.
- Export no new package entry and do not re-export from the pipeline barrel.
- Use `fast-xml-parser`, which the package already depends on. Duplicate identity tags stay arrays so two issuer CIKs or two class titles cannot collapse to the last value.
- Return a reason code for every rejection. Do not return the draft.
- Ignore `files13fManager` in the admission predicate. Tests cover both values and require the same decision.
- Keep `liveIngest()` as a throw. The backoff helper accepts an injected transport and is not called by live ingest.
- Treat secondary storage as an explicit attach list. The constructor attaches nothing.

## Risks / Trade-offs

- [In-memory tests pass while a later wiring step forgets the kill switch] → Live ingest cannot succeed in this tree, and the default switch is engaged.
- [A caller attaches a stand-in and treats that as cluster-wide deletion] → The docs name the stand-in and state that other stores do not exist here.
- [Tag coverage is only the synthetic shapes in the tests] → Unrecognized structure fails closed. This is not a claim that every SEC XML variant was parsed.

## Migration Plan

No migration. Rollback is deleting this directory and the two doc edits. No data store is created.

## Open Questions

Maple owns independent review. None of the enablement gates are decided here.
