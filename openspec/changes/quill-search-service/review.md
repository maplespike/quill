# Review: quill-search-service (pre-implementation gate)

## Spec Compliance

- Every requirement in `specs/quill-search/spec.md` maps to a concrete
  verification: exporter → integration test + CLI run; index/serve/search/
  stats/metrics → Rust integration tests against the committed fixture;
  benchmarks → criterion + `bench-search-baseline.mjs` + recorded doc; dark
  deployment → `helm template` assertions + post-merge probes.
- Each scenario is independently testable — no scenario depends on another.
- Ranking target pinned: the fixture's expected top hit for a fixture term is
  asserted by an integration test (the CHECK/EXPECT contract of #976).

## Design Alignment

- Matches the astral-key precedent: focused Rust service, Node platform
  untouched.
- Lean dependency set matches the issue constraint (tokio + axum + tantivy +
  serde + metrics).
- Image follows Dockerfile.api conventions (multi-stage, non-root USER 1001,
  ca-certificates in runtime).
- Chart follows existing deployment/service/networkpolicy patterns
  (digest-pinned image via `quill.image`, build-tag annotation, ClusterIP
  only, default-deny coverage).

## Risk Assessment

- Edge cases identified: empty query (400 not 500), malformed corpus lines
  (error with line number), missing DB (exporter degrades to modules-only),
  oversized limit (caps at 100), empty index (health still 200, search
  returns zero results).
- Rollback exists and is one object: delete the Deployment / set
  `search.enabled: false`. No traffic depends on the service.
- Security considered: no secrets, no outbound calls, non-root container,
  no edge exposure, private metrics port.

## Completeness

- All nine deliverables of the issue have an owner artifact: OpenSpec change
  (this), crate + exporter + tests, benches + recorded doc, Dockerfile.search
  + pin-images wiring, chart templates + values, CI rust job, ops docs.
- Out-of-scope items explicitly excluded (cutover, MCP wiring, FTS5,
  Qdrant, 207-dataset indexing).
- `generate-metrics.mjs` / `check-count-consistency.mjs` confirmed scoped to
  `packages/` + registry — `rust/` cannot affect them (verified by running
  both after the change).

## Verdict

Proceed to implementation. No blockers.
