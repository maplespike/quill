# claim-raw-body-retention

## Why

Quill records a SHA-256 of every captured record but retains nothing, so a digest is a claim about bytes nobody stored. PROVENANCE.md is explicit: an evidence-grade row-level chain still requires retained or reproducibly addressable raw artifacts. A claim bundle's artifact must be re-verifiable months later from retained bytes, not from re-fetching a mutable upstream.

## What Changes

- Add an optional `rawBody` field to `ClaimItem` and `ClaimBundle` in `packages/pipeline-core/src/claims/index.ts`.
- `buildClaimBundle` hashes the retained body when one is supplied; otherwise it retains the canonical serialization it just hashed, so the bundle always carries the bytes its digest covers.
- The ingestion hook (`recordToClaim`) sets `rawBody` to the canonical JSON of each parsed record, so every claim registered by `registerModuleClaims` carries its own retained bytes.
- Retention is observable: `ClaimBundle.rawBody` is a first-class bundle field, persisted in `citation_json` by the existing citation store, and every bundle exposes either the retained bytes or their absence.
- No new storage substrate, size cap, or retention-window policy in this change; the retained body is the canonical record serialization, not the upstream HTTP response bytes (those remain covered by `sourceArtifactsEvidence` with their own digests and `bodyCapture` state).

## Capabilities

### New Capabilities

- `claim-raw-body`: A claim bundle retains the exact byte string its recorded SHA-256 was computed over, so record integrity is re-verifiable from retained bytes.

### Modified Capabilities

- None. This change adds a retention field; it does not alter provenance-evidence association, publisher-terms, or legacy-compatibility behavior.

## Impact

- **Affected packages:** `pipeline-core` only (claims + ingest hook + tests).
- **API/MCP:** Additive optional field on stored claim bundles; no route, tool, or protocol change. `verify_claim` output is unchanged; retained bytes re-verify under the existing `verifyClaimHash`.
- **Storage:** `rawBody` persists inside the existing citation JSON column. Legacy rows without `rawBody` remain readable; absence is not an error.
- **Dependencies/module count:** Unchanged.
- **Out of scope:** Retaining upstream HTTP response bytes end-to-end (the `httpGet` capture path already digests those; retention of upstream bytes belongs to a content-addressed store with lifecycle policy), size caps, retention windows, and GC of retained bodies.
