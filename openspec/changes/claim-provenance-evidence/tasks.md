## 1. Provenance model and capture

- [x] 1.1 Separate explicit record artifact evidence from request-local captured artifacts during claim registration
- [x] 1.2 Validate URL association as absolute HTTP(S); reject empty, relative, malformed, and non-HTTP(S) URLs
- [x] 1.3 Preserve every explicit valid artifact with `not-established` association when unmatched; preserve all matching ambient artifacts in capture order
- [x] 1.4 Mark successfully read empty response bodies as `complete-http-client-body` with an empty-body digest and zero byte length
- [x] 1.5 Remove claim-registration-time default from `retrievedAt`; propagate only actual acquisition timestamps

## 2. Legacy storage and API compatibility

- [x] 2.1 Add a legacy claim-bundle decoder/normalizer for stored citation JSON missing v1 evidence
- [x] 2.2 Ensure legacy records with registration timestamps do not expose them as source retrieval times
- [x] 2.3 Keep API and MCP verifier outputs backward-compatible while representing unavailable evidence as null/unknown
- [x] 2.4 Clarify hash-store/index match scope without changing existing `verified` semantics unexpectedly

## 3. Tests

- [x] 3.1 Add evidence tests for explicit unmatched artifacts, multiple explicit artifacts, invalid/empty URLs, and query-redacted matches
- [x] 3.2 Add HTTP capture tests for empty body digest, byte length, timestamp, and URL redaction
- [x] 3.3 Add claim-ingestion integration test for matching/nonmatching captures through registry-scoped context and storage
- [x] 3.4 Add legacy citation JSON read/verify test (missing evidence and retrieval fields)
- [x] 3.5 Add API/MCP serialization tests for null evidence and null source retrieval timestamps (legacy-bundle suite in `packages/api-server/src/__tests__/verify-claim.test.ts`; MCP framing in `packages/quill-mcp/src/tools/__tests__/index.test.ts`)

## 4. Documentation and generated surfaces

- [x] 4.1 Update `PROVENANCE.md` for explicit evidence retention, URL validation, multi-artifact behavior, and empty-body semantics
- [x] 4.2 Correct citation claims in English and French portal copy and SDK/MCP descriptions
- [x] 4.3 Correct canonical Markdown docs and regenerate only derived docs that are actually served (`packages/portal/dist/docs` via `scripts/build-docs.mjs`)
- [x] 4.4 Fix portal OpenAPI generator so endpoint response schemas reflect actual route contracts and avoid duplicate parameters
- [x] 4.5 Regenerate and validate portal OpenAPI and LLM artifacts; confirm root/public copies match where expected

## 5. Verification

- [x] 5.1 Run focused pipeline-core build/tests (`tsc -b` clean; `provenance-evidence.test.ts` + `http.test.ts` 16/16 pass)
- [x] 5.2 Run API-server typecheck and claim-verification tests (`tsc --noEmit` clean; `verify-claim.test.ts` 12/12 pass)
- [x] 5.3 Run quill-mcp typecheck and focused citation/claim tests (`tsc -b` clean; `src/tools/__tests__/index.test.ts` 14/14 pass)
- [x] 5.4 Run portal build/check and portal tests; separate existing failures from regressions (vitest 28/28 pass; `astro check` reports only the two pre-existing TS2352 casts in `embedded-checkout.test.ts:43,52`)
- [x] 5.5 Run targeted stale-claim search and `git diff --check`; preserve unrelated working-tree edits (`git diff --check` clean)
- [x] 5.6 Review remaining limitations and keep the separate software-license audit incomplete until its own evidence tasks are done
