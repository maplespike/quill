## ADDED Requirements

### Requirement: Corpus contract

The service SHALL consume a JSONL corpus where each line is one document with fields `id`, `kind`, `title`, `text`, `url`, `source`, `published`, `updated`, `meta` (object), and the exporter `scripts/export-search-corpus.mts` SHALL produce this format from (a) rows of `municipal_records_cache` — exploding `records_json` into one doc per record, reusing the documented semantics of `packages/api-server/src/cache/municipal.ts` — and (b) one doc per module from `packages/api-server/src/registry-snapshot.ts`.

#### Scenario: Exporter produces valid JSONL

- **WHEN** the exporter runs against a Quill SQLite DB (`QUILL_DB_PATH`) that has municipal cache rows
- **THEN** the output SHALL be JSONL with one line per cached record, each line a complete document object, in deterministic order

#### Scenario: Missing DB degrades honestly

- **WHEN** `QUILL_DB_PATH` is unset or the DB has no cache rows
- **THEN** the exporter SHALL emit only module-registry docs (zero municipal docs), print a count summary to stderr, and exit 0

#### Scenario: Exporter runs without a DB

- **WHEN** the exporter runs with `--no-db`
- **THEN** it SHALL emit module-registry docs only and exit 0

### Requirement: Index subcommand

`quill-search index --corpus <jsonl> --out <dir>` SHALL build a tantivy index from the corpus into the output directory and print the indexed-doc count; indexing the same corpus SHALL be deterministic (byte-identical order of `meta.json`/`documents.json`).

#### Scenario: Index a fixture corpus

- **WHEN** `quill-search index` runs on the committed fixture `rust/fixtures/sample.jsonl`
- **THEN** the command SHALL exit 0 and print a count equal to the fixture's line count

#### Scenario: Reject a malformed corpus

- **WHEN** a corpus line is not valid JSON or misses a required field (`id`, `title`, `text`)
- **THEN** the command SHALL fail with a non-zero exit and an error naming the line number

### Requirement: Serve subcommand — health

`quill-search serve --index <dir> --port 8083` SHALL expose `GET /health` returning `{"status":"ok","docs":N,"built_at":"..."}` with HTTP 200.

#### Scenario: Health after boot

- **WHEN** the service serves a built index
- **THEN** `GET /health` SHALL return 200 with `status: "ok"` and `docs` equal to the indexed count

### Requirement: Serve subcommand — search

`GET /v1/search?q=<query>&limit=<n>&kind=<k>` SHALL return ranked results with snippets, `took_ms`, and `total`; `limit` SHALL default to 20 and cap at 100; `kind` SHALL filter to one doc kind when present.

#### Scenario: Ranked hit on the fixture

- **WHEN** `GET /v1/search?q=<fixture term>` runs against the fixture index
- **THEN** the response SHALL return HTTP 200, the pinned expected document as the top hit, a non-empty snippet, and `total >= 1`

#### Scenario: Kind filter

- **WHEN** a query with `kind=module` runs against an index holding both municipal and module docs
- **THEN** every returned result SHALL have `kind: "module"`

#### Scenario: Empty and missing query

- **WHEN** `q` is empty or absent
- **THEN** the endpoint SHALL return HTTP 400 with an error body, not a 500

### Requirement: Stats endpoint

`GET /stats` SHALL return corpus and index statistics (doc count, per-kind counts, index byte size, build timestamp).

#### Scenario: Stats shape

- **WHEN** the service is up
- **THEN** `GET /stats` SHALL return 200 with `docs`, `kinds`, `index_bytes`, `built_at`

### Requirement: Metrics are private

Metrics SHALL be exposed on a private port (default 9466) with bounded counters/histograms following the pattern landed in #969; the public port SHALL return HTTP 404 for `/metrics`.

#### Scenario: Public metrics 404

- **WHEN** `GET /metrics` hits the public port (8083)
- **THEN** the response SHALL be 404

#### Scenario: Private metrics scrape

- **WHEN** `GET /metrics` hits the private port (9466)
- **THEN** the response SHALL be 200 with a Prometheus text payload including a `quill_search_docs` gauge

### Requirement: Atomic index swaps

The service SHALL build (or receive) a new index in a separate directory and swap atomically; it SHALL never serve a partially built index.

#### Scenario: Rebuild and swap

- **WHEN** a new index is built to a new directory and the service reloads (`SIGHUP` or a rebuild subcommand run)
- **THEN** queries before, during, and after the swap SHALL all return complete results, and `/health` SHALL report the new doc count after the swap

### Requirement: Benchmarks recorded

Criterion benches SHALL measure index build throughput and query p50/p95 at 1k/10k/100k docs from a deterministic generator; `scripts/bench-search-baseline.mjs` SHALL re-run the current substring semantics (`municipal.ts:1218–1224`) over the same corpus; results SHALL be recorded in `docs/rust-search-bench.md` with date and host — no placeholders.

#### Scenario: Bench file holds real numbers

- **WHEN** `docs/rust-search-bench.md` is reviewed after a bench run
- **THEN** it SHALL contain a table with measured build time, index size, query p50/p95, and the substring-baseline comparison for each corpus size, each from a real run

### Requirement: Dark deployment

`charts/quill` SHALL ship a `quill-search` Deployment + ClusterIP Service only — no ingress, no tunnel route, no Cloudflare entry, no public hostname — gated on `search.enabled` (default true), and no existing workload's behavior SHALL change.

#### Scenario: Chart renders dark

- **WHEN** `helm template charts/quill` runs with production values
- **THEN** it SHALL emit a `quill-search` Deployment and ClusterIP Service, and SHALL NOT emit any Ingress or route referencing quill-search

### Requirement: No traffic cutover

No Quill route handler, MCP tool, or client SHALL call quill-search in this change; the service receives zero production traffic.

#### Scenario: Existing surfaces unchanged

- **WHEN** the diff is reviewed
- **THEN** no file under `packages/api-server/src/routes/`, no MCP tool, and no chart edge (ingress/cloudflared) SHALL reference quill-search
