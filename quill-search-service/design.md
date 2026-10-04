# Design: quill-search (issue #976)

## Context

Quill's search today is a lowercase substring scan over cached JSON blobs
(`packages/api-server/src/routes/municipal.ts:1218–1224`) and a live CKAN proxy
with no local index (`packages/api-server/src/routes/gov.ts:95`). Decision
2026-10-04: the platform stays TypeScript; Rust enters as additive seams. This
is R1: plant the toolchain, CI, and deploy muscle on a service whose failure is
survivable. astral-key is the precedent — a focused Rust service beside the
Node platform.

## Goals / Non-Goals

**Goals**

- A standalone tantivy-backed search service over Quill's own corpus, with a
  stable JSONL corpus contract.
- Real numbers: criterion benches + a faithful re-implementation of the current
  substring baseline over the same corpora.
- Dark deployment: builds, pins, schedules — but receives zero traffic.
- Small interface (deep module): corpus in, three HTTP endpoints out.

**Non-Goals**

- Traffic cutover for any surface (R2, gated on these benchmarks).
- MCP tool wiring; api-server client integration; FTS5; Qdrant; indexing all
  207 module datasets.

## Decisions

### D1: tantivy (vs SQLite FTS5, vs Node search libs)

FTS5 stays the documented fallback but plants no seam and locks search quality
into SQLite. minisearch/lunr have weaker ranking + scale stories and no
strategic value. Qdrant is vector search — wrong tool for exact/keyword
retrieval; the lexical index complements it for later hybrid retrieval.
tantivy is the maintained Rust FTS engine behind Quickwit, with the BM25
ranking + snippet generation the current path lacks.

### D2: axum + tokio; two subcommands in one binary

`quill-search index` (batch build; writes a directory) and `quill-search serve`
(HTTP on 8083, private metrics on 9466). One crate keeps the seam small; a
separate `quill-search-bench-gen` crate generates the deterministic bench
corpora (also usable by the Node baseline script). Dependencies stay lean:
tokio, axum, tantivy, serde, tracing-subscriber, metrics-exporter-prometheus.

### D3: Atomic index swap via ArcSwap-style hot path

`serve` holds the open index behind an `Arc<RwLock<IndexHandle>>`. Rebuild path:
build to a NEW directory (`--out <dir>`), then a `SIGHUP` (or rebuild run)
opens the new directory and swaps the handle; readers see either the old or
the new complete index, never a half-built one. tantivy opens a directory
read-only after `commit`, so the swap is a pointer change.

### D4: Metrics private (pattern from #969)

The public listener (8083) serves only `/health`, `/v1/search`, `/stats`;
`/metrics` is absent there (axum fallback → 404). A second listener (9466,
cluster-internal) exposes the Prometheus text format. Counters/histograms are
bounded: a small fixed set (requests_total, search_duration_ms histogram,
docs gauge). No VMServiceScrape in this change (follow-up).

### D5: Corpus exporter in Node (tsx), reading the live cache

`scripts/export-search-corpus.mts` uses `node:sqlite` exactly as
`packages/api-server/src/cache/municipal.ts` does (fresh `DatabaseSync`, same
schema bootstrap, WAL). Municipal docs: one per record inside `records_json`,
id `<cityId>:<dataset>:<recordId>` mirroring the route's id composition.
Module docs: from `registry-snapshot.ts` (name, description, category,
sources). `--no-db` mode keeps the exporter usable without a DB (also the
shape CI can exercise). Deterministic ordering: municipal sorted by
(city_id, dataset, record index); modules by registry order.

### D6: Image: fixture index baked in

`Dockerfile.search` multi-stage: `rust:1-bookworm` builder (cargo build
--release, cargo-chef-less; lockfile committed so the layer is cacheable) →
`debian:bookworm-slim` runtime with the binary, plus a sample index built from
the committed `rust/fixtures/sample.jsonl` so the container answers queries
out of the box. The container is self-contained — dark deploy verifies health
without any export step on the cluster.

### D7: Chart: ClusterIP-only, gated

`search.enabled: true` renders Deployment + ClusterIP Service. No Ingress
template touches it; `cloudflared.ingress` list gains no entry. The pod is
covered by the existing namespace NetworkPolicy default-deny + intra-namespace
allow: the intra-namespace allow list gains port 8083 so in-namespace callers
could reach it later (R2) — no edge can.

### D8: CI: separate `rust` job

Rust is not on the runner PATH (mise shims are invisible to the systemd
runner — the `gh` precedent). Use `dtolnay/rust-toolchain@stable` +
`Swatinem/rust-cache@v2`; the "no setup actions" rule in ci.yml covers
node/pnpm only (both preinstalled). Job runs `cargo fmt --check`, `clippy
-D warnings`, `cargo test --all`. Anchored to the workspace root so path
filters stay simple.

### D9: Benchmarks live in-repo, recorded by hand

Criterion holds the measurement; `docs/rust-search-bench.md` holds the
recorded run (date + host). Bench corpora (1k/10k/100k) are generated
deterministically by `quill-search-bench-gen` at bench time — never committed
(flat-file size); the ≤200-doc handcrafted fixture IS committed for tests and
the baked image sample.

## Data Flow

```
municipal_records_cache (SQLite, QUILL_DB_PATH)  ┐
                                                ├─ scripts/export-search-corpus.mts → corpus.jsonl
registry-snapshot.ts (module registry)          ┘
                                                      │
                                                      ▼
                               quill-search index --corpus corpus.jsonl --out /data/index
                                                      │
                                                      ▼
                               quill-search serve --index /data/index --port 8083
                                 ├─ GET /health   (public)
                                 ├─ GET /v1/search (public)
                                 ├─ GET /stats     (public)
                                 └─ GET /metrics   (private, 9466)
```

No vector search / Qdrant involvement. No schema changes anywhere.

## Security

- Service listens on cluster-internal ClusterIP only; no edge (cloudflared,
  LAN proxy) routes to it. The namespace default-deny NetworkPolicy applies.
- The service is read-only over its index directory; it makes no outbound
  calls. It holds no secrets.
- Runtime container runs as non-root (USER 1001), matching Dockerfile.api.

## Rollout / Rollback

- Rollout: merge PR → CI green → operator pins the image on nexus
  (`scripts/pin-images.sh --svc search`) → commit the pin in
  `values-prod.yaml` → ArgoCD syncs → verify pod + in-cluster health.
- Rollback: delete the Deployment (or set `search.enabled: false`). Nothing
  else references the service; the kill switch is deleting one object.
- No data migration; the index is a derived artifact rebuilt from the corpus
  at any time.

## Risks / Trade-offs

- [Index freshness] The index is a snapshot; it does not follow live cache
  writes until a re-export + rebuild. → Mitigation: the ops runbook documents
  the rebuild loop; R2 wires automation if cutover is approved.
- [Rust toolchain on the runner] mise shims are invisible to the runner
  service. → Mitigation: dtolnay/rust-toolchain action (explicitly allowed in
  the issue; the no-setup rule covers node/pnpm only).
- [Bench machine variance] Numbers depend on host. → Mitigation: record date +
  host in the bench doc; targets are initial, deviations documented.
- [Registry snapshot drift] `registry-snapshot.ts` is manually synced with
  pipeline-core. → Mitigation: the exporter reads the snapshot as the api
  server does; drift is a pre-existing documented issue, not introduced here.

## Open Questions

- None blocking. VMServiceScrape wiring and any automation cadence for
  re-export/rebuild are follow-ups (R2 material).
