# tasks — quill-search-service

## 1. Rust workspace + crate

- [ ] 1.1 `rust/Cargo.toml` workspace, `rust-toolchain.toml` (stable), committed `Cargo.lock`, `rustfmt` config
- [ ] 1.2 `quill-search` crate: corpus model (serde), `index` subcommand (deterministic build, line-numbered corpus errors)
- [ ] 1.3 `serve` subcommand: axum on 8083 (`/health`, `/v1/search`, `/stats`), private metrics listener on 9466, `/metrics` 404 on the public port
- [ ] 1.4 Atomic swap: index handle behind RwLock; `SIGHUP` reloads `--index` dir
- [ ] 1.5 `quill-search-bench-gen` crate: deterministic corpus generator (1k/10k/100k)

## 2. Tests

- [ ] 2.1 Unit: corpus parse errors carry line numbers; limit caps; kind filter
- [ ] 2.2 Integration: index fixture → boot serve → ranked top hit pinned, snippet non-empty, `took_ms`/`total` present; empty q → 400; health/stats shapes; public `/metrics` 404; private `/metrics` 200 with `quill_search_docs`
- [ ] 2.3 Integration: SIGHUP swap changes doc count without a partial window

## 3. Exporter + baseline

- [ ] 3.1 `scripts/export-search-corpus.mts` (node:sqlite; municipal explosion per cache semantics; module docs; `--no-db`; deterministic order; summary to stderr)
- [ ] 3.2 `scripts/bench-search-baseline.mjs` — faithful substring reimplementation of municipal.ts:1218–1224 over JSONL corpora

## 4. Benchmarks

- [ ] 4.1 Criterion benches: index build throughput; query p50/p95 at 1k/10k/100k
- [ ] 4.2 Run benches + baseline on this host; record real numbers in `docs/rust-search-bench.md` (date + host)

## 5. Build + chart + CI wiring

- [ ] 5.1 `Dockerfile.search` (multi-stage; fixture index baked; non-root; answers a query out of the box)
- [ ] 5.2 `scripts/pin-images.sh`: `search` in SERVICES + dockerfile_for mapping
- [ ] 5.3 `charts/quill`: search Deployment + ClusterIP Service (gated `search.enabled`), values-prod `search:` block (image pin placeholder per convention), NetworkPolicy port 8083 in intra-namespace allow
- [ ] 5.4 `.github/workflows/ci.yml`: `rust` job (dtolnay/rust-toolchain@stable, Swatinem/rust-cache@v2, fmt/clippy/test)
- [ ] 5.5 `helm template` + `helm lint` green

## 6. Docs

- [ ] 6.1 `docs/rust-search.md`: architecture + ops runbook (export, build, swap, probe, pin)
- [ ] 6.2 Touch up docs enumerating runtime services

## 7. Verification (CHECK/EXPECT from #976)

- [ ] 7.1 `cargo fmt --check && cargo clippy --all-targets --all-features -- -D warnings && cargo test --all` → exit 0
- [ ] 7.2 index fixture → printed count matches; serve → `/health` 200 + doc count; fixture query returns pinned top hit
- [ ] 7.3 `pnpm -w build` + `check-count-consistency.mjs` → exit 0
- [ ] 7.4 PR on `wt/gh976`, body `Closes #976`; commits reference `(#976)`
- [ ] 7.5 (post-merge, ops) dark deploy + probes per issue
