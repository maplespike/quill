# claim-provenance-evidence

## Why

Quill's record hash, captured HTTP response evidence, and source terms are distinct facts, but current code can blur capture, URL association, and claim-registration time. The contract must preserve evidence without implying artifact-to-record lineage, source authenticity, or reuse rights.

## What Changes

- Define a versioned, additive provenance-evidence contract for stored claim bundles and public verification surfaces.
- Keep explicitly supplied artifact evidence, but mark association as unestablished unless a valid HTTP(S) source URL matches after documented URL redaction.
- Attach request-local HTTP captures to records only on a meaningful URL match; do not match missing, empty, or invalid URLs.
- Mark an empty but fully read HTTP response body as captured, and stop presenting claim-registration time as source retrieval time.
- Keep historical claim bundles readable and treat absent evidence/timestamps as unknown.
- Correct generated/public documentation and portal copy so hash coverage and lineage are not overstated.

## Capabilities

### New Capabilities
- `claim-provenance`: Evidence scope, capture association, timestamp, publisher-terms, and compatibility behavior for claim records.

### Modified Capabilities
- None. This change adds a claim-evidence contract; it does not change the separate software-license audit or infer source-data reuse rights.

## Impact

- **Affected packages:** `pipeline-core`, `api-server`, `quill-mcp`, and `portal`; docs in `packages/docs` and generated portal artifacts.
- **API/MCP:** Additive/nullable evidence output; no new route or runtime license gate.
- **Storage:** Continue storing evidence inside the existing citation JSON; legacy rows lacking v1 evidence remain readable and serialize as evidence unavailable.
- **Dependencies/module count:** Unchanged.
- **Out of scope:** Full fetcher coverage, exact row-to-artifact lineage, retaining raw response bodies, transform build/version capture, software dependency licensing, and publisher rights determinations.
