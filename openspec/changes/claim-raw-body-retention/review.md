## Spec Compliance

- [x] Every requirement from the specs has at least one corresponding implementation task
- [x] Every scenario is testable (can write a test for it)
- [x] No requirements conflict with existing system behavior
- [x] Requirements are specific enough to verify after implementation

## Design Alignment

- [x] Technical approach sound for this codebase
- [x] Architecture decisions documented with rationale
- [x] No unnecessary new dependencies
- [x] Data flow is correct (retained bytes are the hashed bytes; single path)

## Risk Assessment

- [x] Edge cases identified and handled (legacy rows, caller-supplied bodies, absence never fabricated)
- [x] Rollback plan documented (additive optional field; revert-safe)
- [x] Security implications considered (no new untrusted input; bytes already persisted in citation_json)
- [x] Performance impact evaluated (one extra string reference per bundle; no extra hashing pass)
- [x] Migration path clear (no schema change; citation_json already round-trips the bundle)

## Completeness

- [x] All proposal capabilities covered by specs
- [x] Scope creep identified and flagged (upstream response retention deferred with rationale)
- [x] Out-of-scope items explicitly called out

## Reviewer Notes

Verified by execution: `pnpm --filter @maplespike/pipeline-core test` → 1191 pass / 0 fail (5 new retention tests included), and `pnpm --filter @maplespike/pipeline-core build` clean. The invariant `sha256(rawBody) === bundle.sha256` is asserted for hook-registered claims, caller-supplied bodies, and post-persistence reads.
