---
last-reviewed: 2026-07-08
status: active
---

# MapleSpike Roadmap

> **Current version:** v0.3.0 (unreleased — see [CHANGELOG.md](./CHANGELOG.md) `[Unreleased]` for items in flight; will publish to `prod` on the next changeset batch)
> **Build:** ✅ `pnpm build` passes (14/14 packages — `i18n` added since the prior 13-package baseline)
> **Tests:** 1750+ passing (pipeline-core 339, quill-mcp 903, api-server 610, engine 56, sdk 9, notification-service 13, i18n TBD, portal 128) — verified 2026-11-16 after full audit + gap-fix session.
> **Modules:** 207 registered modules (runtime `getAllModules()`), 203 standalone ingestion subdirs — see [`docs/metrics.json`](./docs/metrics.json)
> **MCP tools:** **185** registered in `tools/index.ts` (added `getting_started` for onboarding; 184 prior + 1 new). All 185 verified live via MCP.
> **TypeScript:** 221,431 lines across 1,622 files, 14 packages
> **MVP tracker:** [#665](https://github.com/reverb256/quill/issues/665) — Real readiness: ~30%
> **Open issues:** 4 strategic (the 3 quality sub-issues from the v0.3.0 cleanup are closed; full list at bottom)

---

## Source Plans (consolidated by this document)

The active backlog is consolidated from earlier planning artifacts that have since been retired from the repo. **This document is the single source of truth** — the phases below carry the surviving backlog.

| Source | Status | Disposition in ROADMAP |
|---|---|---|
| Portal Astro cutover | ✅ Complete (2026-05-18) | Lessons → Phase 2 |
| Email notifications | 🟡 Draft | Phase 5.1 |
| SEDAR+ corp filings | 🟡 Draft | Phase 5.1 |
| Journalism mode | 🟡 Draft | Phase 5.1 |
| NT/NU live tests | 🟡 Draft | Phase 5.1 |
| Portal visual QA | 🟡 Draft | Phase 6 |
| K3s kubeconfig | 🔴 Blocked | Phase 4 (last row) |
| 22 missing modules | 🟡 Draft | Phase 5.2 |
| Coverage 103→150 | 🟡 Draft | Phase 5.3 |
| Legal compliance | 🟡 Draft | Phase 3 |
| Quality + issue triage | 🟡 Draft | Phase 5.4 |
| Git cleanup | 🟡 Draft | Phase 3 |
| Git maintenance | 🟡 Draft | Phase 3 |
| Cluster deploy reality | 🟡 Open | Phase 4 |
| Public DNS path | 🟡 Open | Phase 4 |
| Board + cron ops | 🟡 Inactive | Phase 3 + Phase 4 |
| Docs maintenance workflow | 🟡 Workflow defined; gateway inactive | Phase 6 |

**Status legend:** ✅ DONE &nbsp;·&nbsp; 🟡 TODO/In progress &nbsp;·&nbsp; 🔴 Blocked &nbsp;·&nbsp; ⏳ Under review

---

## Phase 1 — Build Integrity & CI ✅ DONE

| Task | Status |
|------|--------|
| Fix quill-mcp build (4 missing tool files) | ✅ |
| Add `.github/workflows/ci.yml` | ✅ |
| Archive 3 fiction docs (PIPELINE-ARCHITECTURE, SELF-HEALING, K8S-NIX-MANIFESTS) | ✅ |
| Fix kanban docs (empty board, no cronjobs) | ✅ |
| Fix metrics.json (135→53 MCP tools) | ✅ |
| Fix ARCHITECTURE.md metrics | ✅ |
| Close 5 stale issues | ✅ |
| Fix #642 shared imports | ✅ |
| Add MCP server tests (215) | ✅ |
| Fix notification-service tests (4 SQLITE_ERROR) | ✅ |
| Add Dockerfile + docker-compose.yml | ✅ |
| Mark 16 placeholder modules in registry | ✅ |
| Label remaining 4 open issues | ✅ |
| Disable broken deployment workflows | ✅ |
| Fix API docs domain references | ✅ |
| Archive orphaned infrastructure scripts | ✅ |
| Create Docker Compose deployment guide | ✅ |

---

## Phase 2 — Portal Astro Cutover ✅ DONE (2026-05-18, 10 commits, ~22K lines)

> Plan: retired planning artifact (issue-83 portal refactor; completed 2026-05-18).

Replaced 16 static HTML pages in `packages/portal/` with Astro + React + Tailwind v4 + shadcn/ui (Radix-nova base, Three.js animated aurora shader hero background). Deleted orphaned `packages/pretext-civic/`. Multi-stage `Dockerfile.portal` builds Astro then serves via nginx, configured for non-root user 1001 (K8s securityContext).

### Lessons applied to future portal work

| Lesson | Learn-it-once rule |
|---|---|
| ❌ Radix compound components in Astro SSR | `Tabs`/`Sheet`/`Dialog` need React context not preserved in Astro's server renderer — use plain HTML + inline `<script>` for tab switchers (`data-tab` / `data-tab-panel`). |
| ❌ `@astrojs/tailwind` with Tailwind v4 | Use `@tailwindcss/vite` Vite plugin directly in `astro.config.mjs`. |
| ❌ Three.js without `client:only="react"` | Components access `window`/`document` which don't exist during SSR. Always opt into client-only. |
| ❌ Local `pnpm build` as the only gate | Docker commonly fails on missing root `tsconfig` inheritance, missing `.npmrc` (`injectWorkspacePackages=true`), or missing corepack-pinned pnpm version. **Docker build is the only honest test.** |
| ❌ Build from `packages/portal/Dockerfile` | CI builds `Dockerfile.portal` at repo root; the local one is dev-only. |
| ⚠️ i18n/fr-CA still client-side only | Astro i18n routing (true `/fr/` paths) not configured — pre-existing limitation carried over. |
| ⚠️ Subagent scope creep | Every page subagent created files outside `packages/portal/`. Always pin agents: `MUST NOT DO: touch any file outside packages/portal/`. |

| Task | Status |
|------|--------|
| 16 portal pages → Astro + shadcn/ui | ✅ |
| Multi-stage Dockerfile → nginx (non-root user 1001) | ✅ |
| Animated aurora shader background on hero | ✅ |
| Delete `packages/pretext-civic/` | ✅ |
| 3 Docker pitfalls fixed (corepack pin, `.npmrc`, root `tsconfig` copy) | ✅ |
| Portal visual QA across 16 pages × 4 viewports × 2 themes | 🟡 → Phase 6 (issue-199) |

---

## Phase 3 — Repo Hygiene, Compliance & Ops 🔄 IN PROGRESS

> Sources: retired planning artifacts (git cleanup, git maintenance, legal compliance); `KANBAN-AUTOMATION.md`

Clean local/remote graph, license disclosure loop, and active cron/kanban before further work lands. Without this phase: every feature PR risks merging on top of ghost branches, missing licenses, and an inactive gateway.

| Task | Priority | Effort | Status |
|------|----------|--------|--------|
| Prune stale remote tracking (`git fetch --prune`) + delete merged-into-main branches | P0 | 30m | 🟡 TODO |
| Delete ghost branches where remote is `[gone]` | P0 | 15m | 🟡 TODO |
| Consolidate issue-399 variants into `issue-399-license-compliance-pr404` (4 duplicates) | P1 | 1h | 🟡 TODO |
| Consolidate issue-34 variants into `issue-34-weight-verification-restored` | P1 | 30m | 🟡 TODO |
| Rebase `issue-194` (~90 commits behind `origin/main`) | P0 | 1-2h | 🟡 TODO |
| Re-track `issue-195`/`200`/`206`/`207` from `bare/main` → `origin/main` + rebase | P0 | 2h | 🟡 TODO |
| Rename `feat/`/`fix/`/`pr-NNN`/`kelos-task-` branches to `issue-NNN-...` | P2 | 1h | 🟡 TODO |
| Add `.githooks/prepare-commit-msg` enforcing issue reference | P2 | 30m | ✅ DONE (2026-07-04 — `.githooks/prepare-commit-msg` exists; warns on missing `#NNN`; activation via `git config --local core.hooksPath .githooks` documented in `CONTRIBUTING.md` §Local Setup) |
| Update `CONTRIBUTING.md` with branch/PR discipline section | P2 | 30m | ✅ DONE (2026-07-04 — `Workflow`, `PR Checklist`, and `Local Setup` sections in tree) |
| Resolve `mcp-server` license discrepancy (`package.json` Apache-2.0 vs README MIT) | P0 | 30m | ✅ DONE (2026-07-04 — `packages/quill-mcp/package.json` and `packages/quill-mcp/README.md` both state Apache-2.0) |
| Run license-checker on `pnpm-lock.yaml`; verify no GPL deps in commercial tier | P1 | 1-2h | 🟡 TODO |
| Review source terms and dataset-level attribution across upstream data sources | P1 | 1h | 🟡 TODO |
| Generate `NOTICE` files per package's third-party dependencies (SBOM) | P2 | 1h | 🟡 Partial (2026-07-04 — `packages/quill-mcp/NOTICE.md` added; **13 of 14** workspace packages still need NOTICE.md — see `docs/metrics.json` `packages.names` for the deferred set; full CycloneDX/SPDX SBOM tracked under "Run license-checker on `pnpm-lock.yaml`") |
| Install/configure `hermes` gateway + systemd unit | P0 | 30m | 🟡 TODO |
| Activate Kelos `.kelos/workflows/docs-maintenance.yml` (metadata / TODO / metrics scans) | P1 | 30m | 🟡 TODO |
| `git tag backup/<branch>` safety protocol before any `-D` or rebase | P1 | policy | 🟡 TODO |

**Safety**: every `git branch -D` and every rebase must be preceded by `git tag backup/<branch>`; force-pushes use `--force-with-lease`. Stop-loss at > 10 conflicts in a single file.

---

## Phase 4 — MVP Quality Gate & Deploy Path 🔄 IN PROGRESS (NEXT)

> Sources: this phase's predecessor MVP gate items, the retired deploy checklist and strategic assessment, [`AGENTS.md` "Known Issues"](./AGENTS.md)

Deploy path customers touch. Cloudflare Tunnel is the only canonical external-exposure mechanism for `*.maplespike.ca` traffic (Tailscale Funnel + hybrid variants deprecated 2026-07-01).

| Task | Priority | Effort | Status |
|------|----------|--------|--------|
| Verify `docker compose build` locally | P0 | 30m | 🟡 TODO |
| End-to-end run script (clone → install → build → ingest → query) | P1 | 1h | 🟡 TODO |
| Fix `flake.nix` sandbox for Nix image builds (`__noChroot = true` on `quill-build`) | P1 | 1-2h | 🟡 TODO |
| Refresh `docs/metrics.json` via `node scripts/generate-metrics.mjs && git add` | P2 | 15m | ✅ Last run 2026-07-03 (see [docs/metrics.json](./docs/metrics.json)); repeat on schema change |
| Capture `i18n` test count in the Status block + perPackage line for `i18n` in `docs/metrics.json` (files + lines already present at i18n { files: 7, lines: 1500 }) | P2 | 30m | 🟡 TODO — current `Tests: 856` does not include `i18n` suite per `packages/i18n/package.json` `test` script |
| Integrate `quill-cronjobs.nix` into K3s host config; verify `DATABASE_URL` + secrets | P0 | 1h | 🟡 TODO |
| Build + push `quill-ingest:2026-07-*` (post-flip tag) | P0 | 30m | 🟡 TODO |
| `kubectl apply -f charts/quill/templates/cronjobs.yaml -n maplespike` | P0 | 30m | 🟡 TODO |
| Provision `maplespike-dev` K3s namespace (ServiceAccounts + NetworkPolicy) | P2 | 4h | 🟡 TODO |
| CI publish to GHCR on `main` merge | P2 | 1h | 🟡 TODO |
| Provision Cloudflare Tunnel + DNS: `api.maplespike.ca`, `mcp.maplespike.ca`, root `maplespike.ca` | P0 | 2h | 2026-07-14 — DNS CNAMEs for quill/api/mcp/data/datafabric.maplespike.ca added and E2E-verified (curl cf-ray headers confirm Cloudflare edge → tunnel → cluster routing; api/v1/health → 200 status:ok; mcp/health → 200 tools:174). Only mosaic.maplespike.ca remains pending — cluster K8s StatefulSet + Service + tunnel ingress still to come. |
| Deploy `quill-api`, `quill-mcp`, `quill-portal` to `maplespike` K8s namespace | P0 | 2h | 🟡 TODO |
| K8s secrets: `maplespike-secrets` (`JWT_SECRET`, `QUILL_BILLING_SECRET`) + `cloudflared-token` | P1 | 30m | 🟡 Partial (2026-07-04 — cluster state: `cloudflared-creds` exists with `credentials.json` (stale, references old tunnel ID); `maplespike-secrets` exists with `JWT_SECRET`; `telegram-secrets` exists but `bot-token` is 0 bytes (broken). sops-nix rotation of new secrets still blocked: Yubikey PC/SC unavailability is now diagnosed as a `gpg-agent`/`scdaemon` device-monopolization conflict (not just a group issue — see Known Drift "sops-nix secret decryption blocked" entry); local age key pubkey does not match the recipient in `quill/secrets/secrets.nix`; `github-pat.age` was retired and deleted on 2026-10-28. Full secret rotation requires (a) unblock sops path (scdaemon `pcsc-shared` mode OR pivot to local key), then (b) cluster health fix — 2/4 nodes NotReady, `cloudflared` pod CrashLoopBackOff.) |
| `curl https://api.maplespike.ca/v1/health` → 200 (public smoke) | P1 | 15m | 🟡 TODO |
| Database migrations for v0.3.0 committee/charity tables (`packages/database/src/migrations/002_*.ts`) | P1 | 1h | 🟡 TODO |
| Verify prod env: `DATABASE_URL`, `JWT_SECRET`, `QUILL_NIX_AI`, pushgateway `http://prometheus-pushgateway.observability:9091` | P1 | 30m | 🟡 TODO |
| Prometheus scrape config + Grafana dashboards (ingestion health, API latency) | P2 | 4h | 🟡 TODO |
| Alerting rules for failed CronJobs + API error rate | P2 | 1h | 🟡 TODO |
| Security audit on **165** MCP tools (PII exposure, rate limits, input validation) | P1 | 4-8h | 🟡 TODO |
| `nixos-rebuild switch` for Nix builder `/etc/nix/machines` | P2 | 30m | 🟡 TODO |
| Resolve `issue-200-k3s-kubeconfig.md` (file contents = `[BLOCKED]`) | P1 | — | 🔴 BLOCKED |
| NetworkPolicy + RBAC differentiation between `maplespike` and `maplespike-dev` namespaces | P2 | 2h | 🟡 TODO |
| Re-publish old `maplespike/*` → `quill-*` images (purge) | P2 | 1h | 🟡 TODO |

---

## Phase 5 — Backend Features, Modules & Coverage 🔄 IN PROGRESS

> Sources: feature plans in `.sisyphus/plans/issue-{130,137,138,194,195}-*.md`, coverage plans in `implement-missing-modules.md` + `gap-addressal-plan.md`, quality plan in `quality-issue-plan.md`.

### 5.1 Customer-facing feature plans

| Task | Priority | Effort | Source plan | Status |
|------|----------|--------|-------------|--------|
| Email notifications (#130): `subscriptions` + `alert_history` tables; alert engine + K8s CronJob; portal UI; SendGrid + console fallback | P2 | 16h | `.sisyphus/plans/issue-130-email-notifications.md` | 🟡 Draft (rels `routes/subscriptions.ts`, send via existing `email.ts`) |
| SEDAR+ corp filings (#137): full fetcher/parser/db/index per SEDI template | P2 | 16-20h | `.sisyphus/plans/issue-137-sedar-module.md` | 🟡 Draft (registry entry exists; 4-file stub; `parser.ts`/`db.ts` missing) |
| Journalism mode (#138): annotations table; 4 API routes gated on `tenant.journalismMode`; 3 MCP tools (`get_annotations`/`annotate`/`search_annotations`); portal UI (citation override + Sheet panel); Frostbite Gazette integration | P2 | 24h | `.sisyphus/plans/issue-138-journalism-mode.md` | 🟡 Draft (flag exists in types/schemas; zero behavioral effect) |
| NT/NU live tests (#194/#195): `LIVE_DATA_TEST=true` gated block on production endpoints; export `parseFederalRegistryHtml` for direct fixture tests | P2 | 4h | `.sisyphus/plans/issue-194-195-live-tests-live-tests.md` | 🟡 Draft |
| Stripe billing (checkout, webhooks, customer portal, payment reconciliation, tier expiry cron) | P1 | 16h | `packages/api-server/src/routes/billing-stripe.ts` | ✅ Live (2026-07-14 — D1/SQLite/Postgres/Memory storage backends implement `createPaymentReconciliation`, `getPaymentReconciliations`, `findTenantsForTierExpiry`; `/v1/billing/reconcile-expiry` route active; docs updated) |

### 5.2 Module coverage — registry → disk (22 missing)

Each batch follows the SEDI template (`constants.ts` + `types.ts` + `fetcher.ts` + `parser.ts` + `db.ts` + `index.ts` + `__tests__/`) over CKAN/Socrata/API sources. The retired implement-missing-modules plan is superseded by the batch list above.

| Batch | Modules | Effort | Status |
|------|---------|--------|--------|
| NRCan sub-modules | 5 — `nrcan-{renewable,fires,energy,forests,minerals}` | 8h | 🟡 TODO |
| ISC sub-modules | 7 — `isc-{health-funding,education,housing,water,jordan-principle,land-claims,communities}` | 12h | 🟡 TODO |
| IRCC sub-modules | 7 — `ircc-{processing-times,entry-exit,pr-admissions,citizenship,work-permits,study-permits,express-entry}` | 12h | 🟡 TODO |
| Standalone | 2 — `ontario-provincial`, `un-data` | 4h | 🟡 TODO |

### 5.3 Coverage growth — 103 → 150 modules

`.sisyphus/plans/gap-addressal-plan.md` is the detailed 12-phase roadmap. Phase 1 (GTFS, +31 agencies, issue #599) was already executed. Outstanding sub-phases:

| Sub-phase | Target | Effort | Status |
|-----------|--------|--------|--------|
| §Ph 2 — Library data (15 cities via CKAN/Socrata/ArcGIS) | +15 modules | 12h | 🟡 TODO |
| §Ph 3 — Police data (16 municipal portals) | +10 modules | 20h | 🟡 TODO |
| §Ph 4 — Parks & recreation | +12 modules | 8h | 🟡 TODO |
| §Ph 5 — Real-time feeds (amber alerts, air quality, traffic, flood) | +8 modules | 8h | 🟡 TODO |
| §Ph 6 — Provincial regulators (OSC, BCSC, AMF, PEO, EGBC, …) | +10 modules | 16h | 🟡 TODO |
| §Ph 7 — Utilities infrastructure (Hydro One, BC Hydro, Enbridge, …) | +7 modules | 16h | 🟡 TODO |
| §Ph 8 — Housing market (CMHC rental, vacancies) | +5 modules | 12h | 🟡 TODO |
| §Ph 9 — Transport infrastructure (CATSA, NAV CANADA, ports, rail) | +5 modules | 16h | 🟡 TODO |
| §Ph 10 — Cross-reference engine (GIC↔lobbying↔committees, donations) | +5 modules | 24h | 🟡 TODO |
| §Ph 11 — Data quality + infrastructure (validation, event bus, geocoding) | +3 modules | 24h | 🟡 TODO |
| §Ph 12 — Remaining (NSERC, CFI, Indigenous communities, smaller municipalities) | +20 modules | 16h | 🟡 TODO |
| **Subtotal** | **+100 modules → 150 target** | **172h** | |

### 5.4 Quality + test coverage (56 untested modules)

The retired quality-issue plan lays out the test debt; the top-of-list below is canonical.

| Test phase | Risk | Effort | Status |
|-----------|------|--------|--------|
| T1 — cross-reference (entity resolution, searchCrossReference, connections) | P1 HIGHEST | 8h | 🟡 TODO |
| T2 — corporate + influence + ngo-influence-rss | P1 | 16h | 🟡 TODO |
| T3 — provincial (lobbying, legislatures, orgs, regulators) | P1 | 32h | 🟡 TODO |
| T4 — canlii + Health Canada + health-data (CIHI, CFIA, PMPRB, PHAC) | P2 | 16h | 🟡 TODO |
| T5 — environment (NPRI, SARA, DFO fisheries, AAFC) | P2 | 16h | 🟡 TODO |
| T6 — #414 entity resolution automation at ingestion time | P1 | 16h | 🟡 TODO |
| T7 — #413 MCP entity resolution tools (`resolve_entity`, `find_connections_expanded`) | P1 | 8h | 🟡 TODO |
| T8 — #571 cross-reference BuildCanada + GovTrace | P2 | 12h | 🟡 TODO |
| T9 — #419 NIM entrypoint fix (opencode NVIDIA provider detection) | P2 | 4h | 🟡 TODO |
| T10 — #410 municipal fetchers (ArcGIS Hub, 33+ cities) | P2 | 16h | 🟡 TODO |

---

## Phase 6 — Visual & Documentation Quality 🔄 IN PROGRESS

> Sources: the retired portal-QA plan and docs-maintenance workflow definition (gateway inactive).

| Task | Priority | Effort | Status |
|------|----------|--------|--------|
| Portal visual QA across 16 pages × 4 viewports (320/768/1024/1440) × 2 themes (dark/light) | P2 | 8h | 🟡 TODO (parent of Phase 2 portal work) |
| Playwright smoke suite for `pnpm build` portal: all 16 pages → 200, no console errors | P2 | 4h | 🟡 TODO |
| `prefers-reduced-motion` fallback for AnimatedShaderBackground (low-end mobile) | P2 | 1h | 🟡 Partial (2026-07-04 — `packages/portal/src/components/ui/glsl-hills.tsx` checks `matchMedia('(prefers-reduced-motion: reduce)')` and renders a single static frame. **Deferred**: low-end-mobile device detection (no `navigator.deviceMemory` / `hardwareConcurrency` probe); runtime `change` listener for OS-level toggle mid-session) |
| Sweep inline `<N> modules` / `<N> MCP tools` references to match `docs/metrics.json` | P2 | 1h | 🟡 TODO (Kelos §3) |
| Sweep TODO/FIXME density in `docs/owasp-*.md` to <5% | P2 | 1h | 🟡 TODO (Kelos §2) |
| Sweep `last-reviewed` frontmatter on `.md` files (Kelos §1, 30-day threshold) | P2 | 1h | 🟡 Partial (2026-07-04 — `LICENSE.md` 2026-05-17 → 2026-07-04, `packages/quill-mcp/README.md` 2026-07-03 → 2026-07-04; full sweep across 25+ files in `packages/docs/**` deferred to dedicated pass) |

---

## Phase 7 — Ecosystem & Verification Layer (PLANNED) 🆕

> **Plan:** [`docs/ECOSYSTEM-EXECUTION-PLAN.md`](./docs/ECOSYSTEM-EXECUTION-PLAN.md) — the full file-level plan to make Quill the trusted, verifiable, agent-first Canadian data substrate (claim stack, composition hub, MCP resources/prompts, ecosystem guide, skills). Audited 2026-08-09: verification layer is currently the weakest-implemented part of the stack (pseudo-hash `get_citation`, stubbed `/v1/citation`, no claim bundles on responses) — this phase makes it real, verification-first.

| Milestone | Scope | Status |
|-----------|-------|--------|
| M0 — Stabilize | Finish Phase 4 deploy path + informal free-tier SLA + status page + fill empty `docs/products/quill.md`. **Parallel track, not a hard gate** (several Phase 4 blockers are operator-only: node recovery, sops secrets) | 🟢 **Partial 2026-08-09**: `/v1/status` endpoint (SLA + freshness) + `docs/products/quill.md` filled; public health + portal status page still behind operator infra |
| M1 — Claim Stack | Real SHA-256 claim bundles + SQLite-backed citation store + fix `get_citation` + fix `/v1/citation/:hash` + `verify_claim` tool/endpoint + claim bundles on 7 high-signal tools | 🟡 **Code done 2026-08-09** (`pipeline-core/src/claims/`, `citation_records` table, `verify-claim` tool, `/v1/claims/verify` routes, `withClaims` in 7 tools); pending live-endpoint verification |
| M2 — Composition hub | Graph-backed `search_cross_reference` + `linked_entities` tool + documented entity ID scheme + versioned schemas | 🟡 **Code done 2026-08-09** (`linked_entities`, graph-backed `search_cross_reference` w/ keyword fallback, `quill://entity/{id}` scheme, `quill://schemas` MCP resources); acceptance needs populated entity graph (WS-1b ingestion + Phase 5.3 §Ph10) |
| M3 — Agent-native | `resources/*` + `prompts/*` in MCP server (`quill://entities`, `quill://citations`, `influence-map`, `provenance-brief`) + progress/streaming + live-built tool index | 🟡 **Code done 2026-08-09** (`resources/list|templates|read`, `prompts/list|get`, `notifications/progress`, dynamic `discover_tools`); pending client smoke |
| M4 — Ecosystem | `docs/building-on-quill.md` + Quill Lite mode + reusable ingestion patterns + x402 `_meta` alignment + 2 agent skills + Hermes profile | 🟡 **Mostly done 2026-08-09** (guide, Quill Lite doc, 2 skills, Hermes profile + example); x402 `_meta` alignment deferred |

First execution slice: **M1 (Claim Stack)** — ~10-15 focused file changes (new `pipeline-core/src/claims/`, `packages/database` citation schema, `get-citation.ts`, `citation.ts` route, `withClaims` helper + 7 tool files, `verify-claim.ts`, `/v1/verify` route, `agent-card.json`) reusing existing attestation machinery (`hashing.ts`, `attestation/index.ts`). Gate = locally verified claim stack, so it never stalls on operator infra. See plan §WS-1 for file-level tasks.

---

## Open Issues (Strategic)

| # | Title | Priority | Status | Notes |
|---|-------|----------|--------|-------|
| 268 | AI Ask — natural language Q&A | P1 | 🟡 Needs PRD | Largest remaining feature; blocks #318. PRD scope decision still needed: MCP-tool surface vs REST endpoint vs both. `routes/ai.ts` + Qdrant RAG + BYOK paths already exist. |
| 549 | Quality Baseline & Competitive Gaps | P1 | 🟡 Partial | Epic; scattered work subsumed into Phase 5.4 test phases (T1-T10). |
| 309 | OWASP compliance dashboard | P2 | 🟡 Security headers done; dashboard remaining | Plan to subsume into portal Astro as React island. |
| 318 | Sovereign LLM Fine-tuning | P2 | 🔴 Blocked on #268 | Can't scope until AI Ask surface decision is set. |

---

## Known Infrastructure Drift

> Operator/infrastructure incident history is tracked in the private NixOS
> config repo. This section lists only product-relevant notes.

| Item | Status | Plan |
|------|--------|------|
| `packages/dashboard` build fails | 🟡 Excluded from workspace | OWASP dashboard migrated into `packages/portal/`; build-fix deferred. |
| sops-nix secret decryption blocked | 🟡 Operator-only (Yubikey / key-mismatch) | Restore the correct age key; see `secrets/README.md`. |
| Cloudflare DNS records wired end-to-end (2026-07-14) | ✅ `quill`/`api`/`mcp`/`data`/`datafabric` `.maplespike.ca` resolve through the tunnel; E2E-verified (api/v1/health → 200, mcp/health → 200). | `mosaic.maplespike.ca` pending — cluster StatefulSet + tunnel ingress still to come. |

---

## Future Tag Map

| Version | Trigger | Required items |
|---------|---------|----------------|
| **v0.4.0** | First customer onboarded | Phase 4 deploy path green end-to-end (Cloudflare Tunnel + K8s + cronjobs + secrets + DB migrations) + Phase 5.1 email notifications live + Phase 6 visual QA green. |
| **v0.5.0** | Coverage target met | 150 modules registered + gap-addressal-plan §Phases 2-12 all closed (172h; +~25 MCP tools per phase MCP-add math → ~190 total — recompute when §Phases 2-12 land). |
| **v0.6.0** | AI-native surface | #268 PRD shipped + #318 unblocked + at least T6/T7 (entity resolution automation + MCP tools) live. |

---

*Single-source-of-truth policy:* edits to the consolidated backlog above are the only ones that count. Plan files in `.sisyphus/plans/`, `STRATEGIC-ASSESSMENT-STATUS.md`, `KANBAN-{AUTOMATION,SETUP}.md`, and `DEPLOY-CHECKLIST.md` are maintained for context; when their content diverges, this ROADMAP is canonical and those files should be updated to match on next pass.</content>