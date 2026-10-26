# Changelog

## [Unreleased] — 2026-10-26

### Changed
- **MCP HTTP clients must authenticate.** `GET /sse`, `POST /messages`, and `POST /mcp` require an API key or a JWT. `GET /health` stays public. An unauthenticated client no longer connects. `OPTIONS` on those paths stays open for browser preflight.
- **Fork pull requests stay on `pull_request` and run on `ubuntu-latest`.** Same-repo pull requests and pushes stay on the self-hosted runners. `runs-on` selects the runner. `merge-when-green.yml` is the only `pull_request_target` workflow. It does not check out pull request code, it runs on `ubuntu-latest`, and it runs only for a same-repo Dependabot or maintainer actor so it can squash-merge. `scripts/gates/check-fork-runner-policy.mjs` rejects a `pull_request_target` checkout of the pull request head and rejects a self-hosted `runs-on` a fork can reach. `scripts/ci/refuse-untrusted-self-hosted.sh` refuses a self-hosted job when the head repository is not this repository. Install that hook on each self-hosted runner. This repository does not install it.

## [Unreleased] — 2026-10-14

### Fixed
- **The atlas WIP-backup leak class: `.gitignore` did not cover the SOPS decrypt-temp shapes (run 38617463045, #1070):** CI's full-history secrets gate failed every main run on 34 findings from commit `fd4f6e08` ("WIP backup 2026-10-14 (atlas)") on `wip/atlas-backup-20261014` — three plaintext decrypts of `secrets/runtime.yaml` (`secrets/tmp.ZMFRg0.yaml`, `secrets/tmp.y8ns8n.yaml`, `secrets/tmp2zgn9_f1.yaml`) carrying the live `sk_live_` Stripe key, plus `.sops.yaml.tmp`, `sbom/` artifacts and `.worktrees/` metadata swept in by the same backup. The operator deleted the branch (rotation tracked in #1070), so the findings left the enforced scan scope and the gate is green again — verified by the rerun of run 38617463045 passing. What stayed open was the class gap: the decrypt-artifact rules in `.gitignore` enumerated artifact extensions (`*.dec`, `*.plaintext`, `*.env`, `decrypted/`) but not the `mktemp` shapes (`tmp.<rand>.yaml`, `tmp<rand>.yaml`) that SOPS editor/decrypt flows actually produce, and #1070 item 7's claim that ".gitignore now covers the leaked classes" was verified false on main (`git check-ignore secrets/tmp.ZMFRg0.yaml` matched nothing). `.gitignore` now ignores `secrets/tmp*`, `secrets/*.tmp`, `.sops.yaml.tmp`, `.sops.yaml.tmp*`, `sbom/` and `.worktrees/` — a recurrence of the unidentified sweep (trigger still unknown, plaintext temps still on the atlas disk per #1070 item 6) commits nothing instead of re-leaking. **Regression tests in `scripts/test-gitignore-leak-shapes.mts`** (runs `tsx --test` in `build-and-test`, part of `pnpm test` via `test:gitignore`) drive the real `git check-ignore` against the repo's real `.gitignore`: the three exact incident paths must be ignored, `mktemp`/suffix variants must be ignored, sealed SOPS files (`secrets/runtime.yaml`, `secrets/billing.yaml`) must stay committable, and a known-trackable path must stay non-ignored as the harness's own negative control. The full-history baseline stays at 17 entries — the leak left the scan scope when the branch was deleted, so baselining it now would fail the gate in the opposite direction (stale entries, the 2026-10-09 failure mode).

## [Unreleased] — 2026-10-09

### Added
- **Full-history secrets gate in CI, and a real pre-public audit (2026-10-09):** `scripts/check-secrets-history.sh` scans the origin refs plus HEAD with a pinned gitleaks and fails on any finding not present in `docs/secrets-history-baseline.txt` (17 reviewed findings, frozen so the gate can land without blocking on a history rewrite). The `secrets` CI job invokes the pinned binary directly rather than the action, so it does not depend on `GITLEAKS_LICENSE`. `docs/security-audit-pre-public.md` records the working-tree + full-history sweep (one benign hit: `.envrc` containing only `use devenv`). Also fixes the 2026-09-21 red-merge class of failure at its source: because branch protection is unavailable on a private free-plan repo there are no required status checks, so native `gh pr merge --auto` merges immediately — the `NONOWN > 0` wait loop in the auto-merge workflows is load-bearing and was kept, but moved off the four-runner self-hosted pool onto `ubuntu-latest` since it uses no toolchain ([#1041](https://github.com/reverb256/quill/issues/1041)). Guard invariant after the change: **20 self-hosted jobs across the PR-triggered workflows, each guarded by `github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository`** so fork PRs never execute on self-hosted runners; verified structurally from parsed YAML, not regex.

### Fixed
- **The secrets gate reported a different finding set locally than in CI (2026-10-09):** `check-secrets-history.sh` scanned with a bare `--log-opts=--all`, which resolves every ref in *whichever clone runs it* — so a stale remote-tracking ref or a never-pushed local branch pulls in commits CI cannot fetch and the two environments stop agreeing. CI failed on three baseline entries (`274c5d1a:.github/workflows/ci.yml:53`, `469cf3d9:scripts/test-image-pins.mts:52` and `:78`) that existed only on `origin/wt/t_2535563a`, a branch already deleted upstream but still present in the local clone. The scope is now explicit — the origin remote's remote-tracking refs plus HEAD (`--glob=refs/remotes/origin/* HEAD`), which is exactly what `actions/checkout` leaves behind at `fetch-depth: 0` — with `--all-refs` keeping the full-local audit available for pre-public sweeps. The baseline drops those three entries (20 → 17); the same `file:line:rule` remains enumerated from commits that still exist. The "gone entry" failure message now names pruning (`git fetch --prune origin`) as the first thing to check, and both `--print-baseline` and a normal run print the scope they scanned. **Regression tests in `scripts/test-secrets-history.mts`** (runs `tsx --test` in `build-and-test`, part of `pnpm test`) pin the scope contract with fixture repos and a fake gitleaks binary: the default scope must be the origin refs + HEAD (never a bare `--all`), a never-pushed branch must not widen it, `--all-refs` must see every ref, the no-remote fallback must announce itself, a stale baseline entry must fail loud with the prune-first hint, and `--print-baseline` must regenerate from the enforced scope only.
- **A stray top-level `if:` key and a duplicated `if:` key in CI workflow YAML (2026-10-09):** the mechanical guard-insertion pass matched the literal string `runs-on: [self-hosted` inside a header *comment* in `rust-ci.yml` (writing a top-level key that would have invalidated the file) and inserted a second `if:` into `ci.yml`'s `docker` job, whose own condition sits *after* `runs-on:`. Both repaired; `docker`'s pre-existing prod-only condition already excludes every PR, so no guard was needed there. All 32 workflow files now parse as valid YAML.

## [Unreleased] — 2026-09-23

### Fixed
- **5 of 7 ingest pipelines reported success with 0 records, and realtime logged upstream failures while succeeding ([#921](https://github.com/reverb256/quill/issues/921)):** three independent defects hid behind the green liveness signal. (1) `countRecords()` did not read the count verbs the scheduled modules emit (`meetingsIngested`, `reportsIngested`, `recordsIngested`, `actorsFound`, …), so a full working committees run that persisted 41 claim bundles reported `records=0`. (2) A registry health-check skip returned `{skipped: true, reason}` that the runner logged as success, and module results carrying `success: false` (21 modules emit it) were counted as successes. (3) The realtime fetchers swallowed every 403/404/ENOTFOUND into an empty array, so `errors[]` (which only collects promise rejections) stayed empty and the run was green. The runner now classifies honestly: skips, module-reported failures, all-sources-errored, and zero-records-without-declared-reason are recorded as **failed** runs; a legitimate quiet run carries a declared `zeroReason` (`no-new-records-since-last-run`). Regression tests in `src/cli/__tests__/run-pipeline.test.ts` pin every branch — including the exact condition from the issue (success with zero records and no declared reason now fails).
- **Per-source ingest outcomes are recorded and surfaced (GH#921):** `ingest_runs` gains a `sources_json` column (migrated in place on existing databases; old rows read back `sources: null`) carrying `{sources: [{source, status: ok|empty|error, records, error}], zeroReason}`. `GET /v1/ingest/status` exposes `sources` and `zeroReason` per pipeline, and a run whose every source errored is classified stale exactly like a failed run — so `scripts/quill-health-check.sh` alerts on it without modification. Round-trip, declared-zero, legacy-row and migration tests in `src/ingestion/__tests__/run-log.test.ts`; payload tests in `packages/api-server/src/__tests__/ingest-status.test.ts`.
- **Three dead realtime upstreams repaired (GH#921, all verified live):** ECCC's flat CAP index (`dd.weather.gc.ca/alerts/cap/cap_01_alert_index.xml`, 404 — the datamart restructured to date-stamped directories) is replaced by the GeoAPI collection `api.weather.gc.ca/collections/weather-alerts/items` (verified 200, 136 alerts matched); CBSA's border-wait JSON (`bwt-taf/bwt_taf-eng.json`, 404) is replaced by the `#bwttaf` HTML table on `menu-eng.html` (verified 200, 29 crossings); the AMQPS broker host `q.weather.gc.ca` (NXDOMAIN) is replaced by `dd.weather.gc.ca:5671` with the documented `anonymous` credentials, the sarracenia `xpublic` exchange / `v02.post.*.WXO-DD.alerts.cap.#` topic, and the `q_anonymous.*` queue-name convention (arbitrary queue names are ACCESS_REFUSED — verified live). The realtime registry entry's `healthCheckUrl` also pointed at the Nunavut statistics page (403, Cloudflare-blocked, unrelated to realtime feeds) — that was the confusing `403 GET www.gov.nu.ca/...` line in the realtime CronJob logs; it now probes the actual alert surface. Live smoke after the repair: **169 records** (135 ECCC + 29 CBSA + 5 parole) where production had been reporting 5. Parser fixtures in `src/ingestion/__tests__/real-time-feeds-parsers.test.ts`.

## [Unreleased] — 2026-09-22

### Fixed
- **Every non-proxied caller shared one rate-limit bucket (found live while verifying this gate):** `extractIP()` read `req.ip`, an Express property that a raw Node `IncomingMessage` does not have, and fell back to the literal string `unknown`. Every request without an `X-Forwarded-For` header — the MCP server's in-cluster calls, health probes, port-forwards, any direct cluster traffic — was counted against one counter, so one noisy caller could throttle all of them. The key Redis actually held was `ratelimit:FREE:unknown`. `extractIP()` now falls back to `socket.remoteAddress`, and `normalizeIp()` normalises `1.2.3.4:port`, `[::1]:port` and IPv4-mapped `::ffff:1.2.3.4` forms.
- **Phantom Redis backend (gate A2-REDIS, [#764](https://github.com/reverb256/quill/issues/764) / [#770](https://github.com/reverb256/quill/issues/770)):** the API cache and rate limiter fell back to a hardcoded `redis://redis.ai-inference:6379` — a namespace that has never existed in the cluster — so the cache ran in bypass, the limiter ran in pass-through (i.e. no rate limiting at all) and the pod logs filled with connection errors. A real `quill-redis` (Deployment + ClusterIP Service, version-pinned image, non-root, ephemeral) now ships in `charts/quill/templates/redis.yaml`, `values-prod.yaml` points `api.env.REDIS_URL` at it, and the code reads the endpoint from configuration only: no `REDIS_URL` means "no Redis here", which selects an in-process sliding window instead of dialling a guessed host. A Redis that dies mid-flight now falls back to that window rather than allowing every request.
- **Ingest runner discarded its own database handle:** `packages/pipeline-core/src/cli/ingest.ts` passed a stub `D1Database` into `runModule()`. The stub carries a `prepare()` function, so the registry treated the caller as having supplied the database and skipped adapter injection — every db-first module (`committees`, `corporate`, `influence`, `ab-health`, `bc-health`) threw `No database configured` and persisted nothing. The runner now passes no handle and lets the registry inject the `QUILL_DB_PATH`-backed SQLite adapter; regression test in `src/cli/__tests__/run-pipeline.test.ts`.
- **Chart schedule keys that the CLI could not run:** `committees` and `social` were not `QUILL_PIPELINE` aliases, so those CronJobs would have exited 1 with "Unknown pipeline" on every tick; `indigenous` pointed at the non-existent module name `indigenous-relations` (the registry entry is `indigenous`), and `education-research` pointed at a module with no registry entry. Aliases corrected/removed, with `src/cli/__tests__/pipeline-aliases.test.ts` validating every `ingestion.schedules` key against `PIPELINE_CONFIG` and the live registry.
- **Query engines are no longer scheduled as ingest pipelines:** running `QUILL_PIPELINE=cross-reference` handed `searchCrossReference()` the runner's options object, so it died on `query.query.trim()` with "Cannot read properties of undefined (reading 'trim')" — a scheduling mistake wearing a crash costume. The alias is gone from `PIPELINE_CONFIG`, and the new `ingestEntryPoint()` guard in `run-pipeline.ts` refuses any module whose registry `ingestFunctions` carries no `ingestAll*`, recording the refusal as a failed run in `ingest_runs` instead of calling the module.
- **The ingestion health probe matched only compact JSON:** the API pretty-prints, so `"pipeline":"ngo-rss"` never matched `"pipeline": "ngo-rss"` and every pipeline — including the two that had just completed — was reported as "never reported a run". The probe now flattens whitespace once, and it skips a CronJob that has never been scheduled (`lastScheduleTime` unset), because a pipeline that is not yet due cannot be "not completing". First run of the probe against the live cluster: `has_issues=false`.
- **`GET /v1/ingest/status` is Free-tier visible, not just auth-exempt:** the route shipped anonymous-readable, but the Free boundary in `feature-gates.ts` still answered `402 UPGRADE_REQUIRED` (found live on the first sync). Ingestion liveness is cluster observability — a pipeline name and a timestamp — so it now sits in `FREE_TIER_ALLOWED_PREFIXES` beside `/v1/engine/status` and `/v1/data/quality`, and `src/__tests__/free-tier.test.ts` pins the entry.
- **Secrets lane: the false-positive baseline was inert (run 35676870104).** `.gitleaksignore` held TOML blocks (`paths = '''…'''`, `regexes = '''…'''`) instead of finding fingerprints. gitleaks ignores every such line — it logged `Invalid .gitleaksignore entry` 34 times and applied **zero** exclusions, so the audit's verified false positives would have failed the gate on any commit that touched them. The allow-list now lives in `.gitleaks.toml` as a value-scoped `[allowlist]` table; `.gitleaksignore` holds fingerprints only. A full-history scan drops from 75 findings to the 7 real `.secrets/` findings, which stay visible until the #854 history rewrite lands.
- **Run 35676870104 leak:** `.github/workflows/live-data-check.yml:48` carried a 64-hex `JWT_SECRET` literal (removed in `8bb6056` — generated per run with `openssl rand -hex 64`). The commit is now pinned by fingerprint in `.gitleaksignore`, so a scan that still reaches it stays green without allow-listing `.github/workflows/` — a future literal there still fails.

### Added
- **The A1 gate is runnable, not just claimed:** `bash scripts/gates-run.sh A1` wraps the three ingestion probes in `scripts/quill-health-check.sh` (CronJobs present, every scheduled pipeline leaving a run row the API reads back, none stale) and fails on any finding tagged `gate A1-INGEST` — so unrelated cluster noise cannot fail it, and a broken pipeline cannot pass it. `GATES-gaps-20260922.md` carries the A1 evidence block.
- **`packages/api-server/src/cache/redis-url.ts`** — single source of truth for Redis endpoint resolution (`resolveRedisUrl`, `redisHostOf`; credentials never logged), used by both `cache/redis.ts` and `middleware/rate-limiter.ts`.
- **In-process sliding-window fallback** in `middleware/rate-limiter.ts` (`backendMode()` reports `redis` | `memory`; `check()` always returns a decision and never a pass-through `null`), plus a log-spam guard: the first Redis error warns, repeats drop to `debug`.
- **Redis clients reconnect instead of giving up:** the retry strategy used to return `null` after 2–3 attempts, so a pod that lost the start-up race with Redis stayed degraded (`connect ECONNREFUSED …:6379`, limiter in pass-through) until a human restarted it — reproduced live during this rollout. Both clients now keep the connection object, reconnect forever with a 5s backoff ceiling, and track `ready`/`error`/`close`, so an outage heals by itself.
- **`REDIS_URL` documented and wired for local dev:** `docker-compose.yml` starts a `quill-redis` service and passes `REDIS_URL` to the API; `.env.example` documents the variable and its "unset is valid" semantics.
- **Tests:** `packages/api-server/src/__tests__/rate-limiter-backend.test.ts` — 21 tests covering endpoint resolution, a source guard against any new hardcoded `redis://` host, in-process enforcement at the tier limit, window rollover, Redis result mapping (allowed / remaining / reset / retryAfter), the incident regressions "Redis fails mid-flight — the limit still holds", "a Redis that was down at boot does not leave the limiter degraded" (recovery through `ready` / `close`), and client-identity keying ("two in-cluster peers get two different counters").
- **Production ingestion is scheduled (gate A1-INGEST, #889):** `charts/quill` now deploys one CronJob per pipeline in `ingestion.schedules`, and `values-prod.yaml` enables seven of them (`committees`, `gazette`, `oversight`, `corporate`, `influence`, `ngo-rss`, `realtime`) with `ingestion.nodeName: nexus`. Each job mounts the api pod's PVC and sets `QUILL_DB_PATH=/data/quill/maplespike.db`, so ingested records and claim bundles land in the store the API reads. New `Dockerfile.ingest` is a multi-stage glibc build (the old one copied host-built `node_modules` into Alpine, where the glibc `better-sqlite3` binding cannot load).
- **Ingestion liveness is observable:** `ingest_runs` run log (`packages/pipeline-core/src/ingestion/run-log.ts`), written by the runner and read back by the new public `GET /v1/ingest/status`, which classifies every pipeline as fresh/stale against 2× its cron period. `scripts/quill-health-check.sh` probes both the CronJob list and that route, so a stopped pipeline raises a stale-ingest alert instead of failing silently.
- **The ingest runner is digest-pinned like every other workload (gate A3-IMAGEPIN, [#755](https://github.com/reverb256/quill/issues/755)):** `charts/quill/templates/cronjobs.yaml` rendered `quill-ingest:{{ .Values.image.tag }}`, and `values-prod.yaml` pins no chart-wide tag — so the first sync produced `docker.io/library/quill-ingest:` (`InvalidImageName`, every pod stuck at `0/1`). The template now goes through the `quill.image` helper (which fails the render when `images.ingest` carries neither digest nor tag), `values-prod.yaml` pins `images.ingest`, `scripts/pin-images.sh` builds/imports/pins the `ingest` service, and `scripts/gates/check-image-pins.mjs` holds it to the same digest policy as `api`/`mcp`/`portal`.
- **`scripts/check-gitleaks-baseline.sh`:** guards the baseline before every secrets scan — fingerprints-only `.gitleaksignore`, default ruleset kept, no catch-all entry, plus live fixtures proving an audited placeholder is ignored while a 64-hex secret still fails. The `secrets` job runs it on a pinned `GITLEAKS_VERSION` (gitleaks ≤ 8.24 reads `[allowlist]` and silently ignores `[[allowlists]]`; the script fails loudly if the engine pin drifts).

## [Unreleased] — 2026-09-17

### Fixed
- **MCP tool count corrected (184, was 182):** `docs/metrics.json` had been stale since the 2026-08-21 era (173-entry parse = 182). A fresh `scripts/generate-metrics.mjs` run parses 175 single-tool entries + 6 WDI + 3 Comtrade = **184** — matching the deployed MCP `/health` (which was already correct; the repo was the stale side). Discovery artifacts, `stats.json`, `agents.json`, and all current-claim prose were updated to 184; TypeScript totals refreshed to 221,431 lines / 1,622 files. `AGENTS.md` still shows the old 182 in three spots — that file is owner-write-protected; the fix is pending owner approval.
- **Module count corrected (207, was 208):** `scripts/generate-metrics.mjs` counted the unquoted `modulePath: string;` interface field in `pipeline-core/src/ingestion/registry.ts` alongside real registry entries, overstating the total by one. The generator now prefers the runtime `getAllModules()` count (quote-aware literal fallback when dist is absent); `docs/metrics.json` and every current-claim surface (`README.md`, `AGENTS.md`, `ROADMAP.md`, `knowledge.md`, `DESIGN.md`, `docs/*`) now report **207 modules**, and the generated discovery artifacts were regenerated from the corrected metrics (`agent-card.json`, `.well-known/mcp/server-cards.json`, `agents.json`).

### Added
- **Count drift is now enforced:** new `scripts/check-count-consistency.mjs` fails when any published count disagrees with `docs/metrics.json` or the runtime registry; new `scripts/check-lockfile-specifiers.mjs` verifies lockfile specifiers against workspace manifests plus pnpm overrides (fails on unexplained mismatch).
- **OpenSpec lifecycle:** change `agent-discovery-surface` archived; merged capability spec at `openspec/specs/agent-discovery/spec.md`.
- **Next changes proposed:** `watchlist-alerts-v1` (user-facing watch CRUD + email/webhook delivery with provenance on every event) and `pricing-transparency` (public operation rate card + pre-run cost estimates; see Decision 0008).

## [Unreleased] — 2026-07-07

### Added
- **x402 Phase 2 — full Solana tx verification:** `packages/quill-mcp/src/solana-rpc.ts` performs the three-step introspect→simulate→confirm flow against `SOLANA_RPC_URL` (default https://api.mainnet-beta.solana.com). Recipient matched via the `owner` field on pre/post USDC token balances from `encoding:"jsonParsed"` `getTransaction`. No `@solana/web3.js` dependency added. Closes the verification half of [#750](https://github.com/reverb256/quill/issues/750).
- **x402 Phase 3 — pre-pay credit balance:** `packages/quill-mcp/src/credit-balance.ts` mints per-identity USDC credit balances; `packages/quill-mcp/src/tools/x402-deposit.ts` exposes a new MCP tool that verifies an on-chain Solana USDC deposit, atomically records the signature in the replay ledger, and credits the caller's quota identity. Middleware now prefers credit balance over per-call verification. Closes the credits half of [#750](https://github.com/reverb256/quill/issues/750).
- **Replay protection:** `packages/quill-mcp/src/x402-ledger.ts` — signature ledger with TTL eviction (7-day retention) and optional atomic JSON persistence at `X402_LEDGER_PATH`. Middleware uses atomic `recordIfNew()` to defeat concurrent double-spend.
- **Shared x402 constants:** `packages/quill-mcp/src/x402-constants.ts` — USDC mint, decimals, retention, defaults. Imported by `solana-rpc.ts`, `x402-ledger.ts`, `credit-balance.ts`, `x402-middleware.ts`, and `tools/x402-deposit.ts`.
- **New env vars:** `SOLANA_RPC_URL`, `X402_LEDGER_PATH`, `X402_CREDITS_PATH`, `X402_CONFIRMATION_LEVEL`, `X402_TIMESTAMP_TOLERANCE_SEC` (plus the long-undocumented `QUOTA_ENABLED`, `QUILL_FREE_QUOTA`, `QUOTA_PERSIST_PATH`, `QUILL_HANDLER_TIMEOUT_MS`, `TRUST_PROXY`, `ASTRAL_KEY_URL` now documented in `.env.example`).
- **Async middleware flow:** `validatePayment()` is now `async` in `x402-middleware.ts`; `server.ts` `handleToolCall()` awaits it and passes the `QuotaIdentity` so credit balance can be debited before falling through to per-call verification.
- **New MCP tool:** `x402-deposit` (registered in `tools/index.ts`) — signature + expectedAmount → validated credit balance update.
- **Test coverage:** 54 new unit tests across `x402-ledger.test.ts`, `credit-balance.test.ts`, `solana-rpc.test.ts` (with mock fetch across happy path + every error reason), and `x402-middleware.test.ts` (async flow including replay-block).
- **Lightpanda CLI browser fetch (foundation):** `packages/pipeline-core/src/utils/browser-fetch.ts` — thin wrapper that spawns `lightpanda fetch --dump <fmt> <url>` per request via dynamic-imported `node:child_process` (so the module still bundles for Cloudflare Workers / Bun). Returns rendered DOM as a `BrowserResponse` with the same shape as `httpGet()`. Mirrors the `__MAPLESPIKE_MOCK_FETCH` test-override pattern via `__MAPLESPIKE_MOCK_BROWSER`. Wired to **no fetcher yet** — opt-in per file behind a feature flag in a followup turn. Required binary: `LIGHTPANDA_BIN` (default `/home/j_kro/.local/bin/lightpanda`); not packaged with the OCI images; self-hosters pull the precompiled release from `github.com/lightpanda-io/lightpanda/releases` or skip the browser-backed callers.
- **Systemic registry flip — `ghcr.io` → operator registry:** All OCI image refs re-targeted from `ghcr.io/reverb256/quill/<svc>` to the operator-host registry to bypass the GHCR `write:packages` PAT blocker. Affects 15+ files (CI workflows, Helm values, docker-compose, render.yaml, flake.nix, narrative docs); CI builds are now `push: false` (operator publishes via `nix run .#push-images`); public install paths 2 (docker compose) and 3 (render.yaml Blueprint) are now OPERATOR-ONLY / DEPRECATED.

### Fixed
- **Helm chart ADR 0007 executed:** `charts/maplespike/` deleted; `charts/quill/` introduced. Obsolete Grafana dashboard `maplespike-api-mcp-overview.json` and stray artifact `26868,` removed. Reference: [ADR 0007](./docs/decisions/0007-repo-rename.md).
- **Portal landing redesign:** Astro islands (`Island.tsx`, `islands/pages/Landing.tsx`) removed; replaced with server-rendered `LandingBody.astro` + `logo.svg`. Tool descriptions bilingualised across `packages/i18n/src/{en,fr,types}.ts` and `packages/quill-mcp/i18n/fr-tools.json`.
- **Cloudflared liveness probe restart loop:** `k8s/base/05-cloudflared.yaml` and `k8s/manual/05-cloudflared.yaml` both have `--metrics 0.0.0.0:2000` on the args block (already on `main` via commit `6dec534`); issues [#744](https://github.com/reverb256/quill/issues/744) and [#729](https://github.com/reverb256/quill/issues/729) closed.
- **Docs hygiene:** `.env.example` now documents all 13 MCP server env vars; README.md + ARCHITECTURE.md deployment sections updated; MCP tool count in prose docs reflects `pricing.ts` and the new `x402-deposit` tool; ROADMAP.md Known-Drift block trimmed (committed rebranding drift + cloudflared entries marked DONE).

## [Unreleased] — 2026-07-04

### Fixed
- **Pipeline-core `registry.ts`:** Removed 5 of 6 duplicate `./french-sources/index.js` registry entries (`legisquebec`, `gazette-fr`, `statcan-fr`, `quebec-city-data`, `montreal-data`) — `canlii-fr` retained as canonical. Resolves `module paths are unique in registry` test failure in `module-contracts.test.ts`. Underlying `./french-sources/index.ts` still exposes the full `FRENCH_SOURCES` config array (6 sources), so runtime data is preserved; only registry-level `getModule('<name>')` discoverability for the 5 dropped names is gone. Zero downstream callers found (`rg '\bgetModule\b.<legisquebec|gazette-fr|statcan-fr|quebec-city-data|montreal-data>'` returns empty).
- **Metrics refresh:** `docs/metrics.json` regenerated via `scripts/generate-metrics.mjs` (198 → 208 modules, 191 → 203 ingestion subdirs, 164 → 165 MCP tools). Prose docs (`docs/SAAS-TIERING.md`, `docs/ARCHITECTURE.md`, `AGENTS.md`, `README.md`) updated to match; CHANGELOG historical `198 modules` entry preserved at its original date.

## [Unreleased] — 2026-07-03

### Changed
- **Repo rename:** `reverb256/maplespike` → `reverb256/quill`. Directory renamed `maplespike/` → `quill/`. Container images, K8s resources, Nix flake outputs, Helm chart, and Prometheus jobs renamed to `quill-*` (`quill-mcp`, `quill-api`, `quill-portal`, `quill-ingest`, `quill-engine`, `quill-edge`, `quill-ai`). GHCR path moved from `ghcr.io/reverb256/maplespike/` → `ghcr.io/reverb256/quill/`. Binary `maplespike-quill` → `quill`.
- **Env-var sweep:** All product-level `MAPLESPIKE_*` env vars renamed to `QUILL_*` across source code, `.env*` files, `wrangler.toml`, `docker-compose.yml`, `Dockerfile`, K8s manifests, Helm chart, and Nix flake (~35 vars: `LOG_LEVEL`, `STORAGE`, all `DB_*`, `AI_*`, `GATEWAY_*`, `QDRANT_*`, `BILLING_*`, `PIPELINE`, `FREE_QUOTA`, `LOCALE`, `HANDLER_TIMEOUT_MS`, `JWT_TOKEN`, `CANLII_API_KEY`, `AI_API_KEY`, plus `MAPLESPIKE_NAME`/`MAPLESPIKE_VERSION` runtime config flipped to defaults `Quill` / `0.x`). Brand-level env vars preserved at brand-level names: `MAPLESPIKE_DOMAIN`, `MAPLESPIKE_ORIGIN`, `MAPLESPIKE_BILLING_EMAIL`, `MAPLESPIKE_OAUTH_*`, and `MAPLESPIKE_TREASURY_*` chains.
- **Type/header renames:** `QuillStorage` → `QuillStorage`, `QuillCache` → `QuillCache` across api-server types. Module headers `* MapleSpike —` updated to `* Quill —`; `MapleSpike API (dev)` → `Quill API (dev)`.
- **i18n fixes:** Added missing TranslationKeys (`pricing.free_tier_label/desc/paid_tier_note`, full `quota.*` family) so `en.ts`/`fr.ts` type-check. Added `search_lode` French translation entry in `fr-tools.json`. Fixed lazy-load cache (`frDescriptions` initialised to `{}` short-circuited the JSON read) and removed the wrapTools over-eager `descriptions: {}` injection that triggered false `fr-CA` failures on tools without an explicit translation.
- **Preserved:** `@maplespike/*` npm scope (org-level), `maplespike.ca` domain, `*.maplespike.lan` DNS, K8s namespace `maplespike`, PostgreSQL user `maplespike`, `maplespike-brand/` site directory, `MAPLESPIKE_TREASURY_*` chains, `MapleSpike` in AGPL/MIT copyright headers.

### Added
- **ADR 0007** at `docs/decisions/0007-repo-rename.md` — comprehensive rename record (rationale, mapping table, considered alternatives, what stays preserved).
- **`docs/GHCR-CLEANUP.md`** — manual purge procedure for old `reverb256/maplespike/*` GHCR images (deferred pending GitHub-admin credentials).

## [0.4.x] — 2026-06-26

### Added
- **Provincial Coverage:** 33 new data modules covering all 9 previously-missing provinces/territories (SK, MB, NS, NB, NL, PE, YT, NT, NU). All 13 Canadian jurisdictions now have dedicated modules.
  - NS (4): health, education, labour, budget — Socrata (749 datasets)
  - NB (4): health, education, energy, labour — Socrata
  - PE (4): health, agriculture, education, budget — Socrata
  - NL (4): health, budget, energy, education — custom portal
  - SK (6): health, education, agriculture, crown-corps, labour, budget — CKAN
  - MB (6): health, education, hydro, MPI, labour, budget — CKAN
  - YT (3): health, education, energy-mines — CKAN
  - NT (1): health-social — custom portal
  - NU (1): statcan cross-province — federal CKAN
- **Socrata API Connector:** New `socrata-api.ts` in pipeline-core providing reusable SODA v2.1 client for Nova Scotia, New Brunswick, and PEI portals
- **MCP Tools:** 32 additional MCP tools registered (was 129, now 164) — StatCan time-series, infrastructure, governance, QA, health monitoring, and CKAN batch tools

### Changed
- **Registry:** 198 modules (was 144, +54 total including prior batch modules)
- **MCP tools:** 164 registered in tools/index.ts (was 129)
- **Metrics:** 191K lines TypeScript across 1,475 files

### Fixed
- **MCP server:** Handler timeout (55s default via `QUILL_HANDLER_TIMEOUT_MS`) with auto-exit on failure — prevents stale subprocess accumulation and gateway blacklisting
- **Database:** ESM `.js` extension resolution for Node.js stdio mode
- **API server:** Deduplicated `/v1/keys` GET route (was registered twice)
- **Portal:** OG image updated to dedicated social card, description encoding fixed

## [0.3.0] — 2025-06-11

### Added
- **MCP Tools:** 87 tools registered (was 53) — 34 orphan tools now live, all `search-*.ts` files registered in `tools/index.ts`. All 87 tools accessible to AI agents with proper input schemas and error handling.
- **Engine Expansion:** Cross-module entity linking system (850 lines) with:
  - `EntityLinker` — 10 linking rules covering person→committee, person→charity, organization→charity, organization→lobbying, committee→lobbying
  - `DisambiguationEngine` — 6 disambiguation strategies (exact match, auxiliary data, geographic, temporal, confidence gap, manual review)
  - Committee and Charity type definitions with governance, membership, financials, board members
  - 8 new edge types documented in `packages/engine/CROSS_MODULE_LINKING.md`
- **SDK Expansion:** TypeScript SDK with:
  - `EntityResolution` client (195 lines) — entity types, resolution results, confidence scoring
  - `Ingestion` and `Search` methods for data pipeline operations
  - 5 example scripts in `packages/sdk/examples/`
  - Integration tests in `packages/sdk/tests/integration/`
  - Expanded README.md with usage documentation
- **Parser Implementation:** 32 modules across all domains:
  - Federal (8): attestation, gc-standards, federal, legislation, a2aj, goc-spending, defence, fisheries
  - Civil Society (4): ngo-influence-rss, media-broadcasting, corporate-filings, unions
  - Provincial (5): provincial, provincial-orgs, provincial-regulators, ontario-provincial, police-data
  - International (5): un-comtrade, oecd-stat, undp-hdi, unhcr-refugees, worldbank-wdi
  - Municipal/Emergency (6): real-time-feeds, regional-authorities, municipal-long-tail, gtfs-transit, fire-emergency, emergency-management
  - Real-time/Monitoring (2): political-donations, parliamentary-voting
- **Database Schema:** Added 8 new tables for entity linking:
  - `committee_governance`, `committee_governance_members`, `committee_governance_meetings`
  - `charities`, `charity_activities`, `charity_financials`, `charity_board_members`
- **Foundation Testing:** 19 tests covering highest-centrality utilities:
  - `http.test.ts` (4 tests) — GET, JSON parsing, 404, empty response
  - `hashing.test.ts` (15 tests) — SHA-256/384/512, verification, Unicode, deterministic
- **CronJob Deployment:** 17 ingestion CronJ manifests ready for K3s cluster deployment
- **Issue Triage:** All 9 open GitHub issues labeled with priority (p0/p1/p2) and type tags

### Changed
- **Registry:** Updated `registry.ts` with health check URLs, removed placeholder status for 32 completed modules
- **Metrics:** `docs/metrics.json` updated from generated data (144 modules, 140 MCP tools, 18,876 TS lines)
- **Dockerfile:** Fixed multi-stage build for ingestion image
- **Import paths:** Fixed broken import path in ingestion templates

### Fixed
- Build errors in registry.ts (missing comma)
- MCP server import resolution for orphan tools

### Infrastructure
- Dockerfile multi-stage build fix
- `charts/maplespike/` Helm chart updated with 17 CronJob schedules
- NixOS K3s config prepared for automated CronJob deployment

### Test Coverage
- Engine: 56 tests passing
- Pipeline Core: 339 tests passing
- API Server: 66 tests passing
- MCP Server: 375 tests passing
- SDK: 7 tests passing
- Notification Service: 13 tests passing
- **Total:** 856 tests

---

## [0.2.0] — 2025-05-20

### Added
- Initial release with MapleSpike data pipeline, API server, MCP server, portal
- Core ingestion pipeline with 142 modules
- MCP tool ecosystem (53 tools initially)
- TypeScript SDK foundation
- Simple HTML portal
- Documentation site