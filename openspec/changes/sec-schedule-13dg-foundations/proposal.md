# Proposal: Disabled Schedule 13D/G foundations

## Why

Quill by Maplespike has no safe place to hold a future SEC Schedule 13D/G entity record. A disabled, synthetic foundation can lock the admission rules before any live source exists. Research notes are not an admission to turn the source on.

## What Changes

- Add an in-memory parser, admission check, provenance record, retention contract, and kill switch under `packages/pipeline-core/src/disclosures/schedule-13dg/`.
- Keep the code out of the ingestion registry, the scheduler, and the HTTP routes.
- Reject live ingestion. The live function throws and does not call the network.
- Record the blocked enablement gates in the architecture docs.
- Add synthetic contract tests. Do not commit pilot rows.

## Capabilities

### New Capabilities

- `sec-schedule-13dg`: Disabled entity-only Schedule 13D/G contracts for Quill by Maplespike.

### Modified Capabilities

- None. Existing ingestion, SEDI, and licence specs are unchanged.

## Impact

- New files in `packages/pipeline-core` and `docs/sources/sec-schedule-13dg.md`.
- A short section in `docs/ARCHITECTURE.md`.
- No API route, MCP tool, database migration, chart, workflow, or registry count change.
- No new dependency. `fast-xml-parser` is already in the package.
- Open SEDI removal and licence-policy pull requests are not edited.
