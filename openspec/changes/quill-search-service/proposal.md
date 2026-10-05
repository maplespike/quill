# Proposal: quill-search — first Rust seam (issue #976)

## Why

Quill has no unified lexical index over its own corpus. `/v1/municipal/search`
scans cached JSON blobs with a lowercase substring match — the code itself flags
"future work: FTS5 virtual table over records_json"
(`packages/api-server/src/routes/municipal.ts:1218–1224`). `/v1/gov/search` is a
live CKAN proxy with no local index (`packages/api-server/src/routes/gov.ts:95`).
The decision record (2026-10-04) settles the Rust question for this repo: TS
stays the platform language; Rust enters as focused, additive seams. The first
seam is search, measured against the current path.

## What Changes

- **New Rust workspace `rust/`** with crate `quill-search`: a standalone
  full-text search service (tantivy) over a JSONL corpus, one binary, two
  subcommands (`index`, `serve`). No existing TS behavior changes.
- **Corpus exporter** `scripts/export-search-corpus.mts` (tsx): municipal records
  from `municipal_records_cache` (SQLite via `node:sqlite`, same semantics as
  `packages/api-server/src/cache/municipal.ts`) + module registry docs from
  `packages/api-server/src/registry-snapshot.ts`.
- **Interface contract v1** (JSON over HTTP, port 8083; metrics on private port
  9466): `GET /health`, `GET /v1/search?q=&limit=&kind=`, `GET /stats`.
  Atomic index swaps. Public `/metrics` 404s (private-metrics pattern, #969).
- **Benchmarks**: criterion benches (index build throughput; query p50/p95) at
  1k/10k/100k docs from a deterministic generator, plus
  `scripts/bench-search-baseline.mjs` re-implementing the current substring
  semantics over the same corpus. Results recorded in
  `docs/rust-search-bench.md`.
- **Build + chart + CI wiring**: `Dockerfile.search` (fixture index baked in),
  `scripts/pin-images.sh` learns `search`, `charts/quill` gains a dark
  `quill-search` Deployment + ClusterIP Service (no ingress, no route, no
  Cloudflare entry), a new `rust` CI job (fmt, clippy, test).
- **Docs**: `docs/rust-search.md` (architecture + ops runbook).

## Capabilities

- **New capability**: `quill-search` (one spec file, `specs/quill-search/spec.md`).
- No existing capabilities modified — no route handler, service, or chart
  behavior changes.

## Impact

- Affected packages: none of the 14 TS packages (verifier: `pnpm -w build`
  unaffected). New top-level `rust/` workspace (2 crates: `quill-search` +
  `quill-search-bench-gen` fixture generator).
- New deployment: `quill-search` (dark — zero user-facing surface changes; kill
  switch = delete the Deployment).
- Dependencies: lean Rust set — tokio, axum, tantivy, serde, metrics-exporter-
  prometheus (bounded, matching #969).
- `scripts/generate-metrics.mjs` / `check-count-consistency.mjs` verified to
  ignore `rust/` (they scan `packages/` + registry only).
- Deploy: post-merge dark deploy via `scripts/pin-images.sh --svc search` on
  nexus; ArgoCD syncs; no traffic cutover (that is R2, gated on benchmarks).
