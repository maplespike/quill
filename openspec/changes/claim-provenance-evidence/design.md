# Design: Claim provenance evidence

## Context

`ClaimBundle` currently hashes `canonicalJson(value)`. A shared `httpGet()` can observe client-visible response text during a `runModule()` call, and `AsyncLocalStorage` scopes those artifacts to the module invocation plus claim registration. Records may also supply explicit `source_artifacts_evidence`. The existing evidence builder currently drops explicit unmatched artifacts, can equate empty URLs, and labels an empty-but-read response body as not captured. `buildClaimBundle()` also defaults `retrievedAt` to the current time, which conflates claim registration with upstream acquisition.

## Goals

- Preserve the distinct scope and meaning of record hash, HTTP-body digest, and publisher terms.
- Retain valid explicit evidence without overstating its association.
- Attach ambient request evidence only under a meaningful HTTP(S) URL match.
- Keep capture best-effort and avoid source-data reuse gates.
- Keep legacy persisted citation rows readable.

## Non-Goals

- Do not claim row-level source lineage or source authenticity from URL equality.
- Do not capture all fetchers, custom clients, browser/cache paths, or raw source bodies.
- Do not infer publisher permissions or choose a software-license policy.
- Do not add a database migration unless storage tests demonstrate it is necessary; the evidence remains inside existing citation JSON.

## Decisions

### D1: Evidence source categories

Separate explicitly supplied artifact evidence from request-local captures in the ingestion hook. Keep all structurally valid explicit artifacts. For shared-client captures, require normalized valid absolute HTTP(S) URLs on both sides and retain every matching artifact in capture order. Do not attach request captures with nonmatching URLs. This avoids losing stronger record-supplied evidence while keeping ambient evidence conservative.

### D2: URL normalization

For association only, remove credentials, query, and fragment and normalize URL serialization/trailing slash. This intentionally sacrifices query-specific reproducibility; preserve `url_redacted` so readers know the retained URL is incomplete. Reject empty, relative, malformed, and non-HTTP(S) URLs before comparison. Do not use a fabricated fallback string as a match key.

### D3: Body capture semantics

`httpGet()` records the digest of the UTF-8 response string delivered by undici/the mock fetch. A zero-length body has a valid SHA-256 and was fully read, so it uses `complete-http-client-body` with byte length zero. Do not call it wire bytes; HTTP decoding/decompression may already have happened.

### D4: Time semantics and legacy rows

Make `ClaimItem.retrievedAt` optional evidence of a source retrieval time, not a registration default. `buildClaimBundle()` no longer mints one. Claims may still expose `created_at` from CitationStore, which remains clearly a Quill claim-store timestamp. On reading old JSON, a compatibility adapter can derive v1 evidence only when persisted evidence fields support it; otherwise report evidence unavailable and retrieval unknown, not fabricate it. Do not alter the stored record hash.

### D5: Legacy evidence construction

Keep `ClaimBundle.provenanceEvidence` optional at the read boundary rather than making legacy JSON fail type-level assumptions. New bundle construction always emits v1 evidence. API and MCP output adapters serialize absent evidence as `null`/unavailable. Add fixtures proving a legacy citation JSON can be retrieved without changing its existing hash or source timestamp semantics.

### D6: Verification labels

`verified` remains the existing hash/store or index-match result for backward compatibility. Docs and UI must explain what check occurred and not call it source-authenticated. Where practical, expose a separate verifier scope/result label rather than redefining the existing boolean in a breaking way.

## Risks / Trade-offs

- Redacted URLs can collapse distinct query-addressed resources. Keep redaction explicit and never label this as content lineage.
- Evidence arrays can grow with retries. Keep per-run artifact handling bounded or rely on existing ingestion record caps; inspect real retry volume before choosing a cap.
- Changing `retrievedAt` to nullable affects APIs and MCP schemas. Keep JSON field presence stable where feasible (`null`), and update contract tests.
- Historical rows remain heterogeneous. Decoding must tolerate absent v1 keys while new writes use the complete schema.

## Migration Plan

1. Add the OpenSpec contract and unit/integration tests.
2. Update provenance types, evidence builder, request-local capture, and claim timestamp semantics.
3. Add a legacy-bundle normalizer at CitationStore read boundaries and serialize null/unknown evidence in API/MCP adapters.
4. Correct source docs/generators, then regenerate only the relevant OpenAPI and LLM artifacts.
5. Run focused package checks and portal build/check. No backfill or source record rehash occurs.

## Open Questions

- A full lineage solution needs fetcher-specific source artifact identifiers and retained or content-addressed raw artifacts; this design explicitly does not solve those needs.
- Verify whether SQLite historical rows are present in deployed data stores and whether a separate read-only audit utility is needed to quantify legacy coverage.
